import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
export class MAVLinkCommands {
    context;
    clientManager;
    uiHelpers;
    constructor(context, clientManager, uiHelpers) {
        this.context = context;
        this.clientManager = clientManager;
        this.uiHelpers = uiHelpers;
    }
    async showVehicleStatus() {
        console.log(chalk.blue.bold('\n🚁 Vehicle Status'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const spinner = ora('Getting vehicle status...').start();
        try {
            // Get communication status to check if MAVLink data is available
            const commStatus = await client.communication.getStatus();
            const commStats = await client.communication.getStatistics();
            spinner.succeed('Vehicle status retrieved');
            console.log(chalk.green('\n🔗 Communication Status:'));
            this.uiHelpers.displayKeyValuePairs({
                'Active Interface': commStatus.activeInterface,
                'Routing Mode': commStatus.routingMode,
                'MAVLink Messages': commStats.mavlink.totalMessages > 0 ? 'Receiving' : 'No Data',
                'Data Rate': `${(commStats.dataFlow.bytesReceived / 1024).toFixed(1)} KB received`
            });
            // Check if we have recent MAVLink activity
            if (commStats.mavlink.totalMessages === 0) {
                console.log(chalk.yellow('\n⚠️  No MAVLink telemetry data detected.'));
                console.log(chalk.gray('Ensure flight controller is connected and powered on.'));
                // Show interface health
                const interfaceHealth = await client.communication.getInterfaceHealth();
                console.log(chalk.blue('\n🔍 Interface Health:'));
                Object.entries(interfaceHealth).forEach(([iface, healthy]) => {
                    const icon = healthy ? '✅' : '❌';
                    console.log(`  ${icon} ${iface}: ${healthy ? 'Healthy' : 'Unhealthy'}`);
                });
            }
            else {
                console.log(chalk.green('\n📊 MAVLink Statistics:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Total Messages': commStats.mavlink.totalMessages,
                    'Packets Received': commStats.dataFlow.packetsReceived,
                    'Bytes Received': this.uiHelpers.formatBytes(commStats.dataFlow.bytesReceived),
                    'Data Rate': `${(commStats.dataFlow.downstreamRate / 1024).toFixed(1)} KB/s`
                });
                console.log(chalk.blue('\n💡 Tip: Use real-time telemetry stream to see live vehicle data'));
            }
        }
        catch (error) {
            spinner.fail('Failed to get vehicle status');
            this.uiHelpers.displayError('Could not retrieve vehicle status', error);
        }
        await this.uiHelpers.pressAnyKey();
    }
    async flightControlMenu() {
        console.log(chalk.blue.bold('\n🎮 Flight Control'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        console.log(chalk.red.bold('⚠️  WARNING: Flight control commands can affect vehicle safety!'));
        console.log(chalk.red('Only use these commands if you understand their implications.'));
        console.log();
        const action = await this.uiHelpers.selectFromList('Select flight control action:', [
            { name: '🔐 Arm Vehicle', value: 'arm' },
            { name: '🔓 Disarm Vehicle', value: 'disarm' },
            { name: '🎯 Set Flight Mode', value: 'mode' },
            { name: '🏠 Return to Launch', value: 'rtl' },
            { name: '⏸️  Pause Mission', value: 'pause' },
            { name: '▶️  Resume Mission', value: 'resume' },
            { name: '🛑 Emergency Stop', value: 'stop' },
            { name: '🔙 Back to MAVLink Menu', value: 'back' }
        ]);
        switch (action) {
            case 'arm':
                await this.armVehicle();
                break;
            case 'disarm':
                await this.disarmVehicle();
                break;
            case 'mode':
                await this.setFlightMode();
                break;
            case 'rtl':
                await this.returnToLaunch();
                break;
            case 'pause':
                await this.pauseMission();
                break;
            case 'resume':
                await this.resumeMission();
                break;
            case 'stop':
                await this.emergencyStop();
                break;
            case 'back':
                return;
        }
        await this.uiHelpers.pressAnyKey();
    }
    async armVehicle() {
        console.log(chalk.blue('\n🔐 Arm Vehicle'));
        const confirmed = await this.uiHelpers.confirmAction('Are you sure you want to arm the vehicle? This will enable motors.', false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Arm command cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('Arming vehicle...').start();
        try {
            const response = await client.mavlink.arm();
            if (response.success) {
                spinner.succeed('Vehicle armed successfully');
                this.uiHelpers.displaySuccess('Vehicle is now armed');
                this.uiHelpers.displayWarning('Motors are now enabled! Handle with care.');
            }
            else {
                spinner.fail('Failed to arm vehicle');
                this.uiHelpers.displayError('Arm command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Arm command failed');
            this.uiHelpers.displayError('Could not arm vehicle', error);
        }
    }
    async disarmVehicle() {
        console.log(chalk.blue('\n🔓 Disarm Vehicle'));
        const confirmed = await this.uiHelpers.confirmAction('Are you sure you want to disarm the vehicle?', true);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Disarm command cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('Disarming vehicle...').start();
        try {
            const response = await client.mavlink.disarm();
            if (response.success) {
                spinner.succeed('Vehicle disarmed successfully');
                this.uiHelpers.displaySuccess('Vehicle is now disarmed');
            }
            else {
                spinner.fail('Failed to disarm vehicle');
                this.uiHelpers.displayError('Disarm command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Disarm command failed');
            this.uiHelpers.displayError('Could not disarm vehicle', error);
        }
    }
    async setFlightMode() {
        console.log(chalk.blue('\n🎯 Set Flight Mode'));
        const modeOptions = [
            { name: 'Stabilize', value: 0 },
            { name: 'Altitude Hold', value: 2 },
            { name: 'Position Hold', value: 16 },
            { name: 'Auto (Mission)', value: 3 },
            { name: 'Guided', value: 4 },
            { name: 'Return to Launch', value: 6 },
            { name: 'Land', value: 9 }
        ];
        const selectedMode = await this.uiHelpers.selectFromList('Select flight mode:', modeOptions);
        const modeName = modeOptions.find(m => m.value === selectedMode)?.name;
        const confirmed = await this.uiHelpers.confirmAction(`Set flight mode to ${modeName}?`, true);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Mode change cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora(`Setting flight mode to ${modeName}...`).start();
        try {
            const response = await client.mavlink.setMode(selectedMode);
            if (response.success) {
                spinner.succeed(`Flight mode set to ${modeName}`);
                this.uiHelpers.displaySuccess(`Vehicle is now in ${modeName} mode`);
            }
            else {
                spinner.fail('Failed to set flight mode');
                this.uiHelpers.displayError('Mode change failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Mode change failed');
            this.uiHelpers.displayError('Could not set flight mode', error);
        }
    }
    async returnToLaunch() {
        console.log(chalk.blue('\n🏠 Return to Launch'));
        const confirmed = await this.uiHelpers.confirmAction('Command vehicle to return to launch position?', true);
        if (!confirmed) {
            this.uiHelpers.displayInfo('RTL command cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('Commanding return to launch...').start();
        try {
            const response = await client.mavlink.returnToLaunch();
            if (response.success) {
                spinner.succeed('Return to launch commanded');
                this.uiHelpers.displaySuccess('Vehicle is returning to launch position');
                this.uiHelpers.displayInfo('Monitor vehicle status for progress');
            }
            else {
                spinner.fail('Failed to command RTL');
                this.uiHelpers.displayError('RTL command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('RTL command failed');
            this.uiHelpers.displayError('Could not command return to launch', error);
        }
    }
    async pauseMission() {
        console.log(chalk.blue('\n⏸️  Pause Mission'));
        const client = this.clientManager.getClient();
        const spinner = ora('Pausing current mission...').start();
        try {
            // Pause by switching to guided mode
            const response = await client.mavlink.setMode(4); // Guided mode
            if (response.success) {
                spinner.succeed('Mission paused');
                this.uiHelpers.displaySuccess('Current mission has been paused');
                this.uiHelpers.displayInfo('Vehicle is now in guided mode');
            }
            else {
                spinner.fail('Failed to pause mission');
                this.uiHelpers.displayError('Pause command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Pause command failed');
            this.uiHelpers.displayError('Could not pause mission', error);
        }
    }
    async resumeMission() {
        console.log(chalk.blue('\n▶️  Resume Mission'));
        const client = this.clientManager.getClient();
        const spinner = ora('Resuming mission...').start();
        try {
            // Resume by switching back to auto mode
            const response = await client.mavlink.setMode(3); // Auto mode
            if (response.success) {
                spinner.succeed('Mission resumed');
                this.uiHelpers.displaySuccess('Mission has been resumed');
                this.uiHelpers.displayInfo('Vehicle is now in auto mode');
            }
            else {
                spinner.fail('Failed to resume mission');
                this.uiHelpers.displayError('Resume command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Resume command failed');
            this.uiHelpers.displayError('Could not resume mission', error);
        }
    }
    async emergencyStop() {
        console.log(chalk.red.bold('\n🛑 EMERGENCY STOP'));
        console.log(chalk.red('This will immediately stop all motors!'));
        const confirmed = await this.uiHelpers.confirmAction('Execute EMERGENCY STOP? This action is immediate and cannot be undone!', false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Emergency stop cancelled');
            return;
        }
        const doubleConfirm = await this.uiHelpers.confirmAction('FINAL WARNING: This will immediately cut power to all motors!', false);
        if (!doubleConfirm) {
            this.uiHelpers.displayInfo('Emergency stop cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('EXECUTING EMERGENCY STOP...').start();
        try {
            // Force disarm immediately
            const response = await client.mavlink.disarm();
            if (response.success) {
                spinner.succeed('EMERGENCY STOP EXECUTED');
                this.uiHelpers.displaySuccess('All motors have been stopped');
                console.log(chalk.red('\n⚠️  EMERGENCY STOP COMPLETE'));
                console.log(chalk.yellow('Vehicle systems may require restart before next operation'));
            }
            else {
                spinner.fail('Emergency stop failed');
                this.uiHelpers.displayError('Emergency stop command failed', 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Emergency stop failed');
            this.uiHelpers.displayError('Could not execute emergency stop', error);
        }
    }
    async parameterMenu() {
        console.log(chalk.blue.bold('\n⚙️  MAVLink Parameters'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const action = await this.uiHelpers.selectFromList('Parameter management options:', [
            { name: '📋 List All Parameters', value: 'list' },
            { name: '🔍 Search Parameters', value: 'search' },
            { name: '📄 Get Parameter Value', value: 'get' },
            { name: '✏️  Set Parameter Value', value: 'set' },
            { name: '💾 Backup Parameters', value: 'backup' },
            { name: '📁 Restore Parameters', value: 'restore' },
            { name: '🔄 Refresh Parameter List', value: 'refresh' },
            { name: '🔙 Back to MAVLink Menu', value: 'back' }
        ]);
        switch (action) {
            case 'list':
                await this.listParameters();
                break;
            case 'search':
                await this.searchParameters();
                break;
            case 'get':
                await this.getParameter();
                break;
            case 'set':
                await this.setParameter();
                break;
            case 'backup':
                await this.backupParameters();
                break;
            case 'restore':
                await this.restoreParameters();
                break;
            case 'refresh':
                await this.refreshParameters();
                break;
            case 'back':
                return;
        }
        await this.uiHelpers.pressAnyKey();
    }
    async listParameters() {
        console.log(chalk.blue('\n📋 Parameter List'));
        const client = this.clientManager.getClient();
        const spinner = ora('Loading parameters...').start();
        try {
            // Start parameter streaming if not already active
            await client.parameters.startParameterStream();
            // Get cached parameters
            let parameters = client.parameters.getAllCachedParameters();
            if (parameters.length === 0) {
                // Request parameter list if cache is empty
                spinner.text = 'Requesting parameter list from flight controller...';
                const response = await client.parameters.requestParameterList();
                if (!response.success) {
                    throw new Error(response.errorMessage || 'Parameter list request failed');
                }
                // Wait for parameters to arrive via SSE stream
                let attempts = 0;
                const maxAttempts = 15; // 15 seconds
                while (attempts < maxAttempts) {
                    parameters = client.parameters.getAllCachedParameters();
                    if (parameters.length > 0)
                        break;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                    if (attempts % 3 === 0) {
                        spinner.text = `Waiting for parameters... (${attempts}s)`;
                    }
                }
                if (parameters.length === 0) {
                    spinner.warn('No parameters received');
                    console.log(chalk.yellow('\n⚠️  No parameters received from flight controller'));
                    console.log(chalk.gray('Ensure MAVLink connection is established and flight controller is responding'));
                    return;
                }
            }
            spinner.succeed(`Found ${parameters.length} parameters`);
            // Show parameter statistics
            const stats = client.parameters.getCacheStats();
            console.log(chalk.blue('\n📊 Parameter Statistics:'));
            this.uiHelpers.displayKeyValuePairs({
                'Total Parameters': stats.totalParameters,
                'Categories': Object.keys(stats.categoryCounts).length,
                'Last Update': new Date(stats.lastUpdate).toLocaleString()
            });
            // Show parameters in pages
            const pageSize = 15;
            const totalPages = Math.ceil(parameters.length / pageSize);
            let currentPage = 0;
            while (currentPage < totalPages) {
                const startIdx = currentPage * pageSize;
                const endIdx = Math.min(startIdx + pageSize, parameters.length);
                const pageParams = parameters.slice(startIdx, endIdx);
                console.log(chalk.green(`\n📋 Parameters (Page ${currentPage + 1} of ${totalPages}):`));
                const table = this.uiHelpers.createTable(['Name', 'Value', 'Type', 'Last Updated']);
                pageParams.forEach(param => {
                    const lastUpdated = param.timestamp ?
                        new Date(param.timestamp).toLocaleTimeString() : 'Unknown';
                    table.push([
                        param.name,
                        param.value.toString(),
                        param.type,
                        lastUpdated
                    ]);
                });
                console.log(table.toString());
                if (currentPage < totalPages - 1) {
                    const showNext = await this.uiHelpers.confirmAction(`Show next page (${currentPage + 2} of ${totalPages})?`, true);
                    if (!showNext)
                        break;
                }
                currentPage++;
            }
        }
        catch (error) {
            spinner.fail('Failed to load parameters');
            this.uiHelpers.displayError('Could not list parameters', error);
        }
    }
    async searchParameters() {
        console.log(chalk.blue('\n🔍 Search Parameters'));
        const searchTerm = await this.uiHelpers.getTextInput('Enter search term (e.g., AHRS, GPS, BATT):', 'AHRS', (input) => {
            if (!input.trim())
                return { valid: false, error: 'Search term cannot be empty' };
            return { valid: true };
        });
        const client = this.clientManager.getClient();
        const spinner = ora(`Searching for parameters containing "${searchTerm}"...`).start();
        try {
            // Ensure parameters are loaded first
            let parameters = client.parameters.getAllCachedParameters();
            if (parameters.length === 0) {
                spinner.text = 'Loading parameters first...';
                await client.parameters.startParameterStream();
                const response = await client.parameters.requestParameterList();
                if (response.success) {
                    // Wait briefly for parameters to load
                    let attempts = 0;
                    while (attempts < 10 && parameters.length === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        parameters = client.parameters.getAllCachedParameters();
                        attempts++;
                    }
                }
                if (parameters.length === 0) {
                    spinner.warn('No parameters available for search');
                    console.log(chalk.yellow('\n⚠️  No parameters available for search'));
                    console.log(chalk.gray('Load parameters first using the parameter list option'));
                    return;
                }
            }
            spinner.text = `Searching for parameters containing "${searchTerm}"...`;
            const searchOptions = {
                query: searchTerm,
                limit: 50
            };
            const results = client.parameters.searchCachedParameters(searchOptions);
            if (results.parameters.length === 0) {
                spinner.warn('No matching parameters found');
                console.log(chalk.yellow(`\n⚠️  No parameters found matching "${searchTerm}"`));
                console.log(chalk.gray('Try a different search term or use a broader search'));
                return;
            }
            spinner.succeed(`Found ${results.parameters.length} matching parameters`);
            console.log(chalk.green(`\n🔍 Search Results for "${searchTerm}":`));
            const table = this.uiHelpers.createTable(['Name', 'Value', 'Type', 'Last Updated']);
            results.parameters.forEach(param => {
                const lastUpdated = param.timestamp ?
                    new Date(param.timestamp).toLocaleTimeString() : 'Unknown';
                table.push([
                    param.name,
                    param.value.toString(),
                    param.type,
                    lastUpdated
                ]);
            });
            console.log(table.toString());
            if (results.hasMore) {
                console.log(chalk.gray(`\n... and ${results.totalCount - results.parameters.length} more matches`));
                const showMore = await this.uiHelpers.confirmAction('Show additional results with less restrictive search?', false);
                if (showMore) {
                    const extendedResults = client.parameters.searchCachedParameters({
                        query: searchTerm,
                        limit: 100
                    });
                    const remainingParams = extendedResults.parameters.slice(50);
                    if (remainingParams.length > 0) {
                        console.log(chalk.blue('\n📋 Additional Results:'));
                        const extendedTable = this.uiHelpers.createTable(['Name', 'Value', 'Type', 'Last Updated']);
                        remainingParams.forEach(param => {
                            const lastUpdated = param.timestamp ?
                                new Date(param.timestamp).toLocaleTimeString() : 'Unknown';
                            extendedTable.push([
                                param.name,
                                param.value.toString(),
                                param.type,
                                lastUpdated
                            ]);
                        });
                        console.log(extendedTable.toString());
                    }
                }
            }
        }
        catch (error) {
            spinner.fail('Search failed');
            this.uiHelpers.displayError('Could not search parameters', error);
        }
    }
    async getParameter() {
        console.log(chalk.blue('\n📄 Get Parameter'));
        const paramName = await this.uiHelpers.getTextInput('Enter parameter name (e.g., AHRS_GPS_GAIN):', 'AHRS_GPS_GAIN', (input) => {
            if (!input.trim())
                return { valid: false, error: 'Parameter name cannot be empty' };
            if (input.length > 16)
                return { valid: false, error: 'Parameter name too long (max 16 chars)' };
            // Convert to uppercase for consistency
            return { valid: true, value: input.trim().toUpperCase() };
        });
        const client = this.clientManager.getClient();
        const spinner = ora(`Getting parameter ${paramName}...`).start();
        try {
            // Start parameter streaming if not active
            await client.parameters.startParameterStream();
            // First check cache
            let parameter = client.parameters.getParameterFromCache(paramName);
            if (!parameter) {
                // Request parameter if not in cache
                spinner.text = `Requesting ${paramName} from flight controller...`;
                try {
                    const response = await client.parameters.requestParameter(paramName);
                    if (response.success) {
                        // Wait for parameter to arrive via SSE stream
                        spinner.text = `Waiting for ${paramName} response...`;
                        parameter = await client.parameters.waitForParameter(paramName, 8000);
                    }
                    else {
                        throw new Error(response.errorMessage || 'Parameter request failed');
                    }
                }
                catch (waitError) {
                    if (waitError.name === 'ParameterTimeoutError') {
                        throw new Error(`Parameter ${paramName} not found or timed out`);
                    }
                    else if (waitError.name === 'ParameterNotFoundError') {
                        throw new Error(`Parameter ${paramName} does not exist on this flight controller`);
                    }
                    else {
                        throw waitError;
                    }
                }
            }
            spinner.succeed(`Parameter ${paramName} retrieved`);
            console.log(chalk.green(`\n📄 Parameter: ${paramName}`));
            this.uiHelpers.displayKeyValuePairs({
                'Name': parameter.name,
                'Value': parameter.value,
                'Type': parameter.type,
                'Last Updated': parameter.timestamp ?
                    new Date(parameter.timestamp).toLocaleString() : 'Unknown'
            });
            // Show parameter definition if available
            const definition = this.getParameterDefinition(paramName);
            if (definition) {
                console.log(chalk.blue('\n📝 Parameter Info:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Description': definition.description || 'No description available',
                    'Units': definition.units || 'None',
                    'Range': definition.range ? `${definition.range.min} - ${definition.range.max}` : 'Not specified',
                    'User Level': definition.userLevel || 'Standard'
                });
            }
            else {
                console.log(chalk.gray('\n💡 Tip: Parameter definitions help explain purpose and valid ranges'));
            }
        }
        catch (error) {
            spinner.fail(`Failed to get parameter ${paramName}`);
            if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
                this.uiHelpers.displayError(`Parameter ${paramName} was not found`, 'This parameter may not exist on this flight controller type');
                console.log(chalk.gray('\n💡 Try searching for similar parameters or check the parameter list'));
            }
            else {
                this.uiHelpers.displayError('Could not retrieve parameter', error);
            }
        }
    }
    async setParameter() {
        console.log(chalk.blue('\n✏️  Set Parameter'));
        console.log(chalk.red('⚠️  WARNING: Changing parameters can affect vehicle behavior!'));
        const paramName = await this.uiHelpers.getTextInput('Parameter name:', 'AHRS_GPS_GAIN', (input) => {
            if (!input.trim())
                return { valid: false, error: 'Parameter name cannot be empty' };
            if (input.length > 16)
                return { valid: false, error: 'Parameter name too long (max 16 chars)' };
            // Convert to uppercase for consistency
            return { valid: true, value: input.trim().toUpperCase() };
        });
        const client = this.clientManager.getClient();
        // Start parameter streaming
        await client.parameters.startParameterStream();
        // Get current value first
        let currentParameter = null;
        const loadingSpinner = ora(`Getting current value of ${paramName}...`).start();
        try {
            currentParameter = client.parameters.getParameterFromCache(paramName);
            if (!currentParameter) {
                loadingSpinner.text = `Requesting ${paramName} from flight controller...`;
                const response = await client.parameters.requestParameter(paramName);
                if (response.success) {
                    currentParameter = await client.parameters.waitForParameter(paramName, 5000);
                }
                else {
                    loadingSpinner.warn(`Could not retrieve current value of ${paramName}`);
                    console.log(chalk.yellow('Proceeding without current value verification'));
                }
            }
            else {
                loadingSpinner.succeed(`Current value retrieved`);
            }
        }
        catch (error) {
            loadingSpinner.warn(`Could not get current value: ${error.message}`);
            console.log(chalk.yellow('Proceeding without current value verification'));
        }
        if (currentParameter) {
            console.log(chalk.blue(`\nCurrent value: ${currentParameter.value} (${currentParameter.type})`));
            console.log(chalk.gray(`Last updated: ${currentParameter.timestamp ? new Date(currentParameter.timestamp).toLocaleString() : 'Unknown'}`));
        }
        const paramValue = await this.uiHelpers.getNumberInput('New parameter value:', currentParameter?.value || 1.0);
        // Show parameter info if available
        const definition = this.getParameterDefinition(paramName);
        if (definition) {
            console.log(chalk.blue('\n📝 Parameter Info:'));
            console.log(chalk.gray(`Description: ${definition.description || 'No description'}`));
            if (definition.range) {
                console.log(chalk.gray(`Valid range: ${definition.range.min} - ${definition.range.max}`));
                if (paramValue < definition.range.min || paramValue > definition.range.max) {
                    this.uiHelpers.displayWarning(`Value ${paramValue} is outside recommended range!`);
                    const proceedAnyway = await this.uiHelpers.confirmAction('Continue with out-of-range value? This could cause unexpected behavior.', false);
                    if (!proceedAnyway) {
                        this.uiHelpers.displayInfo('Parameter change cancelled');
                        return;
                    }
                }
            }
        }
        // Show value comparison
        if (currentParameter && currentParameter.value === paramValue) {
            console.log(chalk.yellow('\n⚠️  New value is the same as current value'));
            const continueSame = await this.uiHelpers.confirmAction('Continue setting the same value?', false);
            if (!continueSame) {
                this.uiHelpers.displayInfo('Parameter change cancelled');
                return;
            }
        }
        const confirmed = await this.uiHelpers.confirmAction(`Set ${paramName} = ${paramValue}? This may affect vehicle behavior.`, false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Parameter change cancelled');
            return;
        }
        const spinner = ora(`Setting ${paramName} = ${paramValue}...`).start();
        try {
            const response = await client.parameters.setParameter(paramName, paramValue);
            if (response.success) {
                spinner.succeed(`Parameter ${paramName} updated successfully`);
                this.uiHelpers.displaySuccess(`${paramName} = ${response.value || paramValue}`);
                // Check if value was actually updated
                if (response.value !== undefined && response.value !== paramValue) {
                    this.uiHelpers.displayWarning(`Flight controller set value to ${response.value} instead of ${paramValue}`);
                    console.log(chalk.gray('This can happen due to parameter constraints or rounding'));
                }
                if (definition?.rebootRequired) {
                    this.uiHelpers.displayWarning('This parameter requires a flight controller reboot to take effect');
                    console.log(chalk.gray('Use the device restart option or power cycle the flight controller'));
                }
                // Show updated cache value
                setTimeout(() => {
                    const updatedParam = client.parameters.getParameterFromCache(paramName);
                    if (updatedParam && updatedParam.value !== currentParameter?.value) {
                        console.log(chalk.green(`\n✅ Cache updated: ${paramName} = ${updatedParam.value}`));
                    }
                }, 1000);
            }
            else {
                spinner.fail('Failed to set parameter');
                this.uiHelpers.displayError('Parameter update failed', response.errorMessage || 'Command was not successful');
            }
        }
        catch (error) {
            spinner.fail('Parameter update failed');
            if (error.name === 'ParameterValidationError') {
                this.uiHelpers.displayError('Parameter validation failed', error.message);
                if (error.errors && error.errors.length > 0) {
                    console.log(chalk.red('Validation errors:'));
                    error.errors.forEach((err) => {
                        console.log(chalk.red(`  • ${err}`));
                    });
                }
            }
            else {
                this.uiHelpers.displayError('Could not set parameter', error);
            }
        }
    }
    async backupParameters() {
        console.log(chalk.blue('\n💾 Backup Parameters'));
        const client = this.clientManager.getClient();
        // Ask user for backup file path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `mavlink-params-${timestamp}.json`;
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
        const spinner = ora('Creating parameter backup...').start();
        try {
            // Ensure parameters are loaded
            let parameters = client.parameters.getAllCachedParameters();
            if (parameters.length === 0) {
                spinner.text = 'Loading parameters for backup...';
                await client.parameters.startParameterStream();
                const response = await client.parameters.requestParameterList();
                if (response.success) {
                    // Wait for parameters to load
                    let attempts = 0;
                    while (attempts < 20 && parameters.length === 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        parameters = client.parameters.getAllCachedParameters();
                        attempts++;
                        if (attempts % 5 === 0) {
                            spinner.text = `Loading parameters for backup... (${attempts}s)`;
                        }
                    }
                }
                if (parameters.length === 0) {
                    spinner.warn('No parameters available for backup');
                    this.uiHelpers.displayWarning('No parameters could be loaded for backup');
                    this.uiHelpers.displayInfo('Ensure flight controller is connected and responding');
                    return;
                }
            }
            spinner.text = 'Creating backup data...';
            const stats = client.parameters.getCacheStats();
            const backupData = {
                format: 'MAVLinkParameterBackup',
                version: '1.0',
                timestamp: new Date().toISOString(),
                deviceUrl: this.context.deviceUrl || 'Unknown',
                parameterCount: parameters.length,
                cacheStats: {
                    totalParameters: stats.totalParameters,
                    lastUpdate: stats.lastUpdate,
                    categoryCounts: stats.categoryCounts
                },
                parameters: parameters.reduce((acc, param) => {
                    acc[param.name] = {
                        value: param.value,
                        type: param.type,
                        timestamp: param.timestamp
                    };
                    return acc;
                }, {})
            };
            const backupJson = JSON.stringify(backupData, null, 2);
            // Ensure directory exists
            const dirPath = path.dirname(backupFilePath);
            await fs.mkdir(dirPath, { recursive: true });
            // Write backup to file
            await fs.writeFile(backupFilePath, backupJson, 'utf8');
            spinner.succeed('Parameter backup saved successfully');
            console.log(chalk.green('\n📋 Backup Summary:'));
            this.uiHelpers.displayKeyValuePairs({
                'Backup Time': backupData.timestamp,
                'Device URL': this.context.deviceUrl || 'Unknown',
                'Parameters': backupData.parameterCount,
                'Categories': Object.keys(stats.categoryCounts).length,
                'Backup File': path.resolve(backupFilePath),
                'File Size': this.uiHelpers.formatBytes(Buffer.byteLength(backupJson, 'utf8'))
            });
            if (Object.keys(stats.categoryCounts).length > 0) {
                console.log(chalk.blue('\n📊 Parameter Categories:'));
                const categoryTable = this.uiHelpers.createTable(['Category', 'Count']);
                Object.entries(stats.categoryCounts).forEach(([category, count]) => {
                    categoryTable.push([category, count.toString()]);
                });
                console.log(categoryTable.toString());
            }
            console.log(chalk.green(`\n✅ Backup successfully saved to: ${path.resolve(backupFilePath)}`));
            console.log(chalk.yellow('\n💡 Tips:'));
            console.log(chalk.gray('• Use meaningful filenames like: vehicle-type-YYYY-MM-DD-params.json'));
            console.log(chalk.gray('• Store backups before making significant parameter changes'));
            console.log(chalk.gray('• Keep backups organized by vehicle type and date'));
        }
        catch (error) {
            spinner.fail('Backup failed');
            this.uiHelpers.displayError('Could not create parameter backup', error);
        }
    }
    async restoreParameters() {
        console.log(chalk.blue('\n📁 Restore Parameters'));
        console.log(chalk.red.bold('\n⚠️  WARNING: Parameter restore can significantly change vehicle behavior!'));
        console.log(chalk.red('• Only restore parameters from the same vehicle type'));
        console.log(chalk.red('• Incorrect parameters can cause crashes or damage'));
        console.log(chalk.red('• Always verify parameters after restore'));
        console.log(chalk.red('• Consider creating a backup before restore'));
        const proceed = await this.uiHelpers.confirmAction('Do you understand the risks and want to continue?', false);
        if (!proceed) {
            this.uiHelpers.displayInfo('Parameter restore cancelled');
            return;
        }
        // Ask user for restore method
        console.log(chalk.yellow('\nChoose restore method:'));
        console.log(chalk.gray('1. Load from backup file'));
        console.log(chalk.gray('2. Paste JSON data manually'));
        const method = await this.uiHelpers.getTextInput('Enter choice (1 or 2):', '1', (input) => {
            const choice = input.trim();
            if (choice !== '1' && choice !== '2') {
                return { valid: false, error: 'Please enter 1 or 2' };
            }
            return { valid: true };
        });
        let backupData;
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
                    backupData = JSON.parse(fileContent);
                    if (!backupData.parameters) {
                        throw new Error('Invalid backup format - missing parameters object');
                    }
                    if (typeof backupData.parameters !== 'object') {
                        throw new Error('Invalid backup format - parameters must be an object');
                    }
                    spinner.succeed('Backup file loaded successfully');
                }
                catch (fileError) {
                    spinner.fail('Failed to load backup file');
                    throw fileError;
                }
            }
            else {
                // Manual input
                console.log(chalk.yellow('\nPlease paste your parameter backup JSON data:'));
                const backupJson = await this.uiHelpers.getTextInput('Backup JSON:', '', (input) => {
                    try {
                        const parsed = JSON.parse(input);
                        if (!parsed.parameters) {
                            return { valid: false, error: 'Invalid backup format - missing parameters object' };
                        }
                        if (typeof parsed.parameters !== 'object') {
                            return { valid: false, error: 'Invalid backup format - parameters must be an object' };
                        }
                        return { valid: true };
                    }
                    catch {
                        return { valid: false, error: 'Invalid JSON format - check syntax and formatting' };
                    }
                });
                backupData = JSON.parse(backupJson);
            }
            const parameterNames = Object.keys(backupData.parameters);
            console.log(chalk.blue('\n📋 Backup Information:'));
            this.uiHelpers.displayKeyValuePairs({
                'Format': backupData.format || 'Unknown',
                'Version': backupData.version || 'Unknown',
                'Backup Date': backupData.timestamp || 'Unknown',
                'Source Device': backupData.deviceUrl || 'Unknown',
                'Parameter Count': parameterNames.length
            });
            if (backupData.cacheStats?.categoryCounts) {
                console.log(chalk.blue('\n📊 Parameter Categories in Backup:'));
                const categoryTable = this.uiHelpers.createTable(['Category', 'Count']);
                Object.entries(backupData.cacheStats.categoryCounts).forEach(([category, count]) => {
                    categoryTable.push([category, String(count)]);
                });
                console.log(categoryTable.toString());
            }
            const confirmed = await this.uiHelpers.confirmAction(`Restore ${parameterNames.length} parameters? This will overwrite current values.`, false);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Restore cancelled');
                return;
            }
            const client = this.clientManager.getClient();
            // Start parameter streaming for real-time updates
            await client.parameters.startParameterStream();
            const spinner = ora('Restoring parameters...').start();
            let successCount = 0;
            let failCount = 0;
            let validationErrors = [];
            let notFoundErrors = [];
            for (const [paramName, paramData] of Object.entries(backupData.parameters)) {
                try {
                    const value = paramData.value;
                    if (value === undefined || value === null) {
                        failCount++;
                        console.log(chalk.red(`\n• Invalid value for ${paramName}: ${value}`));
                        continue;
                    }
                    const response = await client.parameters.setParameter(paramName, value);
                    if (response.success) {
                        successCount++;
                    }
                    else {
                        failCount++;
                        const errorMsg = response.errorMessage || 'Unknown error';
                        console.log(chalk.red(`\n• Failed to set ${paramName}: ${errorMsg}`));
                    }
                    spinner.text = `Restoring parameters... ${successCount + failCount}/${parameterNames.length} (${successCount} ok, ${failCount} failed)`;
                    // Throttle requests to avoid overwhelming flight controller
                    if ((successCount + failCount) % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    else {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
                catch (error) {
                    failCount++;
                    if (error.name === 'ParameterValidationError') {
                        validationErrors.push(paramName);
                        console.log(chalk.red(`\n• Validation error for ${paramName}: ${error.message}`));
                    }
                    else if (error.name === 'ParameterNotFoundError') {
                        notFoundErrors.push(paramName);
                        console.log(chalk.yellow(`\n• Parameter ${paramName} not found on this flight controller`));
                    }
                    else {
                        console.log(chalk.red(`\n• Error setting ${paramName}: ${error.message}`));
                    }
                }
            }
            if (failCount === 0) {
                spinner.succeed(`All ${successCount} parameters restored successfully`);
                this.uiHelpers.displaySuccess('Parameter restore completed without errors');
            }
            else {
                spinner.warn(`Restore completed with issues`);
                this.uiHelpers.displayWarning(`${successCount} succeeded, ${failCount} failed`);
                if (validationErrors.length > 0) {
                    console.log(chalk.red(`\n❌ Validation errors (${validationErrors.length}): Parameters that failed validation`));
                    console.log(chalk.gray('These parameters had invalid values according to flight controller constraints'));
                }
                if (notFoundErrors.length > 0) {
                    console.log(chalk.yellow(`\n⚠️  Not found (${notFoundErrors.length}): Parameters that don't exist on this flight controller`));
                    console.log(chalk.gray('This is normal when restoring between different flight controller types'));
                }
            }
            console.log(chalk.blue('\n📋 Restore Summary:'));
            this.uiHelpers.displayKeyValuePairs({
                'Total Attempted': parameterNames.length,
                'Successfully Set': successCount,
                'Failed': failCount,
                'Success Rate': `${Math.round((successCount / parameterNames.length) * 100)}%`
            });
            this.uiHelpers.displayInfo('Strongly recommend verifying critical parameters before flight');
            console.log(chalk.gray('\n💡 Use parameter list or search to verify restored values'));
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to restore parameters', error);
        }
    }
    async refreshParameters() {
        console.log(chalk.blue('\n🔄 Refresh Parameters'));
        console.log(chalk.gray('This will clear the parameter cache and reload all parameters from the flight controller'));
        const confirmed = await this.uiHelpers.confirmAction('Clear cache and refresh all parameters? This may take several minutes.', true);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Parameter refresh cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('Refreshing parameter list...').start();
        try {
            // Clear existing cache
            spinner.text = 'Clearing parameter cache...';
            client.parameters.clearCache();
            // Start parameter streaming
            spinner.text = 'Starting parameter stream...';
            await client.parameters.startParameterStream();
            // Request fresh parameter list
            spinner.text = 'Requesting parameter list from flight controller...';
            const response = await client.parameters.requestParameterList();
            if (!response.success) {
                throw new Error(response.errorMessage || 'Parameter list request failed');
            }
            spinner.text = 'Waiting for parameters to arrive via SSE...';
            // Wait for parameters to populate cache with progress updates
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds for large parameter sets
            let lastCount = 0;
            while (attempts < maxAttempts) {
                const parameters = client.parameters.getAllCachedParameters();
                if (parameters.length > lastCount) {
                    lastCount = parameters.length;
                    spinner.text = `Loading parameters... ${parameters.length} received`;
                }
                // Check if we have a reasonable number and haven't received new ones for a while
                if (parameters.length > 0 && attempts > 10) {
                    // Wait a bit longer to see if more come in
                    let noNewParameters = 0;
                    const checkCount = parameters.length;
                    for (let i = 0; i < 5; i++) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const currentParams = client.parameters.getAllCachedParameters();
                        if (currentParams.length === checkCount) {
                            noNewParameters++;
                        }
                        else {
                            break;
                        }
                    }
                    // If no new parameters for 5 seconds, consider it complete
                    if (noNewParameters >= 5) {
                        spinner.succeed(`Parameter refresh completed - ${parameters.length} parameters loaded`);
                        this.uiHelpers.displaySuccess(`${parameters.length} parameters are now available`);
                        const stats = client.parameters.getCacheStats();
                        console.log(chalk.blue('\n📊 Parameter Statistics:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Total Parameters': stats.totalParameters,
                            'Last Update': new Date(stats.lastUpdate).toLocaleString(),
                            'Categories': Object.keys(stats.categoryCounts).length,
                            'User Levels': `${stats.userLevelCounts.Standard || 0} Standard, ${stats.userLevelCounts.Advanced || 0} Advanced, ${stats.userLevelCounts.Expert || 0} Expert`,
                            'Data Types': `${stats.dataTypeCounts.int || 0} Int, ${stats.dataTypeCounts.float || 0} Float, ${stats.dataTypeCounts.enum || 0} Enum`
                        });
                        if (Object.keys(stats.categoryCounts).length > 0) {
                            console.log(chalk.blue('\n📋 Top Parameter Categories:'));
                            const sortedCategories = Object.entries(stats.categoryCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 8);
                            const categoryTable = this.uiHelpers.createTable(['Category', 'Count']);
                            sortedCategories.forEach(([category, count]) => {
                                categoryTable.push([category, count.toString()]);
                            });
                            console.log(categoryTable.toString());
                        }
                        return;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
                if (attempts % 10 === 0 && attempts > 10) {
                    spinner.text = `Still loading parameters... ${parameters.length} received (${attempts}s)`;
                }
            }
            const finalParameters = client.parameters.getAllCachedParameters();
            if (finalParameters.length > 0) {
                spinner.warn(`Parameter refresh completed with timeout - ${finalParameters.length} parameters loaded`);
                this.uiHelpers.displayWarning('Some parameters may not have been received due to timeout');
                console.log(chalk.gray('Parameters may still be loading in the background'));
            }
            else {
                spinner.fail('Parameter refresh timed out with no parameters received');
                this.uiHelpers.displayError('No parameters were received from the flight controller');
                console.log(chalk.gray('Check MAVLink connection and flight controller status'));
            }
        }
        catch (error) {
            spinner.fail('Parameter refresh failed');
            this.uiHelpers.displayError('Could not refresh parameters', error);
        }
    }
    async missionMenu() {
        console.log(chalk.blue.bold('\n🗺️  Mission Planning'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        const action = await this.uiHelpers.selectFromList('Mission management options:', [
            { name: '📋 List Current Mission', value: 'list' },
            { name: '📝 Create New Mission', value: 'create' },
            { name: '📂 Load Mission File', value: 'load' },
            { name: '💾 Save Mission', value: 'save' },
            { name: '🚀 Execute Mission', value: 'execute' },
            { name: '⏸️  Pause Mission', value: 'pause' },
            { name: '🗑️  Clear Mission', value: 'clear' },
            { name: '🔙 Back to MAVLink Menu', value: 'back' }
        ]);
        switch (action) {
            case 'list':
                await this.listMission();
                break;
            case 'create':
                await this.createMission();
                break;
            case 'load':
                await this.loadMission();
                break;
            case 'save':
                await this.saveMission();
                break;
            case 'execute':
                await this.executeMission();
                break;
            case 'pause':
                await this.pauseMission();
                break;
            case 'clear':
                await this.clearMission();
                break;
            case 'back':
                return;
        }
        await this.uiHelpers.pressAnyKey();
    }
    async listMission() {
        console.log(chalk.blue('\n📋 Current Mission'));
        const client = this.clientManager.getClient();
        const spinner = ora('Loading mission waypoints...').start();
        try {
            const mission = await client.mission.downloadMission();
            if (!mission || mission.items.length === 0) {
                spinner.warn('No mission loaded');
                console.log(chalk.yellow('\n⚠️  No mission currently loaded'));
                console.log(chalk.gray('Load or create a mission first'));
                return;
            }
            spinner.succeed(`Mission loaded with ${mission.items.length} waypoints`);
            console.log(chalk.green(`\n🗺️ Mission Overview:`));
            this.uiHelpers.displayKeyValuePairs({
                'Waypoints': mission.items.length,
                'Mission Type': 'Waypoint',
                'Estimated Distance': this.calculateMissionDistance(mission.items),
                'Estimated Duration': this.estimateMissionTime(mission.items)
            });
            console.log(chalk.blue('\n📋 Mission Waypoints:'));
            const table = this.uiHelpers.createTable(['#', 'Command', 'Latitude', 'Longitude', 'Altitude', 'Param1']);
            mission.items.slice(0, 20).forEach((item, index) => {
                table.push([
                    (index + 1).toString(),
                    this.getMissionCommandName(item.command),
                    item.x ? item.x.toFixed(6) : 'N/A',
                    item.y ? item.y.toFixed(6) : 'N/A',
                    item.z ? `${item.z.toFixed(1)}m` : 'N/A',
                    item.param1 ? item.param1.toString() : 'N/A'
                ]);
            });
            console.log(table.toString());
            if (mission.items.length > 20) {
                console.log(chalk.gray(`\n... and ${mission.items.length - 20} more waypoints`));
            }
        }
        catch (error) {
            spinner.fail('Failed to load mission');
            this.uiHelpers.displayError('Could not retrieve mission', error);
        }
    }
    async createMission() {
        console.log(chalk.blue('\n📝 Create Mission'));
        const missionType = await this.uiHelpers.selectFromList('Select mission type:', [
            { name: '🗺️ Simple Waypoint Mission', value: 'waypoint' },
            { name: '🔄 Return to Launch', value: 'rtl' },
            { name: '🏠 Land at Location', value: 'land' },
            { name: '🔙 Back', value: 'back' }
        ]);
        if (missionType === 'back')
            return;
        const client = this.clientManager.getClient();
        try {
            let missionItems = [];
            switch (missionType) {
                case 'waypoint':
                    missionItems = await this.createWaypointMission();
                    break;
                case 'rtl':
                    missionItems = await this.createRTLMission();
                    break;
                case 'land':
                    missionItems = await this.createLandMission();
                    break;
            }
            if (missionItems.length === 0) {
                this.uiHelpers.displayWarning('No waypoints created');
                return;
            }
            const confirmed = await this.uiHelpers.confirmAction(`Upload mission with ${missionItems.length} waypoints?`, true);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Mission creation cancelled');
                return;
            }
            const spinner = ora('Uploading mission...').start();
            await client.mission.uploadMission({ items: missionItems });
            spinner.succeed('Mission uploaded successfully');
            this.uiHelpers.displaySuccess(`Mission with ${missionItems.length} waypoints is now loaded`);
        }
        catch (error) {
            this.uiHelpers.displayError('Failed to create mission', error);
        }
    }
    async loadMission() {
        console.log(chalk.blue('\n📂 Load Mission'));
        console.log(chalk.yellow('Please paste your mission data (JSON format):'));
        const missionJson = await this.uiHelpers.getTextInput('Mission JSON:', '', (input) => {
            try {
                const parsed = JSON.parse(input);
                if (!parsed.items || !Array.isArray(parsed.items)) {
                    return { valid: false, error: 'Invalid mission format - missing items array' };
                }
                return { valid: true };
            }
            catch {
                return { valid: false, error: 'Invalid JSON format' };
            }
        });
        const client = this.clientManager.getClient();
        const spinner = ora('Loading mission...').start();
        try {
            const missionData = JSON.parse(missionJson);
            console.log(chalk.blue('\n📋 Mission Information:'));
            this.uiHelpers.displayKeyValuePairs({
                'Name': missionData.name || 'Unnamed Mission',
                'Waypoints': missionData.items.length,
                'Type': missionData.type || 'Waypoint Mission'
            });
            const confirmed = await this.uiHelpers.confirmAction(`Load this mission with ${missionData.items.length} waypoints?`, true);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Mission load cancelled');
                return;
            }
            await client.mission.uploadMission(missionData.items);
            spinner.succeed('Mission loaded successfully');
            this.uiHelpers.displaySuccess('Mission is now ready for execution');
        }
        catch (error) {
            spinner.fail('Failed to load mission');
            this.uiHelpers.displayError('Could not load mission', error);
        }
    }
    async saveMission() {
        console.log(chalk.blue('\n💾 Save Mission'));
        const client = this.clientManager.getClient();
        const spinner = ora('Getting current mission...').start();
        try {
            const mission = await client.mission.downloadMission();
            if (!mission || mission.items.length === 0) {
                spinner.warn('No mission to save');
                console.log(chalk.yellow('\n⚠️  No mission currently loaded'));
                console.log(chalk.gray('Load or create a mission first'));
                return;
            }
            const missionName = await this.uiHelpers.getTextInput('Mission name:', `Mission_${new Date().toISOString().split('T')[0]}`);
            const timestamp = new Date().toISOString();
            const missionData = {
                name: missionName,
                timestamp,
                type: 'Waypoint Mission',
                deviceUrl: this.context.deviceUrl,
                waypointCount: mission.items.length,
                items: mission.items
            };
            const missionJson = JSON.stringify(missionData, null, 2);
            spinner.succeed('Mission prepared for export');
            console.log(chalk.green('\n📋 Mission Export:'));
            this.uiHelpers.displayKeyValuePairs({
                'Mission Name': missionName,
                'Export Time': timestamp,
                'Waypoints': mission.items.length,
                'Suggested Filename': `${missionName.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
                'File Size': this.uiHelpers.formatBytes(Buffer.byteLength(missionJson, 'utf8'))
            });
            console.log(chalk.blue('\n📄 Mission Data:'));
            console.log(chalk.gray(missionJson));
            console.log(chalk.yellow('\n💡 Tip: Copy the mission data above to save as a file'));
        }
        catch (error) {
            spinner.fail('Failed to save mission');
            this.uiHelpers.displayError('Could not save mission', error);
        }
    }
    async executeMission() {
        console.log(chalk.blue('\n🚀 Execute Mission'));
        const client = this.clientManager.getClient();
        try {
            // Check if mission is loaded
            const mission = await client.mission.downloadMission();
            if (!mission || mission.items.length === 0) {
                this.uiHelpers.displayError('No mission loaded');
                console.log(chalk.gray('Load or create a mission first'));
                return;
            }
            console.log(chalk.blue(`\n🗺️ Mission Overview:`));
            this.uiHelpers.displayKeyValuePairs({
                'Waypoints': mission.items.length,
                'Estimated Distance': this.calculateMissionDistance(mission.items),
                'Estimated Duration': this.estimateMissionTime(mission.items)
            });
            console.log(chalk.red.bold('\n⚠️  FLIGHT SAFETY WARNING:'));
            console.log(chalk.red('• Ensure flight area is clear'));
            console.log(chalk.red('• Vehicle must be armed and ready'));
            console.log(chalk.red('• Monitor flight at all times'));
            console.log(chalk.red('• Be ready to switch to manual control'));
            const confirmed = await this.uiHelpers.confirmAction('Start mission execution? This will switch to AUTO mode.', false);
            if (!confirmed) {
                this.uiHelpers.displayInfo('Mission execution cancelled');
                return;
            }
            const spinner = ora('Starting mission execution...').start();
            // Switch to AUTO mode to start mission
            const response = await client.mavlink.setMode(3); // AUTO mode
            if (response.success) {
                spinner.succeed('Mission execution started');
                this.uiHelpers.displaySuccess('Mission is now executing');
                this.uiHelpers.displayInfo('Vehicle is in AUTO mode');
                const monitor = await this.uiHelpers.confirmAction('Monitor mission progress?', true);
                if (monitor) {
                    await this.monitorMissionProgress(client);
                }
            }
            else {
                spinner.fail('Failed to start mission');
                this.uiHelpers.displayError('Could not switch to AUTO mode', 'Command was not successful');
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Mission execution failed', error);
        }
    }
    async clearMission() {
        console.log(chalk.blue('\n🗑️  Clear Mission'));
        const confirmed = await this.uiHelpers.confirmAction('Clear all waypoints from the current mission?', false);
        if (!confirmed) {
            this.uiHelpers.displayInfo('Mission clear cancelled');
            return;
        }
        const client = this.clientManager.getClient();
        const spinner = ora('Clearing mission...').start();
        try {
            await client.mission.clearMission();
            spinner.succeed('Mission cleared');
            this.uiHelpers.displaySuccess('All waypoints have been removed');
            this.uiHelpers.displayInfo('Flight controller mission is now empty');
        }
        catch (error) {
            spinner.fail('Failed to clear mission');
            this.uiHelpers.displayError('Could not clear mission', error);
        }
    }
    async startTelemetryStream() {
        console.log(chalk.blue.bold('\n📡 Telemetry Stream'));
        this.uiHelpers.displaySeparator();
        const client = this.clientManager.getClient();
        if (!client) {
            this.uiHelpers.displayError('Not connected to any device');
            await this.uiHelpers.pressAnyKey();
            return;
        }
        console.log(chalk.yellow('Starting real-time telemetry display...'));
        console.log(chalk.gray('Press Ctrl+C to stop telemetry stream\n'));
        let streaming = true;
        let telemetryData = {
            heartbeat: null,
            attitude: null,
            globalPosition: null,
            gpsRaw: null,
            sysBattery: null,
            sysStatus: null,
            vfrHud: null,
            lastUpdate: null,
            messageCount: 0
        };
        // Set up MAVLink message listener
        const unsubscribe = client.communication.onMAVLinkMessage((message) => {
            telemetryData.messageCount++;
            telemetryData.lastUpdate = Date.now();
            // Decode common MAVLink message types for telemetry display
            try {
                switch (message.messageId) {
                    case 0: // HEARTBEAT
                        telemetryData.heartbeat = this.parseHeartbeat(message.payload);
                        break;
                    case 30: // ATTITUDE
                        telemetryData.attitude = this.parseAttitude(message.payload);
                        break;
                    case 33: // GLOBAL_POSITION_INT
                        telemetryData.globalPosition = this.parseGlobalPosition(message.payload);
                        break;
                    case 24: // GPS_RAW_INT
                        telemetryData.gpsRaw = this.parseGpsRaw(message.payload);
                        break;
                    case 147: // BATTERY_STATUS
                        telemetryData.sysBattery = this.parseBattery(message.payload);
                        break;
                    case 1: // SYS_STATUS
                        telemetryData.sysStatus = this.parseSysStatus(message.payload);
                        break;
                    case 74: // VFR_HUD
                        telemetryData.vfrHud = this.parseVfrHud(message.payload);
                        break;
                }
            }
            catch (error) {
                // Ignore parsing errors for now
            }
        });
        const originalHandler = process.on('SIGINT', () => {
            streaming = false;
            unsubscribe();
            console.log(chalk.yellow('\n\nTelemetry stream stopped'));
        });
        try {
            while (streaming) {
                // Clear screen and show current telemetry
                console.clear();
                console.log(chalk.cyan.bold('📡 Real-time MAVLink Telemetry'));
                console.log(chalk.gray(`Messages: ${telemetryData.messageCount} | Last: ${telemetryData.lastUpdate ? new Date(telemetryData.lastUpdate).toLocaleTimeString() : 'None'}\n`));
                if (telemetryData.messageCount === 0) {
                    console.log(chalk.yellow('⏳ Waiting for MAVLink telemetry data...'));
                    console.log(chalk.gray('Ensure flight controller is connected and transmitting.'));
                }
                else {
                    // Display flight status
                    if (telemetryData.heartbeat) {
                        console.log(chalk.green('🚁 Flight Status:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Armed': telemetryData.heartbeat.armed ? 'ARMED' : 'DISARMED',
                            'Flight Mode': telemetryData.heartbeat.custom_mode || 'Unknown',
                            'System Status': telemetryData.heartbeat.system_status || 'Unknown',
                            'MAV Type': telemetryData.heartbeat.type || 'Unknown'
                        });
                    }
                    // Display position data
                    if (telemetryData.globalPosition || telemetryData.vfrHud) {
                        console.log(chalk.green('\n📍 Position & Movement:'));
                        const posData = {};
                        if (telemetryData.globalPosition) {
                            posData['Latitude'] = `${(telemetryData.globalPosition.lat / 1e7).toFixed(6)}°`;
                            posData['Longitude'] = `${(telemetryData.globalPosition.lon / 1e7).toFixed(6)}°`;
                            posData['Altitude'] = `${(telemetryData.globalPosition.alt / 1000).toFixed(1)} m`;
                            posData['Relative Alt'] = `${(telemetryData.globalPosition.relative_alt / 1000).toFixed(1)} m`;
                        }
                        if (telemetryData.vfrHud) {
                            posData['Ground Speed'] = `${telemetryData.vfrHud.groundspeed?.toFixed(1) || 0} m/s`;
                            posData['Air Speed'] = `${telemetryData.vfrHud.airspeed?.toFixed(1) || 0} m/s`;
                            posData['Heading'] = `${telemetryData.vfrHud.heading || 0}°`;
                        }
                        this.uiHelpers.displayKeyValuePairs(posData);
                    }
                    // Display attitude data
                    if (telemetryData.attitude) {
                        console.log(chalk.green('\n🦭 Attitude:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Roll': `${(telemetryData.attitude.roll * 180 / Math.PI).toFixed(1)}°`,
                            'Pitch': `${(telemetryData.attitude.pitch * 180 / Math.PI).toFixed(1)}°`,
                            'Yaw': `${(telemetryData.attitude.yaw * 180 / Math.PI).toFixed(1)}°`
                        });
                    }
                    // Display battery data
                    if (telemetryData.sysBattery || telemetryData.vfrHud) {
                        console.log(chalk.green('\n🔋 Power:'));
                        const powerData = {};
                        if (telemetryData.sysBattery) {
                            powerData['Voltage'] = `${(telemetryData.sysBattery.voltages?.[0] / 1000)?.toFixed(2) || 'N/A'} V`;
                            powerData['Current'] = `${(telemetryData.sysBattery.current_battery / 100)?.toFixed(2) || 'N/A'} A`;
                            powerData['Remaining'] = `${telemetryData.sysBattery.battery_remaining || 0}%`;
                        }
                        else if (telemetryData.vfrHud) {
                            powerData['Battery'] = `${telemetryData.vfrHud.throttle || 0}% throttle`;
                        }
                        this.uiHelpers.displayKeyValuePairs(powerData);
                    }
                    // Display GPS data
                    if (telemetryData.gpsRaw) {
                        console.log(chalk.green('\n📶 GPS:'));
                        this.uiHelpers.displayKeyValuePairs({
                            'Fix Type': this.getGpsFixType(telemetryData.gpsRaw.fix_type),
                            'Satellites': telemetryData.gpsRaw.satellites_visible || 0,
                            'HDOP': `${(telemetryData.gpsRaw.eph / 100)?.toFixed(2) || 'N/A'}`,
                            'VDOP': `${(telemetryData.gpsRaw.epv / 100)?.toFixed(2) || 'N/A'}`
                        });
                    }
                }
                console.log(chalk.gray('\nPress Ctrl+C to stop telemetry stream...'));
                // Wait 500ms before next update for smooth display
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Telemetry stream error', error);
        }
        finally {
            unsubscribe();
            process.removeListener('SIGINT', originalHandler);
        }
        await this.uiHelpers.pressAnyKey();
    }
    // MAVLink message parsing helpers
    parseHeartbeat(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 9)
                return null;
            return {
                custom_mode: buffer.readUInt32LE(0),
                type: buffer.readUInt8(4),
                autopilot: buffer.readUInt8(5),
                base_mode: buffer.readUInt8(6),
                system_status: buffer.readUInt8(7),
                mavlink_version: buffer.readUInt8(8),
                armed: (buffer.readUInt8(6) & 0x80) !== 0
            };
        }
        catch (error) {
            return null;
        }
    }
    parseAttitude(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 28)
                return null;
            return {
                time_boot_ms: buffer.readUInt32LE(0),
                roll: buffer.readFloatLE(4),
                pitch: buffer.readFloatLE(8),
                yaw: buffer.readFloatLE(12),
                rollspeed: buffer.readFloatLE(16),
                pitchspeed: buffer.readFloatLE(20),
                yawspeed: buffer.readFloatLE(24)
            };
        }
        catch (error) {
            return null;
        }
    }
    parseGlobalPosition(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 28)
                return null;
            return {
                time_boot_ms: buffer.readUInt32LE(0),
                lat: buffer.readInt32LE(4),
                lon: buffer.readInt32LE(8),
                alt: buffer.readInt32LE(12),
                relative_alt: buffer.readInt32LE(16),
                vx: buffer.readInt16LE(20),
                vy: buffer.readInt16LE(22),
                vz: buffer.readInt16LE(24),
                hdg: buffer.readUInt16LE(26)
            };
        }
        catch (error) {
            return null;
        }
    }
    parseGpsRaw(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 30)
                return null;
            return {
                time_usec: buffer.readBigUInt64LE(0),
                fix_type: buffer.readUInt8(8),
                lat: buffer.readInt32LE(9),
                lon: buffer.readInt32LE(13),
                alt: buffer.readInt32LE(17),
                eph: buffer.readUInt16LE(21),
                epv: buffer.readUInt16LE(23),
                vel: buffer.readUInt16LE(25),
                cog: buffer.readUInt16LE(27),
                satellites_visible: buffer.readUInt8(29)
            };
        }
        catch (error) {
            return null;
        }
    }
    parseBattery(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 36)
                return null;
            const voltages = [];
            for (let i = 0; i < 10; i++) {
                voltages.push(buffer.readUInt16LE(4 + i * 2));
            }
            return {
                id: buffer.readUInt8(0),
                battery_function: buffer.readUInt8(1),
                type: buffer.readUInt8(2),
                temperature: buffer.readInt16LE(3),
                voltages: voltages,
                current_battery: buffer.readInt16LE(24),
                current_consumed: buffer.readInt32LE(26),
                energy_consumed: buffer.readInt32LE(30),
                battery_remaining: buffer.readInt8(34),
                time_remaining: buffer.readInt32LE(35)
            };
        }
        catch (error) {
            return null;
        }
    }
    parseSysStatus(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 31)
                return null;
            return {
                onboard_control_sensors_present: buffer.readUInt32LE(0),
                onboard_control_sensors_enabled: buffer.readUInt32LE(4),
                onboard_control_sensors_health: buffer.readUInt32LE(8),
                load: buffer.readUInt16LE(12),
                voltage_battery: buffer.readUInt16LE(14),
                current_battery: buffer.readInt16LE(16),
                battery_remaining: buffer.readInt8(18),
                drop_rate_comm: buffer.readUInt16LE(19),
                errors_comm: buffer.readUInt16LE(21),
                errors_count1: buffer.readUInt16LE(23),
                errors_count2: buffer.readUInt16LE(25),
                errors_count3: buffer.readUInt16LE(27),
                errors_count4: buffer.readUInt16LE(29)
            };
        }
        catch (error) {
            return null;
        }
    }
    parseVfrHud(payload) {
        try {
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length < 20)
                return null;
            return {
                airspeed: buffer.readFloatLE(0),
                groundspeed: buffer.readFloatLE(4),
                heading: buffer.readInt16LE(8),
                throttle: buffer.readUInt16LE(10),
                alt: buffer.readFloatLE(12),
                climb: buffer.readFloatLE(16)
            };
        }
        catch (error) {
            return null;
        }
    }
    getGpsFixType(fixType) {
        switch (fixType) {
            case 0: return 'No GPS';
            case 1: return 'No Fix';
            case 2: return '2D Fix';
            case 3: return '3D Fix';
            case 4: return 'DGPS';
            case 5: return 'RTK Float';
            case 6: return 'RTK Fixed';
            case 7: return 'Static';
            case 8: return 'PPP';
            default: return 'Unknown';
        }
    }
    getParameterDefinition(paramName) {
        // Import and use the parameter definitions from the client library
        try {
            const client = this.clientManager.getClient();
            if (!client)
                return null;
            // Try to access parameter definitions if available in the client
            // This would use getParameterDefinition from the client library
            return null; // Placeholder for now - would use actual parameter definitions
        }
        catch (error) {
            return null;
        }
    }
    getMissionCommandName(command) {
        const commandNames = {
            16: 'WAYPOINT',
            17: 'LOITER_UNLIM',
            18: 'LOITER_TURNS',
            19: 'LOITER_TIME',
            20: 'RETURN_TO_LAUNCH',
            21: 'LAND',
            22: 'TAKEOFF',
            84: 'SPLINE_WAYPOINT',
            95: 'NAV_FOLLOW',
            112: 'CONDITION_DELAY',
            113: 'CONDITION_CHANGE_ALT',
            114: 'CONDITION_DISTANCE',
            115: 'CONDITION_YAW'
        };
        return commandNames[command] || `CMD_${command}`;
    }
    async createWaypointMission() {
        console.log(chalk.blue('\n📍 Create Waypoint Mission'));
        const waypoints = [];
        let addMore = true;
        let waypointNum = 1;
        while (addMore) {
            console.log(chalk.gray(`\nWaypoint #${waypointNum}:`));
            const lat = await this.uiHelpers.getNumberInput('Latitude:', 37.7749 + (waypointNum - 1) * 0.001, -90, 90);
            const lng = await this.uiHelpers.getNumberInput('Longitude:', -122.4194 + (waypointNum - 1) * 0.001, -180, 180);
            const alt = await this.uiHelpers.getNumberInput('Altitude (meters):', 20, 1, 500);
            waypoints.push({
                seq: waypointNum - 1,
                frame: 3, // Global relative altitude
                command: 16, // NAV_WAYPOINT
                current: waypointNum === 1 ? 1 : 0,
                autocontinue: 1,
                param1: 0,
                param2: 0,
                param3: 0,
                param4: 0,
                x: lat,
                y: lng,
                z: alt
            });
            waypointNum++;
            addMore = await this.uiHelpers.confirmAction('Add another waypoint?', waypoints.length < 5);
        }
        return waypoints;
    }
    async createRTLMission() {
        console.log(chalk.blue('\n🏠 Create Return to Launch Mission'));
        const altitude = await this.uiHelpers.getNumberInput('RTL altitude (meters):', 30, 10, 100);
        return [{
                seq: 0,
                frame: 3,
                command: 20, // RETURN_TO_LAUNCH
                current: 1,
                autocontinue: 1,
                param1: 0,
                param2: 0,
                param3: 0,
                param4: 0,
                x: 0,
                y: 0,
                z: altitude
            }];
    }
    async createLandMission() {
        console.log(chalk.blue('\n🛬 Create Land Mission'));
        const lat = await this.uiHelpers.getNumberInput('Landing latitude:', 37.7749, -90, 90);
        const lng = await this.uiHelpers.getNumberInput('Landing longitude:', -122.4194, -180, 180);
        const abort_alt = await this.uiHelpers.getNumberInput('Abort altitude (meters):', 10, 0, 50);
        return [{
                seq: 0,
                frame: 3,
                command: 21, // LAND
                current: 1,
                autocontinue: 1,
                param1: abort_alt,
                param2: 0,
                param3: 0,
                param4: 0,
                x: lat,
                y: lng,
                z: 0
            }];
    }
    calculateMissionDistance(items) {
        if (items.length < 2)
            return '0 m';
        let totalDistance = 0;
        for (let i = 1; i < items.length; i++) {
            const prev = items[i - 1];
            const curr = items[i];
            if (prev.x && prev.y && curr.x && curr.y) {
                const distance = this.calculateDistance(prev.x, prev.y, curr.x, curr.y);
                totalDistance += distance;
            }
        }
        return totalDistance > 1000 ?
            `${(totalDistance / 1000).toFixed(2)} km` :
            `${Math.round(totalDistance)} m`;
    }
    estimateMissionTime(items) {
        if (items.length === 0)
            return '0 min';
        // Simple time estimation based on distance and average speed
        const distanceStr = this.calculateMissionDistance(items);
        const distance = parseFloat(distanceStr);
        const unit = distanceStr.includes('km') ? 'km' : 'm';
        const distanceMeters = unit === 'km' ? distance * 1000 : distance;
        const avgSpeed = 5; // 5 m/s average speed
        const timeSeconds = distanceMeters / avgSpeed;
        const minutes = Math.round(timeSeconds / 60);
        return `${minutes} min`;
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    async monitorMissionProgress(client) {
        console.log(chalk.blue.bold('\n📊 Mission Progress Monitor'));
        console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
        let monitoring = true;
        const originalHandler = process.on('SIGINT', () => {
            monitoring = false;
            console.log(chalk.yellow('\n\nMission monitoring stopped'));
        });
        try {
            while (monitoring) {
                // Clear screen and show mission progress
                console.clear();
                console.log(chalk.cyan.bold('📊 Mission Progress Monitor'));
                console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}\n`));
                // Note: This would get real mission progress data
                // For now showing structure with simulated data
                console.log(chalk.blue('🗺️ Mission Status:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Current Waypoint': '2 of 5',
                    'Progress': '40%',
                    'Distance to WP': '45 m',
                    'ETA to WP': '12 sec',
                    'Total Progress': '2.1 km of 5.2 km'
                });
                console.log(chalk.blue('\n🚁 Vehicle Status:'));
                this.uiHelpers.displayKeyValuePairs({
                    'Flight Mode': 'AUTO',
                    'Altitude': '25.3 m',
                    'Ground Speed': '3.8 m/s',
                    'Battery': '78%'
                });
                console.log(chalk.gray('\nPress Ctrl+C to stop monitoring...'));
                console.log(chalk.yellow('\n⚠️ Note: This is simulated data for demonstration'));
                // Wait 2 seconds before next update
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        catch (error) {
            this.uiHelpers.displayError('Monitoring error', error);
        }
        finally {
            process.removeListener('SIGINT', originalHandler);
        }
    }
}
//# sourceMappingURL=MAVLinkCommands.js.map