import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
export class ConfigCommands {
    context;
    clientManager;
    uiHelpers;
    constructor(context, clientManager, uiHelpers) {
        this.context = context;
        this.clientManager = clientManager;
        this.uiHelpers = uiHelpers;
    }
    async viewConfiguration() {
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
            const config = await client.getConfiguration();
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
                'WiFi SSID': config.connection.wifi?.ssid || 'Not configured',
                'WiFi Auto Connect': config.connection.wifi?.autoConnect ? 'Enabled' : 'Disabled'
            });
            console.log(chalk.blue('\n🛰️  RTCM Configuration:'));
            this.uiHelpers.displayKeyValuePairs({
                'RTCM Enabled': config.rtcm.enabled ? 'Yes' : 'No',
                'Source Type': config.rtcm.source.type,
                'Host': config.rtcm.source.host || 'Not configured',
                'Port': config.rtcm.source.port
            });
        }
        catch (error) {
            spinner.fail('Failed to load configuration');
            this.uiHelpers.displayError('Could not retrieve configuration', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async editConfiguration() {
        console.log(chalk.blue.bold('\n✏️  Edit Configuration'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        try {
            const config = await client.getConfiguration();
            const section = await this.uiHelpers.selectFromList('Which configuration section would you like to edit?', [
                { name: '📱 Device Settings', value: 'device' },
                { name: '📡 WiFi Settings', value: 'wifi' },
                { name: '🛰️  RTCM Settings', value: 'rtcm' },
                { name: '🔙 Back', value: 'back' }
            ]);
            if (section === 'back')
                return;
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
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to edit configuration', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async backupConfiguration() {
        console.log(chalk.blue.bold('\n💾 Backup Configuration'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        // Ask user for backup file path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `config-backup-${timestamp}.json`;
        const backupFilePath = await this.uiHelpers.getTextInput('Backup file path (or press Enter for default):', defaultFilename, (input) => {
            if (!input.trim()) {
                return { valid: false, error: 'File path cannot be empty' };
            }
            // Ensure .json extension
            if (!input.toLowerCase().endsWith('.json')) {
                return { valid: false, error: 'File must have .json extension' };
            }
            return { valid: true };
        });
        const spinner = ora('Creating configuration backup...').start();
        try {
            const config = await client.getConfiguration();
            // Add metadata to backup
            const backupData = {
                metadata: {
                    backupTime: new Date().toISOString(),
                    deviceUrl: this.context.deviceUrl || 'Unknown',
                    backupVersion: '1.0',
                    source: 'yardrover-console'
                },
                configuration: config
            };
            const configJson = JSON.stringify(backupData, null, 2);
            // Ensure directory exists
            const dirPath = path.dirname(backupFilePath);
            await fs.mkdir(dirPath, { recursive: true });
            // Write backup to file
            await fs.writeFile(backupFilePath, configJson, 'utf8');
            spinner.succeed('Configuration backup saved');
            console.log(chalk.green('\n📋 Backup Summary:'));
            this.uiHelpers.displayKeyValuePairs({
                'Backup Time': backupData.metadata.backupTime,
                'Device URL': backupData.metadata.deviceUrl,
                'Configuration Version': config.version,
                'Backup File': path.resolve(backupFilePath),
                'File Size': this.uiHelpers.formatBytes(Buffer.byteLength(configJson, 'utf8'))
            });
            console.log(chalk.green(`\n✅ Backup successfully saved to: ${path.resolve(backupFilePath)}`));
        }
        catch (error) {
            spinner.fail('Failed to create backup');
            this.uiHelpers.displayError('Could not backup configuration', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async restoreConfiguration() {
        console.log(chalk.blue.bold('\n📁 Restore Configuration'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        // Ask user for restore file path or manual input
        console.log(chalk.yellow('Choose restore method:'));
        console.log(chalk.gray('1. Load from backup file'));
        console.log(chalk.gray('2. Paste JSON data manually'));
        const method = await this.uiHelpers.getTextInput('Enter choice (1 or 2):', '1', (input) => {
            const choice = input.trim();
            if (choice !== '1' && choice !== '2') {
                return { valid: false, error: 'Please enter 1 or 2' };
            }
            return { valid: true };
        });
        let configData;
        let backupMetadata = null;
        try {
            if (method === '1') {
                // Load from file
                const filePath = await this.uiHelpers.getTextInput('Backup file path:', '', (input) => {
                    if (!input.trim()) {
                        return { valid: false, error: 'File path cannot be empty' };
                    }
                    return { valid: true };
                });
                const spinner = ora('Loading backup file...').start();
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const backupData = JSON.parse(fileContent);
                    // Check if it's a new format backup with metadata
                    if (backupData.metadata && backupData.configuration) {
                        backupMetadata = backupData.metadata;
                        configData = backupData.configuration;
                    }
                    else {
                        // Legacy format - assume the file content is the configuration directly
                        configData = backupData;
                    }
                    spinner.succeed('Backup file loaded successfully');
                    if (backupMetadata) {
                        console.log(chalk.blue('\n📋 Backup Information:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Backup Date': backupMetadata.backupTime || 'Unknown',
                            'Source Device': backupMetadata.deviceUrl || 'Unknown',
                            'Backup Version': backupMetadata.backupVersion || 'Unknown',
                            'Source Tool': backupMetadata.source || 'Unknown',
                            'Configuration Version': configData.version || 'Unknown'
                        });
                    }
                }
                catch (fileError) {
                    spinner.fail('Failed to load backup file');
                    throw fileError;
                }
            }
            else {
                // Manual input
                console.log(chalk.yellow('\nPlease paste your configuration backup JSON data:'));
                const configJson = await this.uiHelpers.getTextInput('Configuration JSON:', '', (input) => {
                    try {
                        const parsed = JSON.parse(input);
                        // Check if it's a backup with metadata or direct configuration
                        if (parsed.metadata && parsed.configuration) {
                            if (!parsed.configuration.version || !parsed.configuration.device) {
                                return { valid: false, error: 'Invalid configuration format in backup' };
                            }
                        }
                        else if (!parsed.version || !parsed.device) {
                            return { valid: false, error: 'Invalid configuration format' };
                        }
                        return { valid: true };
                    }
                    catch {
                        return { valid: false, error: 'Invalid JSON format' };
                    }
                });
                const parsedData = JSON.parse(configJson);
                // Check format and extract configuration
                if (parsedData.metadata && parsedData.configuration) {
                    backupMetadata = parsedData.metadata;
                    configData = parsedData.configuration;
                }
                else {
                    configData = parsedData;
                }
            }
            // Validate configuration
            if (!configData.version || !configData.device) {
                throw new Error('Invalid configuration format - missing required fields');
            }
            console.log(chalk.blue('\n📋 Configuration to restore:'));
            this.uiHelpers.displayKeyValuePairs({
                'Device Name': configData.device.name || 'Unknown',
                'Version': configData.version || 'Unknown',
                'Connection Type': configData.connection?.type || 'Unknown'
            });
            const confirmed = await this.uiHelpers.confirmAction('Are you sure you want to restore this configuration? This will overwrite current settings.', false);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Restore cancelled');
                await this.uiHelpers.pressAnyKey();
                return;
            }
            const spinner = ora('Restoring configuration...').start();
            await client.setConfiguration(configData);
            spinner.succeed('Configuration restored successfully');
            this.uiHelpers.displaySuccess('Configuration has been restored. Device may restart.');
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to restore configuration', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async resetConfiguration() {
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
        const confirmed = await this.uiHelpers.confirmAction('Are you sure you want to reset to factory defaults?', false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Reset cancelled');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const doubleConfirm = await this.uiHelpers.confirmAction('This action cannot be undone. Continue with factory reset?', false);
        if (!doubleConfirm) {
            this.uiHelpers.displayInfo('Reset cancelled');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const spinner = ora('Resetting to factory defaults...').start();
        try {
            await client.resetConfiguration();
            spinner.succeed('Configuration reset to factory defaults');
            this.uiHelpers.displaySuccess('Device has been reset to factory defaults.');
            this.uiHelpers.displayWarning('Device will restart. You may need to reconnect.');
            // Clear connection since device will restart
            this.context.connected = false;
            this.context.client = null;
            this.context.deviceUrl = null;
        }
        catch (error) {
            spinner.fail('Failed to reset configuration');
            this.uiHelpers.displayError('Could not reset configuration', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async editDeviceSettings(client, config) {
        console.log(chalk.blue.bold('\n📱 Edit Device Settings'));
        const currentName = config.device.name;
        const currentMode = config.device.mode;
        const action = await this.uiHelpers.selectFromList('What would you like to edit?', [
            { name: `Device Name (currently: ${currentName})`, value: 'name' },
            { name: `Operation Mode (currently: ${currentMode})`, value: 'mode' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (action === 'back')
            return;
        try {
            if (action === 'name') {
                const newName = await this.uiHelpers.getTextInput('Enter new device name:', currentName, (input) => {
                    if (!input.trim())
                        return { valid: false, error: 'Device name cannot be empty' };
                    if (input.length > 32)
                        return { valid: false, error: 'Device name must be 32 characters or less' };
                    return { valid: true };
                });
                if (newName !== currentName) {
                    const spinner = ora('Updating device name...').start();
                    await client.updateDeviceName(newName);
                    spinner.succeed('Device name updated');
                }
            }
            else if (action === 'mode') {
                const newMode = await this.uiHelpers.selectFromList('Select operation mode:', [
                    { name: 'USB OTG Mode', value: 'usb_otg' },
                    { name: 'UART Mode', value: 'uart' }
                ]);
                if (newMode !== currentMode) {
                    const confirmed = await this.uiHelpers.confirmAction('Changing operation mode will restart the device. Continue?', false);
                    if (confirmed) {
                        const spinner = ora('Updating operation mode...').start();
                        await client.updateConfigValue('/device/mode', newMode);
                        spinner.succeed('Operation mode updated');
                        this.uiHelpers.displayWarning('Device will restart');
                    }
                }
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to update device settings', error);
        }
    }
    async editWiFiSettings(client, config) {
        console.log(chalk.blue.bold('\n📡 Edit WiFi Settings'));
        const currentSSID = config.connection.wifi.ssid;
        const currentAutoConnect = config.connection.wifi.autoConnect;
        const action = await this.uiHelpers.selectFromList('What would you like to edit?', [
            { name: `WiFi SSID (currently: ${currentSSID || 'Not set'})`, value: 'ssid' },
            { name: `Auto Connect (currently: ${currentAutoConnect ? 'Enabled' : 'Disabled'})`, value: 'autoconnect' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (action === 'back')
            return;
        try {
            if (action === 'ssid') {
                const newSSID = await this.uiHelpers.getTextInput('Enter WiFi network name (SSID):', currentSSID, (input) => {
                    if (input.length > 32)
                        return { valid: false, error: 'SSID must be 32 characters or less' };
                    return { valid: true };
                });
                if (newSSID !== currentSSID) {
                    const spinner = ora('Updating WiFi SSID...').start();
                    await client.updateConfigValue('/connection/wifi/ssid', newSSID);
                    spinner.succeed('WiFi SSID updated');
                }
            }
            else if (action === 'autoconnect') {
                const newAutoConnect = await this.uiHelpers.confirmAction('Enable WiFi auto-connect on startup?', currentAutoConnect);
                if (newAutoConnect !== currentAutoConnect) {
                    const spinner = ora('Updating auto-connect setting...').start();
                    await client.updateConfigValue('/connection/wifi/autoConnect', newAutoConnect);
                    spinner.succeed('Auto-connect setting updated');
                }
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to update WiFi settings', error);
        }
    }
    async editRTCMSettings(client, config) {
        console.log(chalk.blue.bold('\n🛰️ Edit RTCM Settings'));
        const currentEnabled = config.rtcm.enabled;
        const currentType = config.rtcm.source.type;
        const currentHost = config.rtcm.source.host;
        const currentPort = config.rtcm.source.port;
        const action = await this.uiHelpers.selectFromList('What would you like to edit?', [
            { name: `RTCM Enabled (currently: ${currentEnabled ? 'Yes' : 'No'})`, value: 'enabled' },
            { name: `Source Type (currently: ${currentType})`, value: 'type' },
            { name: `Host (currently: ${currentHost || 'Not set'})`, value: 'host' },
            { name: `Port (currently: ${currentPort})`, value: 'port' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (action === 'back')
            return;
        try {
            if (action === 'enabled') {
                const newEnabled = await this.uiHelpers.confirmAction('Enable RTCM correction data?', currentEnabled);
                if (newEnabled !== currentEnabled) {
                    const spinner = ora('Updating RTCM setting...').start();
                    await client.updateConfigValue('/rtcm/enabled', newEnabled);
                    spinner.succeed('RTCM setting updated');
                }
            }
            else if (action === 'type') {
                const newType = await this.uiHelpers.selectFromList('Select RTCM source type:', [
                    { name: 'NTRIP', value: 'ntrip' },
                    { name: 'TCP', value: 'tcp' },
                    { name: 'UDP', value: 'udp' }
                ]);
                if (newType !== currentType) {
                    await this.updateRTCMSource(client, newType, currentHost, currentPort);
                }
            }
            else if (action === 'host') {
                const newHost = await this.uiHelpers.getTextInput('Enter RTCM host:', currentHost);
                if (newHost !== currentHost) {
                    await this.updateRTCMSource(client, currentType, newHost, currentPort);
                }
            }
            else if (action === 'port') {
                const newPort = await this.uiHelpers.getNumberInput('Enter RTCM port:', currentPort, 1, 65535);
                if (newPort !== currentPort) {
                    await this.updateRTCMSource(client, currentType, currentHost, newPort);
                }
            }
        }
        catch (error) {
            console.log(chalk.red.bold('\n❌ Failed to update RTCM settings'));
            if (error instanceof Error) {
                console.log(chalk.red('Error: ' + error.message));
                if (error.stack) {
                    console.log(chalk.gray(error.stack));
                }
            }
            else {
                console.log(chalk.red('Error: ' + JSON.stringify(error, null, 2)));
            }
        }
    }
    async updateRTCMSource(client, type, host, port) {
        const spinner = ora('Updating RTCM source...').start();
        // Update type, host, and port
        await client.updateConfigValue('/rtcm/source/type', type);
        await client.updateConfigValue('/rtcm/source/host', host);
        await client.updateConfigValue('/rtcm/source/port', port);
        // For NTRIP, we might need additional credentials
        if (type === 'ntrip') {
            const needsAuth = await this.uiHelpers.confirmAction('Does this NTRIP source require authentication?', false);
            if (needsAuth) {
                const username = await this.uiHelpers.getTextInput('NTRIP Username:');
                const password = await this.uiHelpers.getTextInput('NTRIP Password:');
                const mountpoint = await this.uiHelpers.getTextInput('Mountpoint:');
                await client.updateConfigValue('/rtcm/source/username', username);
                await client.updateConfigValue('/rtcm/source/password', password);
                await client.updateConfigValue('/rtcm/source/mountpoint', mountpoint);
            }
        }
        spinner.succeed('RTCM source updated');
    }
}
//# sourceMappingURL=ConfigCommands.js.map