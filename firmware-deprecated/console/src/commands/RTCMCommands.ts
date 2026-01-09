import chalk from 'chalk';
import ora from 'ora';
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';

export class RTCMCommands {
  constructor(
    private context: ConsoleContext,
    private clientManager: ClientManager,
    private uiHelpers: UIHelpers
  ) { }

  public async viewStatus(): Promise<void> {
    console.log(chalk.blue.bold('\n🛰️  RTCM Status'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const spinner = ora('Fetching RTCM status...').start();

    try {
      const status = await client.rtcm.getStatus();
      spinner.succeed('RTCM status retrieved');

      const statusIcon = status.connected ? '🟢' : '🔴';
      console.log(`\n${statusIcon} RTCM Client Status: ${chalk.bold(status.state?.toUpperCase() || 'UNKNOWN')}`);

      console.log(chalk.blue('\n📊 Connection Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'Running': status.running ? 'Yes' : 'No',
        'Connected': status.connected ? 'Yes' : 'No',
        'Client Type': status.clientType || 'N/A',
        'Uptime': status.uptime ? this.uiHelpers.formatDuration(status.uptime) : 'N/A'
      });

      if (status.statistics) {
        console.log(chalk.blue('\n📈 Statistics:'));
        this.uiHelpers.displayKeyValuePairs({
          'Messages Received': status.statistics.messagesReceived.toString(),
          'Bytes Received': this.uiHelpers.formatBytes(status.statistics.bytesReceived),
          'Data Rate': `${status.statistics.dataRate.toFixed(2)} KB/s`,
          'CRC Errors': status.statistics.crcErrors.toString(),
          'Last Message': status.statistics.lastMessageTime
            ? new Date(status.statistics.lastMessageTime).toLocaleTimeString()
            : 'Never'
        });

        if (status.statistics.messageTypes && Object.keys(status.statistics.messageTypes).length > 0) {
          console.log(chalk.blue('\n📡 Message Type Breakdown:'));
          const messageTable = this.uiHelpers.createTable(['Type ID', 'Count']);

          Object.entries(status.statistics.messageTypes).forEach(([type, count]) => {
            messageTable.push([type, count.toString()]);
          });

          console.log(messageTable.toString());
        }
      }

    } catch (error) {
      spinner.fail('Failed to retrieve RTCM status');
      console.error('Full error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      this.uiHelpers.displayError('Could not get RTCM status', error);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async startClient(): Promise<void> {
    console.log(chalk.blue.bold('\n▶️  Start RTCM Client'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    try {
      // Get current configuration
      const config = await client.getConfiguration();

      console.log(chalk.yellow('Current RTCM Configuration:'));
      this.uiHelpers.displayKeyValuePairs({
        'Enabled': config.rtcm.enabled ? 'Yes' : 'No',
        'Type': config.rtcm.source.type,
        'Host': config.rtcm.source.host || 'Not configured',
        'Port': config.rtcm.source.port?.toString() || 'Not configured'
      });

      const useCurrentConfig = await this.uiHelpers.confirmAction(
        'Use current configuration to start RTCM client?',
        true
      );

      if (!useCurrentConfig) {
        await this.configureAndStart(client);
        return;
      }

      // Start with current config
      const spinner = ora('Starting RTCM client...').start();

      const response = await client.rtcm.start({
        enabled: true,
        source: config.rtcm.source as any
      });

      if (response.success) {
        spinner.succeed('RTCM client started successfully');
        this.uiHelpers.displaySuccess('RTCM client is now running');
      } else {
        spinner.fail('Failed to start RTCM client');
        this.uiHelpers.displayError(response.error || 'Unknown error');
      }

    } catch (error) {
      this.uiHelpers.displayError('Could not start RTCM client', error);
    }

    await this.uiHelpers.pressAnyKey();
  }

  private async configureAndStart(client: any): Promise<void> {
    console.log(chalk.blue('\n⚙️  Configure RTCM Client'));

    const sourceType = await this.uiHelpers.selectFromList<'tcp' | 'ntrip' | 'udp'>(
      'Select RTCM source type:',
      [
        { name: 'TCP - Direct TCP connection', value: 'tcp' },
        { name: 'NTRIP - Network Transport of RTCM via Internet Protocol', value: 'ntrip' },
        { name: 'UDP - User Datagram Protocol', value: 'udp' }
      ]
    );

    let sourceConfig: any = { type: sourceType };

    if (sourceType === 'tcp') {
      const host = await this.uiHelpers.getTextInput(
        'Enter TCP host (IP address):',
        '192.168.1.100'
      );
      const port = await this.uiHelpers.getNumberInput(
        'Enter TCP port:',
        2101,
        1,
        65535
      );

      sourceConfig = { type: 'tcp', host, port };

    } else if (sourceType === 'ntrip') {
      const host = await this.uiHelpers.getTextInput(
        'Enter NTRIP caster host:',
        'rtk2go.com'
      );
      const port = await this.uiHelpers.getNumberInput(
        'Enter NTRIP port:',
        2101,
        1,
        65535
      );
      const mountpoint = await this.uiHelpers.getTextInput(
        'Enter mountpoint:',
        'MOUNT'
      );

      const needsAuth = await this.uiHelpers.confirmAction(
        'Does this NTRIP caster require authentication?',
        false
      );

      sourceConfig = { type: 'ntrip', host, port, mountpoint };

      if (needsAuth) {
        const username = await this.uiHelpers.getTextInput('Enter username:');
        const password = await this.uiHelpers.getTextInput('Enter password:');
        sourceConfig.username = username;
        sourceConfig.password = password;
      }

    } else if (sourceType === 'udp') {
      const port = await this.uiHelpers.getNumberInput(
        'Enter UDP listen port:',
        14550,
        1,
        65535
      );

      sourceConfig = { type: 'udp', port };
    }

    const spinner = ora('Starting RTCM client with new configuration...').start();

    try {
      const response = await client.rtcm.start({
        enabled: true,
        source: sourceConfig
      });

      if (response.success) {
        spinner.succeed('RTCM client started successfully');
        this.uiHelpers.displaySuccess('RTCM client is now running with new configuration');
      } else {
        spinner.fail('Failed to start RTCM client');
        this.uiHelpers.displayError(response.error || 'Unknown error');

        if (response.errors) {
          console.log(chalk.red('\nValidation errors:'));
          Object.entries(response.errors).forEach(([field, error]) => {
            console.log(chalk.red(`  • ${field}: ${error}`));
          });
        }
      }
    } catch (error) {
      spinner.fail('Failed to start RTCM client');
      this.uiHelpers.displayError('Could not start RTCM client', error);
    }
  }

  public async stopClient(): Promise<void> {
    console.log(chalk.blue.bold('\n⏹️  Stop RTCM Client'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const confirmed = await this.uiHelpers.confirmAction(
      'Stop the RTCM client?',
      false
    );

    if (!confirmed) {
      this.uiHelpers.displayInfo('Operation cancelled');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const spinner = ora('Stopping RTCM client...').start();

    try {
      const response = await client.rtcm.stop();

      if (response.success) {
        spinner.succeed('RTCM client stopped');
        this.uiHelpers.displaySuccess('RTCM client has been stopped');
      } else {
        spinner.fail('Failed to stop RTCM client');
        this.uiHelpers.displayError(response.error || 'Unknown error');
      }

    } catch (error) {
      spinner.fail('Failed to stop RTCM client');
      this.uiHelpers.displayError('Could not stop RTCM client', error);
    }

    await this.uiHelpers.pressAnyKey();
  }

  public async monitorRealtime(): Promise<void> {
    console.log(chalk.blue.bold('\n📡 Real-time RTCM Monitoring'));
    this.uiHelpers.displaySeparator();

    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    console.log(chalk.yellow('Starting real-time RTCM monitoring...'));
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
          const status = await client.rtcm.getStatus();

          // Reset error counter on successful request
          consecutiveErrors = 0;

          // Clear previous output and show current stats
          console.clear();
          console.log(chalk.cyan.bold('📡 Real-time RTCM Monitoring'));
          console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}\n`));

          const statusIcon = status.connected ? '🟢' : '🔴';
          this.uiHelpers.displayKeyValuePairs({
            'Status': `${statusIcon} ${status.state?.toUpperCase() || 'UNKNOWN'}`,
            'Client Type': status.clientType || 'N/A',
            'Messages Received': status.statistics?.messagesReceived.toString() || '0',
            'Data Rate': status.statistics?.dataRate ? `${status.statistics.dataRate.toFixed(2)} KB/s` : 'N/A',
            'CRC Errors': status.statistics?.crcErrors.toString() || '0'
          });

          console.log(chalk.gray('\nPress Ctrl+C to stop monitoring...'));

        } catch (error) {
          consecutiveErrors++;

          console.clear();
          console.log(chalk.cyan.bold('📡 Real-time RTCM Monitoring'));
          console.log(chalk.red(`⚠️  Connection error (${consecutiveErrors}/${maxConsecutiveErrors})`));
          console.log(chalk.gray(`Last attempt: ${new Date().toLocaleTimeString()}\n`));

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
      this.uiHelpers.displayError('Monitoring error', error);
    } finally {
      // Restore original signal handler
      process.removeListener('SIGINT', originalHandler as any);
    }

    await this.uiHelpers.pressAnyKey();
  }
}
