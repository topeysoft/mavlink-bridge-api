import chalk from 'chalk';
import ora from 'ora';
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';

export class ConfigCommands {
  constructor(
    private context: ConsoleContext,
    private clientManager: ClientManager,
    private uiHelpers: UIHelpers
  ) {}

  public async viewConfiguration(): Promise<void> {
    console.log(chalk.blue.bold('\n⚙️  Device Configuration'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Loading configuration...').start();
    
    try {
      const config = await client.config.getConfiguration();
      spinner.succeed('Configuration loaded');
      
      console.log(chalk.green('\n🔧 Device Configuration:'));
      
      console.log(chalk.blue('\n📱 Device Settings:'));
      this.uiHelpers.displayKeyValuePairs({
        'Device Name': config.device.name,
        'Operation Mode': config.device.mode,
        'Configuration Version': config.version
      });
      
      console.log(chalk.blue('\n📡 Connection Settings:'));
      this.uiHelpers.displayKeyValuePairs({
        'Connection Type': config.connection.type,
        'WiFi SSID': config.connection.wifi.ssid || 'Not configured',
        'WiFi Auto Connect': config.connection.wifi.autoConnect ? 'Enabled' : 'Disabled'
      });
      
      console.log(chalk.blue('\n🛰️  RTCM Configuration:'));
      this.uiHelpers.displayKeyValuePairs({
        'RTCM Enabled': config.rtcm.enabled ? 'Yes' : 'No',
        'Source Type': config.rtcm.source.type,
        'Host': config.rtcm.source.host || 'Not configured',
        'Port': config.rtcm.source.port
      });
      
    } catch (error) {
      spinner.fail('Failed to load configuration');
      this.uiHelpers.displayError('Could not retrieve configuration', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async editConfiguration(): Promise<void> {
    console.log(chalk.blue.bold('\n✏️  Edit Configuration'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    try {
      const config = await client.config.getConfiguration();
      
      const section = await this.uiHelpers.selectFromList(
        'Which configuration section would you like to edit?',
        [
          { name: '📱 Device Settings', value: 'device' },
          { name: '📡 WiFi Settings', value: 'wifi' },
          { name: '🛰️  RTCM Settings', value: 'rtcm' },
          { name: '🔙 Back', value: 'back' }
        ]
      );
      
      if (section === 'back') return;
      
      switch (section) {
        case 'device':
          await this.editDeviceSettings(client, config);
          break;
        case 'wifi':
          await this.editWiFiSettings(client, config);
          break;
        case 'rtcm':
          await this.editRTCMSettings(client, config);
          break;
      }
      
    } catch (error) {
      this.uiHelpers.displayError('Failed to edit configuration', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async backupConfiguration(): Promise<void> {
    console.log(chalk.blue.bold('\n💾 Backup Configuration'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Creating configuration backup...').start();
    
    try {
      const config = await client.config.getConfiguration();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `config-backup-${timestamp}.json`;
      
      const configJson = JSON.stringify(config, null, 2);
      
      spinner.succeed('Configuration backup created');
      
      console.log(chalk.green('\n📋 Backup Summary:'));
      this.uiHelpers.displayKeyValuePairs({
        'Backup Time': new Date().toISOString(),
        'Device URL': this.context.deviceUrl || 'Unknown',
        'Configuration Version': config.version,
        'Suggested Filename': filename,
        'Backup Size': this.uiHelpers.formatBytes(Buffer.byteLength(configJson, 'utf8'))
      });
      
      console.log(chalk.blue('\n📄 Configuration Data:'));
      console.log(chalk.gray(configJson));
      
      console.log(chalk.yellow('\n💡 Tip: Copy the configuration data above to save as a backup file.'));
      
    } catch (error) {
      spinner.fail('Failed to create backup');
      this.uiHelpers.displayError('Could not backup configuration', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async restoreConfiguration(): Promise<void> {
    console.log(chalk.blue.bold('\n📁 Restore Configuration'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    console.log(chalk.yellow('Please paste your configuration backup JSON data:'));
    const configJson = await this.uiHelpers.getTextInput(
      'Configuration JSON:',
      '',
      (input) => {
        try {
          const parsed = JSON.parse(input);
          if (!parsed.version || !parsed.device) {
            return { valid: false, error: 'Invalid configuration format' };
          }
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid JSON format' };
        }
      }
    );
    
    try {
      const config = JSON.parse(configJson);
      
      console.log(chalk.blue('\n📋 Configuration to restore:'));
      this.uiHelpers.displayKeyValuePairs({
        'Device Name': config.device.name,
        'Version': config.version,
        'Connection Type': config.connection.type
      });
      
      const confirmed = await this.uiHelpers.confirmAction(
        'Are you sure you want to restore this configuration? This will overwrite current settings.',
        false
      );
      
      if (!confirmed) {
        this.uiHelpers.displayInfo('Restore cancelled');
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      const spinner = ora('Restoring configuration...').start();
      
      await client.config.setConfiguration(config);
      
      spinner.succeed('Configuration restored successfully');
      this.uiHelpers.displaySuccess('Configuration has been restored. Device may restart.');
      
    } catch (error) {
      this.uiHelpers.displayError('Failed to restore configuration', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async resetConfiguration(): Promise<void> {
    console.log(chalk.blue.bold('\n🔄 Reset Configuration'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    console.log(chalk.red.bold('⚠️  WARNING: This will reset all configuration to factory defaults!'));
    console.log(chalk.red('• All WiFi networks will be removed'));
    console.log(chalk.red('• All custom settings will be lost'));
    console.log(chalk.red('• Device will restart automatically'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Are you sure you want to reset to factory defaults?',
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Reset cancelled');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const doubleConfirm = await this.uiHelpers.confirmAction(
      'This action cannot be undone. Continue with factory reset?',
      false
    );
    
    if (!doubleConfirm) {
      this.uiHelpers.displayInfo('Reset cancelled');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Resetting to factory defaults...').start();
    
    try {
      await client.config.resetToDefaults();
      
      spinner.succeed('Configuration reset to factory defaults');
      
      this.uiHelpers.displaySuccess('Device has been reset to factory defaults.');
      this.uiHelpers.displayWarning('Device will restart. You may need to reconnect.');
      
      // Clear connection since device will restart
      this.context.connected = false;
      this.context.client = null;
      this.context.deviceUrl = null;
      
    } catch (error) {
      spinner.fail('Failed to reset configuration');
      this.uiHelpers.displayError('Could not reset configuration', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  private async editDeviceSettings(client: any, config: any): Promise<void> {
    console.log(chalk.blue.bold('\n📱 Edit Device Settings'));

    const currentName = config.device.name;
    const currentMode = config.device.mode;

    const action = await this.uiHelpers.selectFromList(
      'What would you like to edit?',
      [
        { name: `Device Name (currently: ${currentName})`, value: 'name' },
        { name: `Operation Mode (currently: ${currentMode})`, value: 'mode' },
        { name: '🔙 Back', value: 'back' }
      ]
    );

    if (action === 'back') return;

    try {
      if (action === 'name') {
        const newName = await this.uiHelpers.getTextInput(
          'Enter new device name:',
          currentName,
          (input) => {
            if (!input.trim()) return { valid: false, error: 'Device name cannot be empty' };
            if (input.length > 32) return { valid: false, error: 'Device name must be 32 characters or less' };
            return { valid: true };
          }
        );

        if (newName !== currentName) {
          const spinner = ora('Updating device name...').start();
          await client.config.updateDeviceName(newName);
          spinner.succeed('Device name updated');
        }
      } else if (action === 'mode') {
        const newMode = await this.uiHelpers.selectFromList(
          'Select operation mode:',
          [
            { name: 'USB OTG Mode', value: 'usb_otg' },
            { name: 'UART Mode', value: 'uart' }
          ]
        );

        if (newMode !== currentMode) {
          const confirmed = await this.uiHelpers.confirmAction(
            'Changing operation mode will restart the device. Continue?',
            false
          );

          if (confirmed) {
            const spinner = ora('Updating operation mode...').start();
            await client.config.updateDeviceMode(newMode);
            spinner.succeed('Operation mode updated');
            this.uiHelpers.displayWarning('Device will restart');
          }
        }
      }
    } catch (error) {
      this.uiHelpers.displayError('Failed to update device settings', error);
    }
  }

  private async editWiFiSettings(client: any, config: any): Promise<void> {
    console.log(chalk.blue.bold('\n📡 Edit WiFi Settings'));

    const currentSSID = config.connection.wifi.ssid;
    const currentAutoConnect = config.connection.wifi.autoConnect;

    const action = await this.uiHelpers.selectFromList(
      'What would you like to edit?',
      [
        { name: `WiFi SSID (currently: ${currentSSID || 'Not set'})`, value: 'ssid' },
        { name: `Auto Connect (currently: ${currentAutoConnect ? 'Enabled' : 'Disabled'})`, value: 'autoconnect' },
        { name: '🔙 Back', value: 'back' }
      ]
    );

    if (action === 'back') return;

    try {
      if (action === 'ssid') {
        const newSSID = await this.uiHelpers.getTextInput(
          'Enter WiFi network name (SSID):',
          currentSSID,
          (input) => {
            if (input.length > 32) return { valid: false, error: 'SSID must be 32 characters or less' };
            return { valid: true };
          }
        );

        if (newSSID !== currentSSID) {
          const spinner = ora('Updating WiFi SSID...').start();
          await client.config.updateWiFiSSID(newSSID);
          spinner.succeed('WiFi SSID updated');
        }
      } else if (action === 'autoconnect') {
        const newAutoConnect = await this.uiHelpers.confirmAction(
          'Enable WiFi auto-connect on startup?',
          currentAutoConnect
        );

        if (newAutoConnect !== currentAutoConnect) {
          const spinner = ora('Updating auto-connect setting...').start();
          await client.config.updateWiFiAutoConnect(newAutoConnect);
          spinner.succeed('Auto-connect setting updated');
        }
      }
    } catch (error) {
      this.uiHelpers.displayError('Failed to update WiFi settings', error);
    }
  }

  private async editRTCMSettings(client: any, config: any): Promise<void> {
    console.log(chalk.blue.bold('\n🛰️ Edit RTCM Settings'));

    const currentEnabled = config.rtcm.enabled;
    const currentType = config.rtcm.source.type;
    const currentHost = config.rtcm.source.host;
    const currentPort = config.rtcm.source.port;

    const action = await this.uiHelpers.selectFromList(
      'What would you like to edit?',
      [
        { name: `RTCM Enabled (currently: ${currentEnabled ? 'Yes' : 'No'})`, value: 'enabled' },
        { name: `Source Type (currently: ${currentType})`, value: 'type' },
        { name: `Host (currently: ${currentHost || 'Not set'})`, value: 'host' },
        { name: `Port (currently: ${currentPort})`, value: 'port' },
        { name: '🔙 Back', value: 'back' }
      ]
    );

    if (action === 'back') return;

    try {
      if (action === 'enabled') {
        const newEnabled = await this.uiHelpers.confirmAction(
          'Enable RTCM correction data?',
          currentEnabled
        );

        if (newEnabled !== currentEnabled) {
          const spinner = ora('Updating RTCM setting...').start();
          await client.config.updateRTCMEnabled(newEnabled);
          spinner.succeed('RTCM setting updated');
        }
      } else if (action === 'type') {
        const newType = await this.uiHelpers.selectFromList(
          'Select RTCM source type:',
          [
            { name: 'NTRIP', value: 'ntrip' },
            { name: 'TCP', value: 'tcp' },
            { name: 'UDP', value: 'udp' }
          ]
        );

        if (newType !== currentType) {
          await this.updateRTCMSource(client, newType, currentHost, currentPort);
        }
      } else if (action === 'host') {
        const newHost = await this.uiHelpers.getTextInput(
          'Enter RTCM host:',
          currentHost
        );

        if (newHost !== currentHost) {
          await this.updateRTCMSource(client, currentType, newHost, currentPort);
        }
      } else if (action === 'port') {
        const newPort = await this.uiHelpers.getNumberInput(
          'Enter RTCM port:',
          currentPort,
          1,
          65535
        );

        if (newPort !== currentPort) {
          await this.updateRTCMSource(client, currentType, currentHost, newPort);
        }
      }
    } catch (error) {
      this.uiHelpers.displayError('Failed to update RTCM settings', error);
    }
  }

  private async updateRTCMSource(client: any, type: string, host: string, port: number): Promise<void> {
    const spinner = ora('Updating RTCM source...').start();
    
    // For NTRIP, we might need additional credentials
    const options: any = {};
    
    if (type === 'ntrip') {
      const needsAuth = await this.uiHelpers.confirmAction(
        'Does this NTRIP source require authentication?',
        false
      );
      
      if (needsAuth) {
        options.username = await this.uiHelpers.getTextInput('NTRIP Username:');
        options.password = await this.uiHelpers.getTextInput('NTRIP Password:');
        options.mountpoint = await this.uiHelpers.getTextInput('Mountpoint:');
      }
    }
    
    await client.config.updateRTCMSource(type, host, port, options);
    spinner.succeed('RTCM source updated');
  }
}