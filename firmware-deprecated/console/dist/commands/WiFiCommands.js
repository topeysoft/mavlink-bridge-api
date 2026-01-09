import chalk from 'chalk';
import ora from 'ora';
export class WiFiCommands {
    context;
    clientManager;
    uiHelpers;
    constructor(context, clientManager, uiHelpers) {
        this.context = context;
        this.clientManager = clientManager;
        this.uiHelpers = uiHelpers;
    }
    async showStatus() {
        console.log(chalk.blue.bold('\n📡 WiFi Status'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const spinner = ora('Getting WiFi status...').start();
        try {
            const status = await client.wifi.getStatus();
            spinner.succeed('WiFi status retrieved');
            console.log(chalk.green('\n📶 WiFi Status:'));
            // Connection status
            const statusIcon = status.connected ? '🟢' : '🔴';
            const stateText = status.connected ? 'Connected' : 'Disconnected';
            console.log(`${statusIcon} Status: ${chalk.bold(stateText)}`);
            if (status.connected && status.ssid) {
                console.log(chalk.blue('\n🔗 Connection Details:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Network (SSID)': status.ssid,
                    'IP Address': status.ip || 'N/A',
                    'Signal Strength': status.rssi ? `${status.rssi} dBm` : 'N/A',
                    'Signal Quality': status.quality ? `${status.quality}%` : 'N/A'
                });
            }
            if (status.apMode) {
                console.log(chalk.blue('\n🔥 Access Point Mode:'));
                this.uiHelpers.displayKeyValuePairs({
                    'AP Status': 'Active',
                    'AP SSID': status.apSSID || 'N/A',
                    'AP IP': status.apIP || 'N/A'
                });
            }
        }
        catch (error) {
            spinner.fail('Failed to get WiFi status');
            this.uiHelpers.displayError('Could not retrieve WiFi status', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async scanNetworks() {
        console.log(chalk.blue.bold('\n🔍 WiFi Network Scan'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const forceNew = await this.uiHelpers.confirmAction('Force a new scan? (Otherwise cached results will be used)', false);
        const spinner = ora('Scanning for WiFi networks...').start();
        spinner.text = 'This may take up to 30 seconds...';
        try {
            const networks = await client.wifi.scan({ force: forceNew, timeout: 30000 });
            if (networks.length === 0) {
                spinner.warn('No networks found');
                console.log(chalk.yellow('\n⚠️  No WiFi networks detected.'));
                console.log(chalk.gray('Try moving closer to WiFi access points or check if WiFi is enabled.'));
            }
            else {
                spinner.succeed(`Found ${networks.length} network(s)`);
                console.log(chalk.green(`\n📶 Networks Found (${networks.length}):`));
                const table = this.uiHelpers.createTable(['SSID', 'Signal', 'Security', 'Channel']);
                networks.forEach(network => {
                    const signalBars = this.getSignalBars(network.rssi);
                    const signalText = `${signalBars} ${network.rssi} dBm`;
                    const securityText = network.secure ? network.authMode || 'Secured' : 'Open';
                    table.push([
                        network.ssid,
                        signalText,
                        securityText,
                        network.channel?.toString() || 'N/A'
                    ]);
                });
                console.log(table.toString());
                const connectNow = await this.uiHelpers.confirmAction('Would you like to connect to one of these networks?', false);
                if (connectNow) {
                    await this.selectAndConnectNetwork(networks);
                }
            }
        }
        catch (error) {
            spinner.fail('Network scan failed');
            this.uiHelpers.displayError('Could not scan WiFi networks', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async connectToNetwork() {
        console.log(chalk.blue.bold('\n🔗 Connect to WiFi Network'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const method = await this.uiHelpers.selectFromList('How would you like to connect?', [
            { name: '🔍 Scan and select network', value: 'scan' },
            { name: '📝 Enter network manually', value: 'manual' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (method === 'back')
            return;
        try {
            switch (method) {
                case 'scan':
                    await this.scanAndConnect();
                    break;
                case 'manual':
                    await this.manualConnect();
                    break;
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Connection failed', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async disconnect() {
        console.log(chalk.blue.bold('\n🔌 Disconnect WiFi'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        try {
            // Check current status first
            const status = await client.wifi.getStatus();
            if (!status.connected) {
                this.uiHelpers.displayWarning('WiFi is not currently connected');
                await this.uiHelpers.pressAnyKey();
                return;
            }
            console.log(chalk.yellow(`Currently connected to: ${status.ssid || 'Unknown network'}`));
            const confirmed = await this.uiHelpers.confirmAction('Are you sure you want to disconnect from WiFi?', false);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Disconnect cancelled');
                await this.uiHelpers.pressAnyKey();
                return;
            }
            const spinner = ora('Disconnecting from WiFi...').start();
            const result = await client.wifi.disconnect();
            spinner.succeed('Disconnected from WiFi');
            this.uiHelpers.displaySuccess(result.message || 'WiFi disconnected successfully');
        }
        catch (error) {
            this.uiHelpers.displayError('Could not disconnect WiFi', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async manageSavedNetworks() {
        console.log(chalk.blue.bold('\n💾 Saved Networks'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const spinner = ora('Loading saved networks...').start();
        try {
            // Note: getSavedNetworks is not yet implemented in the WiFi client
            spinner.warn('Saved networks feature not yet available');
            console.log(chalk.yellow('\n⚠️  Saved networks feature is not yet implemented'));
            console.log(chalk.gray('This feature will be available in a future update'));
        }
        catch (error) {
            spinner.fail('Failed to load saved networks');
            this.uiHelpers.displayError('Could not retrieve saved networks', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async manageAccessPoint() {
        console.log(chalk.blue.bold('\n🔥 Access Point Management'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        try {
            const status = await client.wifi.getStatus();
            console.log(chalk.blue('\n📊 Access Point Status:'));
            this.uiHelpers.displayKeyValuePairs({
                'AP Mode': status.apMode ? 'Active' : 'Inactive',
                'AP SSID': status.apSSID || 'Not configured',
                'AP IP': status.apIP || 'N/A'
            });
            const action = await this.uiHelpers.selectFromList('Access Point Management:', [
                { name: status.apMode ? '🛑 Stop Access Point' : '🚀 Start Access Point', value: 'toggle' },
                { name: '⚙️  Configure AP Settings', value: 'configure' },
                { name: '👥 View Connected Clients', value: 'clients' },
                { name: '🔙 Back', value: 'back' }
            ]);
            switch (action) {
                case 'toggle':
                    await this.toggleAccessPoint(client, status.apMode || false);
                    break;
                case 'configure':
                    await this.configureAccessPoint(client);
                    break;
                case 'clients':
                    await this.viewConnectedClients(client);
                    break;
                case 'back':
                    return;
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to manage access point', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    getSignalBars(rssi) {
        if (rssi >= -50)
            return '🟢🟢🟢🟢';
        if (rssi >= -60)
            return '🟢🟢🟢⚪';
        if (rssi >= -70)
            return '🟢🟢⚪⚪';
        if (rssi >= -80)
            return '🟢⚪⚪⚪';
        return '🔴⚪⚪⚪';
    }
    async selectAndConnectNetwork(networks) {
        const networkChoices = networks.map((network, index) => ({
            name: `${network.ssid} (${this.getSignalBars(network.rssi)} ${network.rssi}dBm)`,
            value: index
        }));
        networkChoices.push({ name: '🔙 Back', value: -1 });
        const selectedIndex = await this.uiHelpers.selectFromList('Select a network to connect to:', networkChoices);
        if (selectedIndex === -1)
            return;
        const selectedNetwork = networks[selectedIndex];
        await this.connectToSpecificNetwork(selectedNetwork.ssid, selectedNetwork.secure);
    }
    async scanAndConnect() {
        const client = this.clientManager.getClient();
        const spinner = ora('Scanning for networks...').start();
        try {
            const networks = await client.wifi.scan({ force: true });
            spinner.succeed(`Found ${networks.length} networks`);
            if (networks.length === 0) {
                this.uiHelpers.displayWarning('No networks found');
                return;
            }
            await this.selectAndConnectNetwork(networks);
        }
        catch (error) {
            spinner.fail('Scan failed');
            throw error;
        }
    }
    async manualConnect() {
        const ssid = await this.uiHelpers.getTextInput('Enter network name (SSID):', '', (input) => {
            if (!input.trim())
                return { valid: false, error: 'SSID cannot be empty' };
            return { valid: true };
        });
        const isSecure = await this.uiHelpers.confirmAction('Is this network password-protected?', true);
        await this.connectToSpecificNetwork(ssid, isSecure);
    }
    async connectToSpecificNetwork(ssid, isSecure) {
        const client = this.clientManager.getClient();
        let password = '';
        if (isSecure) {
            password = await this.uiHelpers.getTextInput('Enter network password:', '', (input) => {
                if (!input.trim())
                    return { valid: false, error: 'Password cannot be empty' };
                return { valid: true };
            });
        }
        // Note: Network credentials are automatically saved upon successful connection
        // First check if device is reachable
        const diagSpinner = ora('Checking device connectivity...').start();
        try {
            const diagnostics = await client['httpClient'].getDiagnostics();
            if (!diagnostics.reachable) {
                diagSpinner.fail('Device is not reachable');
                console.log(chalk.red(`❌ Cannot reach device at: ${diagnostics.baseUrl}`));
                console.log(chalk.yellow('💡 Troubleshooting steps:'));
                console.log(chalk.gray('   • Check if device is powered on'));
                console.log(chalk.gray('   • Verify network connection to device'));
                console.log(chalk.gray('   • Ensure device IP/hostname is correct'));
                if (diagnostics.error) {
                    console.log(chalk.gray(`   • Error details: ${diagnostics.error}`));
                }
                await this.uiHelpers.pressAnyKey();
                return;
            }
            diagSpinner.succeed(`Device reachable (${diagnostics.responseTime}ms)`);
        }
        catch (error) {
            diagSpinner.fail('Failed to check device connectivity');
            console.log(chalk.red(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const spinner = ora(`Connecting to ${ssid}...`).start();
        spinner.text = 'This may take up to 30 seconds...';
        try {
            const result = await client.wifi.connect({ ssid, password }, { timeout: 30000 });
            if (result.state === 'connecting') {
                spinner.info(`Credentials sent to device. Connecting to ${ssid}... Please check connection status later.`);
                this.uiHelpers.displayInfo('Connection is in progress. Network credentials will be automatically saved upon successful connection.');
            }
            else {
                spinner.fail('Connection failed');
                this.uiHelpers.displayError('Failed to connect', result.message);
            }
        }
        catch (error) {
            spinner.fail('Connection failed');
            console.log(chalk.red(`❌ WiFi connection error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            // Provide specific debugging information based on error type
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    console.log(chalk.yellow('💡 Connection timeout - Try these steps:'));
                    console.log(chalk.gray('   • Check if WiFi password is correct'));
                    console.log(chalk.gray('   • Verify network is not hidden or has restrictions'));
                    console.log(chalk.gray('   • Move closer to WiFi access point'));
                    console.log(chalk.gray('   • Check if network uses WPA3 (try WPA2 instead)'));
                }
                else if (error.message.includes('Connection refused') || error.message.includes('unreachable')) {
                    console.log(chalk.yellow('💡 Device connection issue - Try these steps:'));
                    console.log(chalk.gray('   • Restart the device'));
                    console.log(chalk.gray('   • Check device WiFi configuration'));
                    console.log(chalk.gray('   • Verify you are connected to device access point'));
                }
                else if (error.message.includes('Failed to connect to WiFi')) {
                    console.log(chalk.yellow('💡 WiFi connection failed - Possible causes:'));
                    console.log(chalk.gray('   • Incorrect WiFi password'));
                    console.log(chalk.gray('   • Network security type not supported'));
                    console.log(chalk.gray('   • Device WiFi module issue'));
                    console.log(chalk.gray('   • Network interference or weak signal'));
                }
            }
            await this.uiHelpers.pressAnyKey();
            throw error;
        }
    }
    async connectToSavedNetwork() {
        // Note: getSavedNetworks is not yet implemented
        console.log(chalk.yellow('⚠️  Saved networks feature is not yet implemented'));
    }
    async connectToSavedNetworkFromList(client, savedNetworks) {
        const networkChoices = savedNetworks.map((network, index) => ({
            name: network.ssid,
            value: index
        }));
        networkChoices.push({ name: '🔙 Back', value: -1 });
        const selectedIndex = await this.uiHelpers.selectFromList('Select a saved network:', networkChoices);
        if (selectedIndex === -1)
            return;
        const selectedNetwork = savedNetworks[selectedIndex];
        const spinner = ora(`Connecting to ${selectedNetwork.ssid}...`).start();
        try {
            const result = await client.wifi.connect({ ssid: selectedNetwork.ssid, password: '' }, // Password should be stored
            { timeout: 30000 });
            if (result.success) {
                spinner.succeed(`Connected to ${selectedNetwork.ssid}`);
                this.uiHelpers.displaySuccess('Connection successful');
            }
            else {
                spinner.fail('Connection failed');
                this.uiHelpers.displayError('Failed to connect', result.message);
            }
        }
        catch (error) {
            spinner.fail('Connection failed');
            this.uiHelpers.displayError('Connection failed', error);
        }
    }
    async removeSavedNetwork(client, savedNetworks) {
        const networkChoices = savedNetworks.map((network, index) => ({
            name: network.ssid,
            value: index
        }));
        networkChoices.push({ name: '🔙 Back', value: -1 });
        const selectedIndex = await this.uiHelpers.selectFromList('Select network to remove:', networkChoices);
        if (selectedIndex === -1)
            return;
        const selectedNetwork = savedNetworks[selectedIndex];
        const confirmed = await this.uiHelpers.confirmAction(`Remove "${selectedNetwork.ssid}" from saved networks?`, false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Removal cancelled');
            return;
        }
        const spinner = ora(`Removing ${selectedNetwork.ssid}...`).start();
        try {
            const result = await client.wifi.removeSavedNetwork(selectedNetwork.ssid);
            if (result.success) {
                spinner.succeed('Network removed');
                this.uiHelpers.displaySuccess(`"${selectedNetwork.ssid}" removed from saved networks`);
            }
            else {
                spinner.fail('Failed to remove network');
                this.uiHelpers.displayError('Removal failed', result.message);
            }
        }
        catch (error) {
            spinner.fail('Removal failed');
            this.uiHelpers.displayError('Could not remove network', error);
        }
    }
    async toggleAccessPoint(client, currentlyActive) {
        const action = currentlyActive ? 'stop' : 'start';
        const confirmed = await this.uiHelpers.confirmAction(`Are you sure you want to ${action} the access point?`, false);
        if (!confirmed) {
            this.uiHelpers.displayInfo(`Access point ${action} cancelled`);
            return;
        }
        const spinner = ora(`${action === 'start' ? 'Starting' : 'Stopping'} access point...`).start();
        try {
            // Note: These methods may not exist in the current WiFiClient
            // This is a placeholder for when AP management is implemented
            this.uiHelpers.displayWarning('Access point control is not yet implemented in the WiFi API');
            spinner.warn('AP control not available');
        }
        catch (error) {
            spinner.fail(`Failed to ${action} access point`);
            this.uiHelpers.displayError(`Could not ${action} access point`, error);
        }
    }
    async configureAccessPoint(client) {
        console.log(chalk.blue.bold('\n⚙️ Configure Access Point'));
        // Placeholder implementation - would need AP configuration API
        this.uiHelpers.displayWarning('Access point configuration is not yet implemented');
        this.uiHelpers.displayInfo('This feature will allow setting:');
        console.log(chalk.gray('• AP SSID'));
        console.log(chalk.gray('• AP Password'));
        console.log(chalk.gray('• Channel'));
        console.log(chalk.gray('• Max clients'));
    }
    async viewConnectedClients(client) {
        console.log(chalk.blue.bold('\n👥 Connected Clients'));
        // Placeholder implementation - would need client list API
        this.uiHelpers.displayWarning('Client list is not yet available from the API');
        this.uiHelpers.displayInfo('This feature will show:');
        console.log(chalk.gray('• Client MAC addresses'));
        console.log(chalk.gray('• IP addresses'));
        console.log(chalk.gray('• Connection duration'));
        console.log(chalk.gray('• Data usage'));
    }
}
//# sourceMappingURL=WiFiCommands.js.map