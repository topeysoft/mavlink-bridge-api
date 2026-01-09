import chalk from 'chalk';
import ora from 'ora';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { DiscoveryProfileManager } from '../utils/DiscoveryProfileManager.js';
export class DeviceCommands {
    context;
    clientManager;
    uiHelpers;
    errorHandler;
    profileManager;
    constructor(context, clientManager, uiHelpers) {
        this.context = context;
        this.clientManager = clientManager;
        this.uiHelpers = uiHelpers;
        this.errorHandler = new ErrorHandler(uiHelpers);
        this.profileManager = new DiscoveryProfileManager();
    }
    async discoverDevices() {
        console.log(chalk.blue.bold('\n🔍 Device Discovery'));
        this.uiHelpers.displaySeparator();
        // Ask user about discovery mode
        const discoveryMode = await this.uiHelpers.selectFromList('Select discovery mode:', [
            { name: '⚡ Quick Scan - Common subnets only', value: 'quick' },
            { name: '🌐 Full Scan - Auto-detect all local subnets', value: 'full' },
            { name: '⚙️  Custom Scan - Specify subnets', value: 'custom' },
            { name: '📁 Load Profile - Use saved configuration', value: 'profile' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (discoveryMode === 'back') {
            return;
        }
        // Configure discovery options based on mode
        const options = await this.configureDiscoveryOptions(discoveryMode);
        if (!options)
            return;
        // Add progress callback
        const progressMessages = [];
        const onProgress = (message) => {
            progressMessages.push(message);
        };
        // Perform discovery
        const result = await this.clientManager.discoverDevices(options, onProgress);
        if (result.devices.length === 0) {
            this.uiHelpers.displayWarning('No devices discovered');
            if (progressMessages.length > 0) {
                console.log(chalk.gray('\nDiscovery log:'));
                progressMessages.forEach(msg => console.log(chalk.gray(`  • ${msg}`)));
            }
            await this.uiHelpers.pressAnyKey();
            return;
        }
        // Display discovery results
        await this.displayDiscoveryResults(result);
        await this.uiHelpers.pressAnyKey();
    }
    async configureDiscoveryOptions(mode) {
        const options = {
            timeout: 5000,
            concurrent: 20
        };
        switch (mode) {
            case 'quick':
                // Common home network subnets
                options.subnets = [
                    '192.168.1.0/24',
                    '192.168.0.0/24',
                    '192.168.4.0/24', // ESP32 AP mode
                    '10.0.0.0/24'
                ];
                console.log(chalk.gray('\nScanning common subnets:'));
                options.subnets.forEach(subnet => console.log(chalk.gray(`  • ${subnet}`)));
                break;
            case 'full':
                // Will use auto-detection in the discovery function
                console.log(chalk.gray('\nAuto-detecting local network subnets...'));
                break;
            case 'custom':
                // Ask user for subnets
                const subnetInput = await this.uiHelpers.getTextInput('Enter subnet(s) to scan (comma-separated, e.g., 192.168.1.0/24, 10.0.0.0/24):', '192.168.1.0/24', (input) => {
                    if (!input.trim()) {
                        return { valid: false, error: 'Subnet cannot be empty' };
                    }
                    // Basic validation
                    const subnets = input.split(',').map(s => s.trim());
                    for (const subnet of subnets) {
                        if (!subnet.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/)) {
                            return {
                                valid: false,
                                error: `Invalid subnet format: ${subnet}`,
                                suggestion: 'Use CIDR notation, e.g., 192.168.1.0/24'
                            };
                        }
                    }
                    return { valid: true };
                });
                options.subnets = subnetInput.split(',').map(s => s.trim());
                break;
            case 'profile':
                return await this.selectDiscoveryProfile();
            default:
                return null;
        }
        // Ask about advanced options
        const useAdvanced = await this.uiHelpers.confirmAction('Configure advanced options?', false);
        if (useAdvanced) {
            await this.configureAdvancedOptions(options);
        }
        // Ask to save as profile
        if (mode === 'custom') {
            const saveProfile = await this.uiHelpers.confirmAction('Save this configuration as a profile?', false);
            if (saveProfile) {
                await this.saveDiscoveryProfile(options);
            }
        }
        return options;
    }
    async configureAdvancedOptions(options) {
        // Timeout
        const timeoutStr = await this.uiHelpers.getTextInput('Discovery timeout in seconds (default: 5):', '5', (input) => {
            const num = parseInt(input, 10);
            if (isNaN(num) || num < 1 || num > 60) {
                return { valid: false, error: 'Timeout must be between 1 and 60 seconds' };
            }
            return { valid: true };
        });
        options.timeout = parseInt(timeoutStr, 10) * 1000;
        // Ports
        const portsInput = await this.uiHelpers.getTextInput('HTTP ports to check (comma-separated, default: 80,8080):', '80,8080', (input) => {
            const ports = input.split(',').map(p => parseInt(p.trim(), 10));
            for (const port of ports) {
                if (isNaN(port) || port < 1 || port > 65535) {
                    return { valid: false, error: 'Invalid port number' };
                }
            }
            return { valid: true };
        });
        options.ports = portsInput.split(',').map(p => parseInt(p.trim(), 10));
    }
    async selectDiscoveryProfile() {
        const profiles = await this.profileManager.loadProfiles();
        const defaultProfiles = this.profileManager.getDefaultProfiles();
        // Combine saved and default profiles
        const allProfiles = [...profiles];
        // Add default profiles if they don't exist in saved profiles
        for (const defaultProfile of defaultProfiles) {
            if (!profiles.find(p => p.name === defaultProfile.name)) {
                allProfiles.push(defaultProfile);
            }
        }
        if (allProfiles.length === 0) {
            this.uiHelpers.displayWarning('No profiles available');
            return null;
        }
        const profileChoices = allProfiles.map(profile => ({
            name: `${profile.name} - ${profile.description || 'No description'}`,
            value: profile
        }));
        profileChoices.push({ name: '🔙 Back', value: null });
        const selectedProfile = await this.uiHelpers.selectFromList('Select a discovery profile:', profileChoices);
        if (!selectedProfile)
            return null;
        // Mark profile as used
        await this.profileManager.markProfileUsed(selectedProfile.name);
        console.log(chalk.gray(`\nUsing profile: ${selectedProfile.name}`));
        if (selectedProfile.options.subnets) {
            console.log(chalk.gray('Subnets:'));
            selectedProfile.options.subnets.forEach(subnet => console.log(chalk.gray(`  • ${subnet}`)));
        }
        return selectedProfile.options;
    }
    async saveDiscoveryProfile(options) {
        const name = await this.uiHelpers.getTextInput('Profile name:', 'My Network', (input) => {
            if (!input.trim()) {
                return { valid: false, error: 'Profile name cannot be empty' };
            }
            return { valid: true };
        });
        const description = await this.uiHelpers.getTextInput('Profile description (optional):', '', () => ({ valid: true }));
        try {
            await this.profileManager.saveProfile({
                name,
                description: description || undefined,
                options
            });
            this.uiHelpers.displaySuccess(`Profile '${name}' saved successfully`);
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to save profile', error);
        }
    }
    async displayDiscoveryResults(result) {
        console.log(chalk.green(`\n✅ Discovery Results:`));
        console.log(chalk.gray(`   Scan duration: ${(result.duration / 1000).toFixed(1)}s`));
        console.log(chalk.gray(`   Hosts scanned: ${result.hostsScanned}`));
        console.log(chalk.gray(`   Devices found: ${result.devices.length}`));
        console.log();
        // Create detailed device table
        const table = this.uiHelpers.createTable([
            '#', 'Name', 'IP Address', 'Status', 'WiFi', 'Signal'
        ]);
        result.devices.forEach((device, index) => {
            const wifiStatus = device.isProvisioned
                ? `Connected to ${device.network.wifi.ssid || 'Unknown'}`
                : 'AP Mode';
            const signal = device.network.wifi.rssi
                ? `${device.network.wifi.rssi} dBm`
                : 'N/A';
            table.push([
                (index + 1).toString(),
                device.name || device.hostname,
                device.ip,
                device.status === 'healthy' ? chalk.green('Healthy') : chalk.yellow('Degraded'),
                wifiStatus,
                signal
            ]);
        });
        console.log(table.toString());
        // Offer connection
        const connectNow = await this.uiHelpers.confirmAction('Would you like to connect to one of these devices?', true);
        if (connectNow) {
            const deviceChoices = result.devices.map((device, index) => ({
                name: `${device.name || device.hostname} (${device.ip})`,
                value: `http://${device.ip}`
            }));
            deviceChoices.push({ name: '🔙 Back', value: null });
            const selectedUrl = await this.uiHelpers.selectFromList('Select a device to connect to:', deviceChoices);
            if (selectedUrl && typeof selectedUrl === 'string') {
                await this.connectToSpecificDevice(selectedUrl);
            }
        }
    }
    async connectToDevice() {
        console.log(chalk.blue.bold('\n🔌 Connect to Device'));
        this.uiHelpers.displaySeparator();
        const deviceUrl = await this.uiHelpers.getTextInput('Enter device URL (e.g., http://192.168.4.1):', 'http://192.168.4.1', (input) => {
            if (!input.trim()) {
                return { valid: false, error: 'URL cannot be empty' };
            }
            try {
                new URL(input);
                return { valid: true };
            }
            catch {
                return { valid: false, error: 'Invalid URL format', suggestion: 'Use format: http://192.168.4.1' };
            }
        });
        await this.connectToSpecificDevice(deviceUrl);
        await this.uiHelpers.pressAnyKey();
    }
    async connectToSpecificDevice(deviceUrl) {
        const spinner = ora('Connecting to device...').start();
        try {
            // Use retry logic for connection attempts
            const success = await this.errorHandler.withRetry(() => this.clientManager.connect(deviceUrl), {
                maxAttempts: 3,
                delayMs: 2000,
                backoffMultiplier: 1.5,
                retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED']
            }, { operation: 'Device Connection', component: 'ClientManager' });
            if (success) {
                spinner.succeed('Connection established successfully!');
                console.log(chalk.green('\n✅ Connected to device!'));
                // Show basic device info after connection with enhanced error handling
                try {
                    const client = this.clientManager.getClient();
                    if (client) {
                        const health = await this.errorHandler.withRetry(() => client.health.getSystemHealth(), {
                            maxAttempts: 2,
                            delayMs: 1000,
                            retryableErrors: ['timeout', 'temporary']
                        }, { operation: 'Health Check', component: 'HealthClient' });
                        console.log(chalk.blue('\n📊 Device Information:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Device URL': deviceUrl,
                            'Status': health.systemHealthy ? 'Healthy' : 'Unhealthy',
                            'Uptime': this.uiHelpers.formatDuration(health.uptime || 0),
                            'Free Memory': this.uiHelpers.formatBytes(health.freeHeap || 0),
                            'CPU Usage': health.cpuUsage ? `${health.cpuUsage.toFixed(1)}%` : 'N/A'
                        });
                    }
                }
                catch (error) {
                    spinner.warn('Connected but could not retrieve device info');
                    this.errorHandler.handleError(error, {
                        operation: 'Post-connection Health Check',
                        component: 'HealthClient'
                    });
                }
            }
            else {
                spinner.fail('Connection failed');
                this.errorHandler.handleConnectionError(new Error('Connection attempt returned false'), { operation: 'Device Connection', component: 'ClientManager' });
            }
        }
        catch (error) {
            spinner.fail('Connection failed');
            this.errorHandler.handleConnectionError(error, {
                operation: 'Device Connection',
                component: 'ClientManager',
                details: { deviceUrl }
            });
        }
    }
    async testConnection() {
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
    async showDeviceInfo() {
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
            // RTCM Status
            if (healthCheck.rtcm) {
                const rtcmStatusIcon = healthCheck.rtcm.connected ? '🟢' : '🔴';
                console.log(chalk.green('\n🛰️  RTCM Correction Data:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Status': `${rtcmStatusIcon} ${healthCheck.rtcm.state.toUpperCase()}`,
                    'Client Type': healthCheck.rtcm.type || 'N/A',
                    'Messages Received': healthCheck.rtcm.messagesReceived?.toString() || '0',
                    'Data Rate': healthCheck.rtcm.dataRate ? `${healthCheck.rtcm.dataRate.toFixed(2)} KB/s` : 'N/A',
                    'Bytes Received': healthCheck.rtcm.bytesReceived ? this.uiHelpers.formatBytes(healthCheck.rtcm.bytesReceived) : '0',
                    'CRC Errors': healthCheck.rtcm.crcErrors?.toString() || '0'
                });
            }
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
        }
        catch (error) {
            spinner.fail('Failed to retrieve device information');
            this.errorHandler.handleApiError(error, {
                operation: 'Device Information Retrieval',
                component: 'HealthClient',
                details: { method: 'getHealthCheck' }
            });
        }
        await this.uiHelpers.pressAnyKey();
    }
    async showSystemHealth() {
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
        }
        catch (error) {
            spinner.fail('Failed to retrieve system health');
            this.uiHelpers.displayError('Could not get system health', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async showSystemMetrics() {
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
        }
        catch (error) {
            this.uiHelpers.displayError('Could not retrieve system metrics', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async startMonitoring() {
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
                }
                catch (error) {
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
        }
        catch (error) {
            this.errorHandler.handleError(error, {
                operation: 'Real-time Monitoring Setup',
                component: 'DeviceCommands'
            });
        }
        finally {
            // Restore original signal handler
            process.removeListener('SIGINT', originalHandler);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async viewLogs() {
        console.log(chalk.blue.bold('\n📋 System Logs'));
        this.uiHelpers.displaySeparator();
        console.log(chalk.yellow('Live log streaming is available through WebSocket events.'));
        console.log(chalk.gray('Enable debug mode in Tools menu to see real-time logs.'));
        await this.uiHelpers.pressAnyKey();
    }
    async disconnect() {
        console.log(chalk.blue.bold('\n🔌 Disconnect Device'));
        this.uiHelpers.displaySeparator();
        if (!this.context.connected) {
            this.uiHelpers.displayWarning('No device currently connected');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const confirmed = await this.uiHelpers.confirmAction(`Disconnect from ${this.context.deviceUrl}?`, true);
        if (confirmed) {
            await this.clientManager.disconnect();
            this.uiHelpers.displaySuccess('Disconnected successfully');
        }
        await this.uiHelpers.pressAnyKey();
    }
}
//# sourceMappingURL=DeviceCommands.js.map