import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';
import { MAVLinkBridgeClient } from '../../MAVLinkBridgeClient';

export function registerDeviceCommands (registry: CommandRegistry): void {
  // Connect command
  const connectCommand: Command = {
    name: 'connect',
    description: 'Connect to a MAVLinkBridge device',
    category: 'Device',
    usage: 'connect <device-url> [--timeout=5000]',
    examples: [
      'connect http://192.168.4.1',
      'connect http://192.168.1.100:8080 --timeout=10000'
    ],
    execute: async (context: CommandContext, args: CommandArgs) => {
      const deviceUrl = args._args?.[0] || context.deviceUrl;
      const timeout = args.timeout || 5000;

      if (!deviceUrl) {
        CUIHelpers.printError('Device URL is required');
        return;
      }

      const spinner = CUIHelpers.startSpinner(`Connecting to ${deviceUrl}...`);

      try {
        const client = new MAVLinkBridgeClient(deviceUrl, { httpTimeout: timeout });
        await client.connect();

        // Test connection with a health check
        const health = await client.getHealth();

        context.client = client;
        context.isConnected = true;
        context.deviceUrl = deviceUrl;

        CUIHelpers.stopSpinner(true, `Connected to ${deviceUrl}`);

        // Show basic device info
        console.log();
        console.log(chalk.bold('Device Information:'));
        console.log(`  Status: ${CUIHelpers.formatStatus(health.status)}`);
        console.log(`  Uptime: ${CUIHelpers.formatUptime(health.uptime)}`);
        console.log(`  Free Heap: ${CUIHelpers.formatBytes(health.freeHeap)}`);

      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to connect to ${deviceUrl}`);
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

  // Register all commands
  registry.register(connectCommand);
  registry.register(disconnectCommand);
  registry.register(statusCommand);
  registry.register(pingCommand);
  registry.register(infoCommand);
}