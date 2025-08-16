import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';
import { MAVLinkBridgeClient } from '../../MAVLinkBridgeClient';
import { HttpError } from '../../core/HttpClient';

/**
 * Enhanced device discovery with retry logic and better error handling
 */
async function tryDiscoverDevice(verbose: boolean = false): Promise<string | null> {
  const commonUrls = [
    'http://192.168.4.1',
    'http://mavlinkbridge.local',
    'http://esp32-mavlinkbridge.local',
    'http://yardrover.local',
    'http://192.168.1.100',
    'http://192.168.1.200'
  ];

  for (const url of commonUrls) {
    if (verbose) {
      console.log(chalk.gray(`  Trying ${url}...`));
    }
    
    try {
      const client = new MAVLinkBridgeClient(url, { httpTimeout: 10000 });
      
      // Try up to 3 times with exponential backoff
      let lastError: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const health = await client.getHealth();
          
          // More flexible validation - check for any valid response structure
          if (health && (
            health.device || 
            health.status || 
            health.uptime !== undefined || 
            health.freeHeap !== undefined ||
            (typeof health === 'object' && Object.keys(health).length > 0)
          )) {
            if (verbose) {
              console.log(chalk.gray(`    ✓ Found device at ${url} (attempt ${attempt})`));
            }
            return url;
          }
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
            const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            if (verbose) {
              console.log(chalk.gray(`    Attempt ${attempt} failed, retrying in ${delay}ms...`));
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (verbose && lastError) {
        console.log(chalk.gray(`    × Failed after 3 attempts: ${lastError.message}`));
      }
    } catch (error) {
      if (verbose) {
        console.log(chalk.gray(`    × Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }
  
  return null;
}

export function registerDeviceCommands (registry: CommandRegistry): void {
  // Connect command
  const connectCommand: Command = {
    name: 'connect',
    description: 'Connect to a MAVLinkBridge device',
    category: 'Device',
    usage: 'connect [device-url] [--discover] [--timeout=10000]',
    examples: [
      'connect --discover',
      'connect http://192.168.4.1',
      'connect http://192.168.1.100:8080 --timeout=15000',
      'connect mavlinkbridge.local'
    ],
    execute: async (context: CommandContext, args: CommandArgs) => {
      let deviceUrl = args._args?.[0];
      const timeout = args.timeout || 10000;
      const autoDiscover = args.discover || !deviceUrl;

      // If no URL provided or auto-discover requested, try device discovery
      if (autoDiscover) {
        let discoverySpinner: any;
        
        if (context.verbose) {
          console.log(chalk.cyan('Starting device discovery with verbose logging...'));
          const foundUrl = await tryDiscoverDevice(true);
          
          if (foundUrl) {
            CUIHelpers.printSuccess(`Found device at ${foundUrl}`);
            deviceUrl = foundUrl;
          } else {
            CUIHelpers.printWarning('No MAVLinkBridge device found');
          }
        } else {
          discoverySpinner = CUIHelpers.startSpinner('Searching for MAVLinkBridge device...');
          
          try {
            const foundUrl = await tryDiscoverDevice(false);
            
            if (foundUrl) {
              CUIHelpers.stopSpinner(true, `Found device at ${foundUrl}`);
              deviceUrl = foundUrl;
            } else {
              CUIHelpers.stopSpinner(false, 'No MAVLinkBridge device found');
            }
          } catch (discoveryError) {
            CUIHelpers.stopSpinner(false, 'Device discovery failed');
            if (context.verbose) {
              console.error(chalk.gray(`Discovery error: ${discoveryError instanceof Error ? discoveryError.message : 'Unknown error'}`));
            }
          }
        }
        
        // Provide helpful guidance if discovery failed
        if (!deviceUrl || deviceUrl === context.deviceUrl) {
          CUIHelpers.printWarning('No MAVLinkBridge devices found on common addresses');
          CUIHelpers.printInfo('Try specifying a device URL manually: connect <device-url>');
          CUIHelpers.printInfo('Common URLs: http://192.168.4.1, http://mavlinkbridge.local');
          
          // Fall back to default URL if no URL provided
          if (!args._args?.[0]) {
            deviceUrl = context.deviceUrl;
            CUIHelpers.printInfo(`Falling back to default URL: ${deviceUrl}`);
          }
        }
      }

      if (!deviceUrl) {
        CUIHelpers.printError('Device URL is required');
        CUIHelpers.printInfo('Usage: connect <device-url> or connect --discover');
        return;
      }

      const spinner = CUIHelpers.startSpinner(`Connecting to ${deviceUrl}...`);

      try {
        const client = new MAVLinkBridgeClient(deviceUrl, { 
          httpTimeout: timeout,
          maxReconnectAttempts: 3,
          reconnectDelay: 2000
        });
        
        if (context.verbose) {
          console.log(chalk.gray(`Attempting to connect to ${deviceUrl} with ${timeout}ms timeout...`));
        }
        
        // Test HTTP connection first with retry logic
        let healthResponse: any;
        let lastError: any;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (context.verbose) {
              console.log(chalk.gray(`  HTTP test attempt ${attempt}/3...`));
            }
            
            healthResponse = await client.getHealth();
            
            if (context.verbose) {
              console.log(chalk.gray(`  ✓ HTTP connection successful`));
              console.log(chalk.gray(`  Response: ${JSON.stringify(healthResponse, null, 2).substring(0, 200)}...`));
            }
            
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error;
            if (context.verbose) {
              console.log(chalk.gray(`  × Attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
            
            if (attempt < 3) {
              const delay = attempt * 2000; // 2s, 4s
              if (context.verbose) {
                console.log(chalk.gray(`  Retrying in ${delay}ms...`));
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (!healthResponse) {
          throw lastError || new Error('Failed to get health response after 3 attempts');
        }
        
        // Then establish WebSocket connection
        if (context.verbose) {
          console.log(chalk.gray('Establishing WebSocket connection...'));
        }
        await client.connect();

        context.client = client;
        context.isConnected = true;
        context.deviceUrl = deviceUrl;

        CUIHelpers.stopSpinner(true, `Connected to ${deviceUrl}`);

        // Show device information
        console.log();
        console.log(chalk.bold('Device Information:'));
        console.log(`  Name: ${healthResponse.device?.name || 'Unknown'}`);
        console.log(`  Status: ${CUIHelpers.formatStatus(healthResponse.status)}`);
        console.log(`  Uptime: ${CUIHelpers.formatUptime(healthResponse.uptime)}`);
        console.log(`  Free Heap: ${CUIHelpers.formatBytes(healthResponse.freeHeap)}`);
        
        if (healthResponse.network?.wifi?.status === 'connected') {
          console.log(`  WiFi: Connected to ${healthResponse.network.wifi.ssid}`);
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to connect to ${deviceUrl}`);
        
        // Enhanced error reporting with debug info
        if (error instanceof HttpError) {
          CUIHelpers.printError(`Connection failed: ${error.message}`);
          
          if (context.verbose) {
            console.log(chalk.gray(`HTTP Status: ${error.status}`));
            console.log(chalk.gray(`Error Type: ${error.isNetworkError() ? 'Network' : error.isClientError() ? 'Client' : 'Server'}`));
          }
          
          if (error.isNetworkError()) {
            console.log();
            console.log(chalk.yellow('Troubleshooting suggestions:'));
            console.log('  • Check that the device is powered on and accessible');
            console.log('  • Verify the device URL is correct');
            console.log('  • Ensure you are connected to the same network as the device');
            console.log('  • Try connecting to the device\'s AP mode: http://192.168.4.1');
            console.log('  • Use --discover flag to automatically find devices');
            console.log('  • Try using --verbose flag for detailed connection logs');
          }
        } else {
          CUIHelpers.printError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        if (context.verbose && error instanceof Error && error.stack) {
          console.log();
          console.log(chalk.gray('Stack trace:'));
          console.log(chalk.gray(error.stack));
        }
        
        throw error;
      }
    }
  };

  // Disconnect command
  const disconnectCommand: Command = {
    name: 'disconnect',
    description: 'Disconnect from the current device',
    category: 'Device',
    aliases: ['dc'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (context.client) {
        context.client.disconnect();
        context.client = null;
        context.isConnected = false;
        context.monitoring = false;
        CUIHelpers.printSuccess('Disconnected from device');
      }
    }
  };

  // Status command
  const statusCommand: Command = {
    name: 'status',
    description: 'Show device status and health information',
    category: 'Device',
    aliases: ['st'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting device status...');

      try {
        const [health, config, wifiStatus] = await Promise.all([
          client.getHealth(),
          client.getConfiguration(),
          client.getWiFiStatus().catch(() => null)
        ]);

        CUIHelpers.stopSpinner(true, 'Status retrieved');

        // Device Health
        console.log();
        console.log(chalk.bold.cyan('Device Health'));
        const healthTable = CUIHelpers.createTable();
        healthTable.push(
          ['Status', CUIHelpers.formatStatus(health.status)],
          ['Uptime', CUIHelpers.formatUptime(health.uptime)],
          ['Free Heap', CUIHelpers.formatBytes(health.freeHeap)]
        );
        
        if (context.verbose) {
          healthTable.push(['Device URL', context.deviceUrl]);
          healthTable.push(['Response Time', `${Date.now() - Date.now()}ms`]);
        }
        
        console.log(healthTable.toString());

        // Device Configuration
        console.log();
        console.log(chalk.bold.cyan('Device Configuration'));
        const configTable = CUIHelpers.createTable();
        configTable.push(
          ['Device Name', config.device.name],
          ['Device Mode', config.device.mode],
          ['Connection Type', config.connection.type]
        );
        console.log(configTable.toString());

        // WiFi Status
        if (wifiStatus) {
          console.log();
          console.log(chalk.bold.cyan('WiFi Status'));
          const wifiTable = CUIHelpers.createTable();
          wifiTable.push(
            ['State', CUIHelpers.formatStatus(wifiStatus.state)],
            ['Connected', CUIHelpers.formatBoolean(wifiStatus.connected)]
          );

          if (wifiStatus.connected && wifiStatus.ssid) {
            wifiTable.push(
              ['SSID', wifiStatus.ssid],
              ['IP Address', wifiStatus.ip || 'N/A'],
              ['Signal Strength', wifiStatus.rssi ? CUIHelpers.formatSignalStrength(wifiStatus.rssi) : 'N/A']
            );
          }

          if (wifiStatus.apMode) {
            wifiTable.push(
              ['AP Mode', CUIHelpers.formatBoolean(true)],
              ['AP SSID', wifiStatus.apSSID || 'N/A'],
              ['AP IP', wifiStatus.apIP || 'N/A'],
              ['Connected Clients', String(wifiStatus.connectedClients || 0)]
            );
          }

          console.log(wifiTable.toString());
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get device status');
        throw error;
      }
    }
  };

  // Ping command
  const pingCommand: Command = {
    name: 'ping',
    description: 'Ping the device to test connectivity',
    category: 'Device',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const start = Date.now();
      const spinner = CUIHelpers.startSpinner('Pinging device...');

      try {
        const isAlive = await client.ping();
        const duration = Date.now() - start;

        if (isAlive) {
          CUIHelpers.stopSpinner(true, `Pong! Response time: ${duration}ms`);
        } else {
          CUIHelpers.stopSpinner(false, 'Device did not respond');
        }
      } catch (error) {
        const duration = Date.now() - start;
        CUIHelpers.stopSpinner(false, `Ping failed after ${duration}ms`);
        throw error;
      }
    }
  };

  // Test command for detailed connection diagnostics
  const testCommand: Command = {
    name: 'test',
    description: 'Run comprehensive connection tests',
    category: 'Device',
    usage: 'test [device-url]',
    examples: [
      'test',
      'test http://192.168.4.1',
      'test --verbose'
    ],
    execute: async (context: CommandContext, args: CommandArgs) => {
      const testUrl = args._args?.[0] || context.deviceUrl;
      
      console.log(chalk.bold.cyan('Running Connection Diagnostics'));
      console.log(chalk.gray('='.repeat(50)));
      console.log();
      
      // Test 1: Basic connectivity
      console.log(chalk.bold('1. Basic Connectivity Test'));
      try {
        const client = new MAVLinkBridgeClient(testUrl, { httpTimeout: 5000 });
        const httpClient = (client as any).httpClient;
        
        const diagnostics = await httpClient.getDiagnostics();
        
        console.log(`  URL: ${testUrl}`);
        console.log(`  Reachable: ${diagnostics.reachable ? chalk.green('✓') : chalk.red('✗')}`);
        if (diagnostics.responseTime) {
          console.log(`  Response Time: ${diagnostics.responseTime}ms`);
        }
        if (diagnostics.statusCode) {
          console.log(`  Status Code: ${diagnostics.statusCode}`);
        }
        if (diagnostics.activeRequests !== undefined) {
          console.log(`  Active Requests: ${diagnostics.activeRequests}`);
        }
        if (diagnostics.error) {
          console.log(`  Error: ${chalk.red(diagnostics.error)}`);
        }
      } catch (error) {
        console.log(`  ${chalk.red('✗')} Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log();
      
      // Test 2: Health endpoint
      console.log(chalk.bold('2. Health Endpoint Test'));
      try {
        const client = new MAVLinkBridgeClient(testUrl, { httpTimeout: 10000 });
        const start = Date.now();
        const health = await client.getHealth();
        const duration = Date.now() - start;
        
        if (health.status === 'degraded') {
          console.log(`  ${chalk.yellow('⚠')} Health check successful - Device is in degraded state (${duration}ms)`);
          if (health.issues && health.issues.length > 0) {
            console.log(`  Issues: ${health.issues.join(', ')}`);
          }
        } else {
          console.log(`  ${chalk.green('✓')} Health check successful (${duration}ms)`);
        }
        
        console.log(`  Device Name: ${health.device?.name || 'Unknown'}`);
        console.log(`  Status: ${health.status || 'Unknown'}`);
        console.log(`  Free Heap: ${CUIHelpers.formatBytes(health.freeHeap || 0)}`);
        
        if (context.verbose) {
          console.log(`  Response: ${JSON.stringify(health, null, 2).substring(0, 200)}...`);
        }
      } catch (error) {
        console.log(`  ${chalk.red('✗')} Health check failed`);
        if (error instanceof HttpError) {
          console.log(`  Error: ${error.getUserFriendlyMessage()}`);
          console.log(`  Status: ${error.status}`);
        } else {
          console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      console.log();
      
      // Test 3: WebSocket connection
      console.log(chalk.bold('3. WebSocket Connection Test'));
      try {
        const client = new MAVLinkBridgeClient(testUrl, { 
          httpTimeout: 5000,
          autoConnectWebSocket: false
        });
        
        const start = Date.now();
        await client.connectWebSocket();
        const duration = Date.now() - start;
        
        console.log(`  ${chalk.green('✓')} WebSocket connected (${duration}ms)`);
        console.log(`  State: ${client.getConnectionState()}`);
        
        client.disconnect();
      } catch (error) {
        console.log(`  ${chalk.red('✗')} WebSocket connection failed`);
        console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log();
      console.log(chalk.gray('='.repeat(50)));
      console.log(chalk.bold('Test Complete'));
    }
  };

  // Info command
  const infoCommand: Command = {
    name: 'info',
    description: 'Show detailed device information',
    category: 'Device',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting device information...');

      try {
        const [config, health, systemHealth] = await Promise.all([
          client.getConfiguration(),
          client.getHealth(),
          client.getSystemHealth().catch(() => null)
        ]);

        CUIHelpers.stopSpinner(true, 'Device information retrieved');

        console.log();
        console.log(chalk.bold.blue('═'.repeat(60)));
        console.log(chalk.bold.blue('  MAVLINKBRIDGE DEVICE INFORMATION'));
        console.log(chalk.bold.blue('═'.repeat(60)));

        // Basic Device Info
        console.log();
        console.log(chalk.bold.cyan('Device Details'));
        const deviceTable = CUIHelpers.createTable();
        deviceTable.push(
          ['Device Name', config.device.name],
          ['Device Mode', config.device.mode],
          ['Device URL', context.deviceUrl],
          ['Connection Type', config.connection.type],
          ['API Version', 'v1.0.0'] // TODO: Get from device
        );
        console.log(deviceTable.toString());

        // System Health
        if (systemHealth) {
          console.log();
          console.log(chalk.bold.cyan('System Health'));
          const healthTable = CUIHelpers.createTable();
          healthTable.push(
            ['Overall Status', CUIHelpers.formatStatus(systemHealth.overall?.status || 'unknown')],
            ['Memory Status', CUIHelpers.formatStatus(systemHealth.memory?.status || 'unknown')],
            ['Task Status', CUIHelpers.formatStatus(systemHealth.tasks.length > 0 ? 'OK' : 'No tasks')],
            ['Component Status', CUIHelpers.formatStatus(systemHealth.components.length > 0 ? 'OK' : 'No components')]
          );
          console.log(healthTable.toString());
        }

        // Memory Information
        console.log();
        console.log(chalk.bold.cyan('Memory Information'));
        const memoryTable = CUIHelpers.createTable();
        memoryTable.push(
          ['Free Heap', CUIHelpers.formatBytes(health.freeHeap)]
        );
        console.log(memoryTable.toString());

        // Connection Configuration
        console.log();
        console.log(chalk.bold.cyan('Connection Configuration'));
        const connTable = CUIHelpers.createTable();
        connTable.push(['Type', config.connection.type]);

        if (config.connection.wifi) {
          connTable.push(
            ['WiFi SSID', config.connection.wifi.ssid || 'Not set'],
            ['WiFi Auto-Connect', CUIHelpers.formatBoolean(config.connection.wifi.autoConnect)]
          );
        }
        console.log(connTable.toString());

        // RTCM Configuration
        if (config.rtcm) {
          console.log();
          console.log(chalk.bold.cyan('RTCM Configuration'));
          const rtcmTable = CUIHelpers.createTable();
          rtcmTable.push(
            ['RTCM Enabled', CUIHelpers.formatBoolean(config.rtcm.enabled)],
            ['Source Type', config.rtcm.source?.type || 'Not configured'],
            ['Host', config.rtcm.source?.host || 'Not configured'],
            ['Port', config.rtcm.source?.port?.toString() || 'Not configured']
          );

          if (config.rtcm.source?.mountpoint) {
            rtcmTable.push(['Mountpoint', config.rtcm.source.mountpoint]);
          }

          console.log(rtcmTable.toString());
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get device information');
        throw error;
      }
    }
  };

  // Discover command
  const discoverCommand: Command = {
    name: 'discover',
    description: 'Search for MAVLinkBridge devices on common addresses',
    category: 'Device',
    aliases: ['scan', 'find'],
    usage: 'discover',
    examples: [
      'discover'
    ],
    execute: async (context: CommandContext, args: CommandArgs) => {
      const spinner = CUIHelpers.startSpinner('Scanning common addresses for MAVLinkBridge devices...');

      try {
        let foundUrl: string | null;
        
        if (context.verbose) {
          console.log(chalk.cyan('Starting comprehensive device discovery...'));
          foundUrl = await tryDiscoverDevice(true);
        } else {
          foundUrl = await tryDiscoverDevice(false);
        }

        if (foundUrl) {
          CUIHelpers.stopSpinner(true, `Found device at ${foundUrl}`);
          
          // Get device info
          try {
            const client = new MAVLinkBridgeClient(foundUrl, { httpTimeout: 10000 });
            const health = await client.getHealth();
            
            console.log();
            console.log(chalk.bold('Device Found:'));
            const table = CUIHelpers.createTable();
            table.push([
              chalk.bold('Property'),
              chalk.bold('Value')
            ]);
            
            table.push(['Name', health.device?.name || 'Unknown']);
            table.push(['URL', foundUrl]);
            table.push(['Status', CUIHelpers.formatStatus(health.status)]);
            table.push(['Uptime', CUIHelpers.formatUptime(health.uptime)]);
            table.push(['Free Heap', CUIHelpers.formatBytes(health.freeHeap)]);
            
            if (health.network?.wifi?.status === 'connected') {
              table.push(['WiFi Network', health.network.wifi.ssid || 'Unknown']);
            }
            
            if (context.verbose) {
              table.push(['MAC Address', health.network?.macAddress || 'Unknown']);
              table.push(['Device Model', health.device?.chipModel || 'Unknown']);
            }
            
            console.log(table.toString());
            
            console.log();
            console.log('To connect to this device, use:');
            console.log(chalk.cyan(`  connect ${foundUrl}`));
            
          } catch (error) {
            console.log();
            console.log(`Device URL: ${foundUrl}`);
            console.log('Device responds to ping but full health check failed.');
            console.log('Use the connect command to establish a full connection.');
            
            if (context.verbose) {
              console.log(chalk.gray(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
          
        } else {
          CUIHelpers.stopSpinner(false, 'No devices found');
          CUIHelpers.printWarning('No MAVLinkBridge devices found on common addresses');
          console.log();
          console.log(chalk.gray('Searched addresses:'));
          console.log(chalk.gray('  • http://192.168.4.1 (AP mode)'));
          console.log(chalk.gray('  • http://mavlinkbridge.local'));
          console.log(chalk.gray('  • http://esp32-mavlinkbridge.local'));
          console.log(chalk.gray('  • http://yardrover.local'));
          console.log(chalk.gray('  • http://192.168.1.100'));
          console.log(chalk.gray('  • http://192.168.1.200'));
          console.log();
          console.log(chalk.gray('Make sure:'));
          console.log(chalk.gray('  • Device is powered on and accessible'));
          console.log(chalk.gray('  • You are connected to the same network'));
          console.log(chalk.gray('  • Device is running MAVLinkBridge firmware'));
          console.log();
          console.log('If your device uses a different address, use:');
          console.log(chalk.cyan('  connect <device-url>'));
          console.log();
          console.log('For detailed discovery logs, use:');
          console.log(chalk.cyan('  discover --verbose'));
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Discovery failed');
        CUIHelpers.printError(`Discovery error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (context.verbose && error instanceof Error && error.stack) {
          console.log();
          console.log(chalk.gray('Stack trace:'));
          console.log(chalk.gray(error.stack));
        }
        
        throw error;
      }
    }
  };

  // Quick status command for testing responsiveness
  const quickStatusCommand: Command = {
    name: 'quick',
    description: 'Quick status check without blocking operations',
    category: 'Device',
    aliases: ['q'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      console.log(`Connected: ${context.isConnected ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`Device URL: ${context.deviceUrl}`);
      console.log(`WebSocket: ${context.client?.getConnectionState() || 'unknown'}`);
      console.log(`Active Requests: ${context.client?.getActiveRequestCount() || 0}`);
      console.log(`Monitoring: ${context.monitoring ? chalk.yellow('ON') : chalk.gray('OFF')}`);
    }
  };

  // Register all commands
  registry.register(connectCommand);
  registry.register(disconnectCommand);
  registry.register(statusCommand);
  registry.register(pingCommand);
  registry.register(infoCommand);
  registry.register(discoverCommand);
  registry.register(testCommand);
  registry.register(quickStatusCommand);
}