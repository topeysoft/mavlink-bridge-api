import chalk from 'chalk';
import ora from 'ora';
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class DeviceCommands {
  private errorHandler: ErrorHandler;

  constructor(
    private context: ConsoleContext,
    private clientManager: ClientManager,
    private uiHelpers: UIHelpers
  ) {
    this.errorHandler = new ErrorHandler(uiHelpers);
  }

  public async discoverDevices (): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Device Discovery'));
    this.uiHelpers.displaySeparator();

    const devices = await this.clientManager.discoverDevices();

    if (devices.length === 0) {
      this.uiHelpers.displayWarning('No devices discovered');
      return;
    }

    console.log(chalk.green(`\nFound ${devices.length} potential device(s):`));

    const table = this.uiHelpers.createTable(['#', 'Device URL', 'Type']);
    devices.forEach((device, index) => {
      let type = 'Unknown';
      if (device.includes('192.168.4.1')) type = 'AP Mode';
      else if (device.includes('.local')) type = 'mDNS';
      else type = 'Network';

      table.push([
        (index + 1).toString(),
        device,
        type
      ]);
    });

    console.log(table.toString());

    const connectNow = await this.uiHelpers.confirmAction(
      'Would you like to connect to one of these devices?',
      true
    );

    if (connectNow) {
      const selectedDevice = await this.uiHelpers.selectFromList(
        'Select a device to connect to:',
        devices.map(device => ({ name: device, value: device }))
      );

      await this.connectToSpecificDevice(selectedDevice);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async connectToDevice (): Promise<void> {
    console.log(chalk.blue.bold('\n🔌 Connect to Device'));
    this.uiHelpers.displaySeparator();

    const deviceUrl = await this.uiHelpers.getTextInput(
      'Enter device URL (e.g., http://192.168.4.1):',
      'http://192.168.4.1',
      (input: string) => {
        if (!input.trim()) {
          return { valid: false, error: 'URL cannot be empty' };
        }

        try {
          new URL(input);
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid URL format', suggestion: 'Use format: http://192.168.4.1' };
        }
      }
    );

    await this.connectToSpecificDevice(deviceUrl);
    await this.uiHelpers.pressAnyKey();
  }

  private async connectToSpecificDevice(deviceUrl: string): Promise<void> {
    const spinner = ora('Connecting to device...').start();
    
    try {
      // Use retry logic for connection attempts
      const success = await this.errorHandler.withRetry(
        () => this.clientManager.connect(deviceUrl),
        {
          maxAttempts: 3,
          delayMs: 2000,
          backoffMultiplier: 1.5,
          retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED']
        },
        { operation: 'Device Connection', component: 'ClientManager' }
      );

      if (success) {
        spinner.succeed('Connection established successfully!');
        console.log(chalk.green('\n✅ Connected to device!'));

        // Show basic device info after connection with enhanced error handling
        try {
          const client = this.clientManager.getClient();
          if (client) {
            const health = await this.errorHandler.withRetry(
              () => client.health.getSystemHealth(),
              {
                maxAttempts: 2,
                delayMs: 1000,
                retryableErrors: ['timeout', 'temporary']
              },
              { operation: 'Health Check', component: 'HealthClient' }
            );

            console.log(chalk.blue('\n📊 Device Information:'));
            this.uiHelpers.displayKeyValuePairs({
              'Device URL': deviceUrl,
              'Status': health.systemHealthy ? 'Healthy' : 'Unhealthy',
              'Uptime': this.uiHelpers.formatDuration(health.uptime || 0),
              'Free Memory': this.uiHelpers.formatBytes(health.freeHeap || 0),
              'CPU Usage': health.cpuUsage ? `${health.cpuUsage.toFixed(1)}%` : 'N/A'
            });
          }
        } catch (error) {
          spinner.warn('Connected but could not retrieve device info');
          this.errorHandler.handleError(error, {
            operation: 'Post-connection Health Check',
            component: 'HealthClient'
          });
        }
      } else {
        spinner.fail('Connection failed');
        this.errorHandler.handleConnectionError(
          new Error('Connection attempt returned false'),
          { operation: 'Device Connection', component: 'ClientManager' }
        );
      }
    } catch (error) {
      spinner.fail('Connection failed');
      this.errorHandler.handleConnectionError(error, {
        operation: 'Device Connection',
        component: 'ClientManager',
        details: { deviceUrl }
      });
    }
  }

  public async testConnection (): Promise<void> {
    console.log(chalk.blue.bold('\n🧪 Connection Test'));
    this.uiHelpers.displaySeparator();

    if (!this.context.connected) {
      this.uiHelpers.displayError('No device connected');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const success = await this.clientManager.testConnection();

    if (!success) {
      this.uiHelpers.displayError('Connection test failed. You may need to reconnect.');
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async showDeviceInfo (): Promise<void> {
    console.log(chalk.blue.bold('\n📱 Device Information'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const spinner = ora('Retrieving device information...').start();

    try {
      const healthCheck = await client.health.getHealthCheck();

      spinner.succeed('Device information retrieved');

      console.log(chalk.green('\n🔧 System Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'Device Name': healthCheck.device.name || 'YardRover Device',
        'Hostname': healthCheck.device.hostname || 'N/A',
        'Hardware': healthCheck.device.chipModel || 'ESP32',
        'Chip Revision': healthCheck.device.chipRevision?.toString() || 'N/A',
        'SDK Version': healthCheck.device.sdkVersion || 'N/A',
        'Flash Size': this.uiHelpers.formatBytes(healthCheck.device.flashSize || 0),
        'Core Count': healthCheck.device.coreCount?.toString() || 'N/A'
      });

      console.log(chalk.green('\n🌐 Network Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'MAC Address': healthCheck.network.macAddress || 'N/A',
        'AP MAC Address': healthCheck.network.apMacAddress || 'N/A',
        'WiFi Status': healthCheck.network.wifi.status || 'N/A',
        'WiFi SSID': healthCheck.network.wifi.ssid || 'Not connected',
        'WiFi IP': healthCheck.network.wifi.ip || 'N/A'
      });

      console.log(chalk.green('\n📊 System Health:'));
      this.uiHelpers.displayKeyValuePairs({
        'Overall Status': healthCheck.status === 'healthy' ? 'Healthy' : 'Degraded',
        'System Healthy': healthCheck.system?.systemHealthy ? 'Yes' : 'No',
        'Uptime': this.uiHelpers.formatDuration(healthCheck.uptime || 0),
        'Free Heap': this.uiHelpers.formatBytes(healthCheck.freeHeap || 0),
        'CPU Usage': healthCheck.system?.cpuUsage ? `${healthCheck.system.cpuUsage.toFixed(1)}%` : 'N/A',
        'Temperature': healthCheck.system?.temperature ? `${healthCheck.system.temperature.toFixed(1)}°C` : 'N/A',
        'Low Memory Warning': healthCheck.system?.lowMemoryWarning ? 'Yes' : 'No'
      });

      console.log(chalk.green('\n💾 Storage Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'Storage Status': healthCheck.storage.healthy ? 'Healthy' : 'Unhealthy',
        'Total Space': this.uiHelpers.formatBytes(healthCheck.storage.totalBytes),
        'Used Space': this.uiHelpers.formatBytes(healthCheck.storage.usedBytes),
        'Free Space': this.uiHelpers.formatBytes(healthCheck.storage.freeBytes),
        'Usage': `${((healthCheck.storage.usedBytes / healthCheck.storage.totalBytes) * 100).toFixed(1)}%`
      });

      console.log(chalk.green('\n⚙️  Configuration:'));
      this.uiHelpers.displayKeyValuePairs({
        'Config Version': healthCheck.config.version.toString(),
        'Config Status': healthCheck.config.isDirty ? 'Modified (unsaved)' : 'Saved'
      });

      if (healthCheck.issues && healthCheck.issues.length > 0) {
        console.log(chalk.yellow('\n⚠️  Issues Detected:'));
        healthCheck.issues.forEach(issue => {
          console.log(chalk.red(`• ${issue.replace(/_/g, ' ').toUpperCase()}`));
        });
      }

      if (healthCheck.system?.components && healthCheck.system.components.length > 0) {
        console.log(chalk.green('\n🔧 Component Status:'));
        const componentTable = this.uiHelpers.createTable(['Component', 'Status', 'Message']);

        healthCheck.system.components.forEach(component => {
          const statusIcon = component.healthy ? '✅' : '❌';
          componentTable.push([
            component.name,
            `${statusIcon} ${component.healthy ? 'Healthy' : 'Error'}`,
            component.message || 'N/A'
          ]);
        });

        console.log(componentTable.toString());
      }

    } catch (error) {
      spinner.fail('Failed to retrieve device information');
      this.errorHandler.handleApiError(error, {
        operation: 'Device Information Retrieval',
        component: 'HealthClient',
        details: { method: 'getHealthCheck' }
      });
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async showSystemHealth (): Promise<void> {
    console.log(chalk.blue.bold('\n💚 System Health Status'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const spinner = ora('Checking system health...').start();

    try {
      const health = await client.health.getSystemHealth();
      spinner.succeed('System health retrieved');

      // Overall status
      const statusIcon = health.systemHealthy ? '🟢' : '🔴';
      console.log(`\n${statusIcon} Overall Status: ${chalk.bold(health.systemHealthy ? 'HEALTHY' : 'UNHEALTHY')}`);

      // Key metrics
      console.log(chalk.blue('\n📈 Key Metrics:'));
      this.uiHelpers.displayKeyValuePairs({
        'Uptime': this.uiHelpers.formatDuration(health.uptime || 0),
        'Free Memory': this.uiHelpers.formatBytes(health.freeHeap || 0),
        'CPU Usage': health.cpuUsage ? `${health.cpuUsage.toFixed(1)}%` : 'N/A',
        'Temperature': health.temperature ? `${health.temperature.toFixed(1)}°C` : 'N/A'
      });

      // Component health
      if (health.components && health.components.length > 0) {
        console.log(chalk.blue('\n🔧 Component Status:'));
        const componentTable = this.uiHelpers.createTable(['Component', 'Status', 'Details']);

        health.components.forEach(component => {
          const statusIcon = component.healthy ? '✅' : '❌';
          componentTable.push([
            component.name,
            `${statusIcon} ${component.healthy ? 'Healthy' : 'Error'}`,
            component.message || 'N/A'
          ]);
        });

        console.log(componentTable.toString());
      }

    } catch (error) {
      spinner.fail('Failed to retrieve system health');
      this.uiHelpers.displayError('Could not get system health', error);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async showSystemMetrics (): Promise<void> {
    console.log(chalk.blue.bold('\n📊 System Metrics'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    try {
      const metrics = await client.health.getSystemMetrics();

      console.log(chalk.green('\n💾 Memory Statistics:'));
      this.uiHelpers.displayKeyValuePairs({
        'Total Heap': this.uiHelpers.formatBytes(metrics.memory.totalHeap),
        'Free Heap': this.uiHelpers.formatBytes(metrics.memory.freeHeap),
        'Min Free Heap': this.uiHelpers.formatBytes(metrics.memory.minFreeHeap),
        'Max Alloc Heap': this.uiHelpers.formatBytes(metrics.memory.maxAllocHeap || 0)
      });

      console.log(chalk.green('\n⚙️  System Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'CPU Usage': metrics.health.cpuUsage ? `${metrics.health.cpuUsage.toFixed(1)}%` : 'N/A',
        'Temperature': metrics.health.temperature ? `${metrics.health.temperature.toFixed(1)}°C` : 'N/A',
        'System Healthy': metrics.health.systemHealthy ? 'Yes' : 'No'
      });

    } catch (error) {
      this.uiHelpers.displayError('Could not retrieve system metrics', error);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async startMonitoring (): Promise<void> {
    console.log(chalk.blue.bold('\n📡 Real-time Monitoring'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    console.log(chalk.yellow('Starting real-time monitoring...'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));

    let monitoring = true;

    // Handle Ctrl+C gracefully
    const originalHandler = process.on('SIGINT', () => {
      monitoring = false;
      console.log(chalk.yellow('\n\nMonitoring stopped by user'));
    });

    try {
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;

      while (monitoring) {
        try {
          const health = await client.health.getSystemHealth();

          // Reset error counter on successful request
          consecutiveErrors = 0;

          // Clear previous output and show current stats
          console.clear();
          console.log(chalk.cyan.bold('📡 Real-time System Monitoring'));
          console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}\n`));

          this.uiHelpers.displayKeyValuePairs({
            'Status': health.systemHealthy ? 'Healthy' : 'Unhealthy',
            'Uptime': this.uiHelpers.formatDuration(health.uptime || 0),
            'Free Memory': this.uiHelpers.formatBytes(health.freeHeap || 0),
            'CPU Usage': health.cpuUsage ? `${health.cpuUsage.toFixed(1)}%` : 'N/A',
            'Temperature': health.temperature ? `${health.temperature.toFixed(1)}°C` : 'N/A'
          });

          console.log(chalk.gray('\nPress Ctrl+C to stop monitoring...'));

        } catch (error) {
          consecutiveErrors++;
          
          console.clear();
          console.log(chalk.cyan.bold('📡 Real-time System Monitoring'));
          console.log(chalk.red(`⚠️  Connection error (${consecutiveErrors}/${maxConsecutiveErrors})`));
          console.log(chalk.gray(`Last attempt: ${new Date().toLocaleTimeString()}\n`));
          
          this.errorHandler.handleError(error, {
            operation: 'Real-time Health Monitoring',
            component: 'HealthClient'
          });

          // Stop monitoring if too many consecutive errors
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.log(chalk.red('\n❌ Too many consecutive errors. Stopping monitoring.'));
            monitoring = false;
            break;
          }

          console.log(chalk.yellow(`\nRetrying in 5 seconds... (Press Ctrl+C to stop)`));
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Wait 2 seconds before next update
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.errorHandler.handleError(error, {
        operation: 'Real-time Monitoring Setup',
        component: 'DeviceCommands'
      });
    } finally {
      // Restore original signal handler
      process.removeListener('SIGINT', originalHandler as any);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async viewLogs (): Promise<void> {
    console.log(chalk.blue.bold('\n📋 System Logs'));
    this.uiHelpers.displaySeparator();

    console.log(chalk.yellow('Live log streaming is available through WebSocket events.'));
    console.log(chalk.gray('Enable debug mode in Tools menu to see real-time logs.'));

    await this.uiHelpers.pressAnyKey();
  }

  public async disconnect (): Promise<void> {
    console.log(chalk.blue.bold('\n🔌 Disconnect Device'));
    this.uiHelpers.displaySeparator();

    if (!this.context.connected) {
      this.uiHelpers.displayWarning('No device currently connected');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const confirmed = await this.uiHelpers.confirmAction(
      `Disconnect from ${this.context.deviceUrl}?`,
      true
    );

    if (confirmed) {
      await this.clientManager.disconnect();
      this.uiHelpers.displaySuccess('Disconnected successfully');
    }

    await this.uiHelpers.pressAnyKey();
  }
}