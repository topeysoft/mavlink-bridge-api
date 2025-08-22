import chalk from 'chalk';
import ora from 'ora';
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';

export class MAVLinkCommands {
  constructor(
    private context: ConsoleContext,
    private clientManager: ClientManager,
    private uiHelpers: UIHelpers
  ) {}

  public async showVehicleStatus(): Promise<void> {
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
      // Note: These API calls might need adjustment based on actual MAVLink API
      // This is a placeholder implementation showing the structure
      
      spinner.succeed('Vehicle status retrieved');
      
      console.log(chalk.green('\n🚁 Flight Status:'));
      this.uiHelpers.displayKeyValuePairs({
        'Armed Status': 'Disarmed', // Would come from actual telemetry
        'Flight Mode': 'STABILIZE',
        'System Status': 'Standby',
        'MAV Type': 'Quadrotor'
      });
      
      console.log(chalk.green('\n📍 GPS Status:'));
      this.uiHelpers.displayKeyValuePairs({
        'Fix Type': '3D Fix',
        'Satellites': '12',
        'HDOP': '1.2',
        'Location': '37.7749°N, 122.4194°W',
        'Altitude': '10.5 m'
      });
      
      console.log(chalk.green('\n🔋 Battery Status:'));
      this.uiHelpers.displayKeyValuePairs({
        'Voltage': '12.4 V',
        'Current': '5.2 A',
        'Remaining': '85%',
        'Estimated Flight Time': '18 minutes'
      });
      
      console.log(chalk.green('\n📊 System Health:'));
      this.uiHelpers.displayKeyValuePairs({
        'IMU': '✅ Healthy',
        'GPS': '✅ Healthy',
        'Compass': '✅ Healthy',
        'Barometer': '✅ Healthy',
        'RC Input': '✅ Connected'
      });
      
      console.log(chalk.yellow('\n⚠️  Note: This is a demonstration. Real telemetry'));
      console.log(chalk.gray('   will be available when MAVLink streaming is implemented.'));
      
    } catch (error) {
      spinner.fail('Failed to get vehicle status');
      this.uiHelpers.displayError('Could not retrieve vehicle status', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async flightControlMenu(): Promise<void> {
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
    
    const action = await this.uiHelpers.selectFromList(
      'Select flight control action:',
      [
        { name: '🔐 Arm Vehicle', value: 'arm' },
        { name: '🔓 Disarm Vehicle', value: 'disarm' },
        { name: '🎯 Set Flight Mode', value: 'mode' },
        { name: '🏠 Return to Launch', value: 'rtl' },
        { name: '⏸️  Pause Mission', value: 'pause' },
        { name: '▶️  Resume Mission', value: 'resume' },
        { name: '🛑 Emergency Stop', value: 'stop' },
        { name: '🔙 Back to MAVLink Menu', value: 'back' }
      ]
    );
    
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

  private async armVehicle(): Promise<void> {
    console.log(chalk.blue('\n🔐 Arm Vehicle'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Are you sure you want to arm the vehicle? This will enable motors.',
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Arm command cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Arming vehicle...').start();
    
    try {
      const response = await client.mavlink.commands.arm();
      
      if (response.success) {
        spinner.succeed('Vehicle armed successfully');
        this.uiHelpers.displaySuccess('Vehicle is now armed');
        this.uiHelpers.displayWarning('Motors are now enabled! Handle with care.');
      } else {
        spinner.fail('Failed to arm vehicle');
        this.uiHelpers.displayError('Arm command failed', response.message);
      }
    } catch (error) {
      spinner.fail('Arm command failed');
      this.uiHelpers.displayError('Could not arm vehicle', error);
    }
  }

  private async disarmVehicle(): Promise<void> {
    console.log(chalk.blue('\n🔓 Disarm Vehicle'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Are you sure you want to disarm the vehicle?',
      true
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Disarm command cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Disarming vehicle...').start();
    
    try {
      const response = await client.mavlink.commands.disarm();
      
      if (response.success) {
        spinner.succeed('Vehicle disarmed successfully');
        this.uiHelpers.displaySuccess('Vehicle is now disarmed');
      } else {
        spinner.fail('Failed to disarm vehicle');
        this.uiHelpers.displayError('Disarm command failed', response.message);
      }
    } catch (error) {
      spinner.fail('Disarm command failed');
      this.uiHelpers.displayError('Could not disarm vehicle', error);
    }
  }

  private async setFlightMode(): Promise<void> {
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
    
    const selectedMode = await this.uiHelpers.selectFromList(
      'Select flight mode:',
      modeOptions
    );
    
    const modeName = modeOptions.find(m => m.value === selectedMode)?.name;
    
    const confirmed = await this.uiHelpers.confirmAction(
      `Set flight mode to ${modeName}?`,
      true
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Mode change cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora(`Setting flight mode to ${modeName}...`).start();
    
    try {
      const response = await client.mavlink.commands.setMode(selectedMode);
      
      if (response.success) {
        spinner.succeed(`Flight mode set to ${modeName}`);
        this.uiHelpers.displaySuccess(`Vehicle is now in ${modeName} mode`);
      } else {
        spinner.fail('Failed to set flight mode');
        this.uiHelpers.displayError('Mode change failed', response.message);
      }
    } catch (error) {
      spinner.fail('Mode change failed');
      this.uiHelpers.displayError('Could not set flight mode', error);
    }
  }

  private async returnToLaunch(): Promise<void> {
    console.log(chalk.blue('\n🏠 Return to Launch'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Command vehicle to return to launch position?',
      true
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('RTL command cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Commanding return to launch...').start();
    
    try {
      const response = await client.mavlink.commands.returnToLaunch();
      
      if (response.success) {
        spinner.succeed('Return to launch commanded');
        this.uiHelpers.displaySuccess('Vehicle is returning to launch position');
        this.uiHelpers.displayInfo('Monitor vehicle status for progress');
      } else {
        spinner.fail('Failed to command RTL');
        this.uiHelpers.displayError('RTL command failed', response.message);
      }
    } catch (error) {
      spinner.fail('RTL command failed');
      this.uiHelpers.displayError('Could not command return to launch', error);
    }
  }

  private async pauseMission(): Promise<void> {
    console.log(chalk.blue('\n⏸️  Pause Mission'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Pausing current mission...').start();
    
    try {
      // This would typically involve setting guided mode or sending mission pause command
      const response = await client.mavlink.commands.setMode(4); // Guided mode
      
      if (response.success) {
        spinner.succeed('Mission paused');
        this.uiHelpers.displaySuccess('Current mission has been paused');
        this.uiHelpers.displayInfo('Vehicle is now in guided mode');
      } else {
        spinner.fail('Failed to pause mission');
        this.uiHelpers.displayError('Pause command failed', response.message);
      }
    } catch (error) {
      spinner.fail('Pause command failed');
      this.uiHelpers.displayError('Could not pause mission', error);
    }
  }

  private async resumeMission(): Promise<void> {
    console.log(chalk.blue('\n▶️  Resume Mission'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Resuming mission...').start();
    
    try {
      // Switch back to auto mode to resume mission
      const response = await client.mavlink.commands.setMode(3); // Auto mode
      
      if (response.success) {
        spinner.succeed('Mission resumed');
        this.uiHelpers.displaySuccess('Mission has been resumed');
        this.uiHelpers.displayInfo('Vehicle is now in auto mode');
      } else {
        spinner.fail('Failed to resume mission');
        this.uiHelpers.displayError('Resume command failed', response.message);
      }
    } catch (error) {
      spinner.fail('Resume command failed');
      this.uiHelpers.displayError('Could not resume mission', error);
    }
  }

  private async emergencyStop(): Promise<void> {
    console.log(chalk.red.bold('\n🛑 EMERGENCY STOP'));
    console.log(chalk.red('This will immediately stop all motors!'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Execute EMERGENCY STOP? This action is immediate and cannot be undone!',
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Emergency stop cancelled');
      return;
    }
    
    const doubleConfirm = await this.uiHelpers.confirmAction(
      'FINAL WARNING: This will immediately cut power to all motors!',
      false
    );
    
    if (!doubleConfirm) {
      this.uiHelpers.displayInfo('Emergency stop cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('EXECUTING EMERGENCY STOP...').start();
    
    try {
      // Force disarm immediately
      const response = await client.mavlink.commands.disarm({ force: true });
      
      if (response.success) {
        spinner.succeed('EMERGENCY STOP EXECUTED');
        this.uiHelpers.displaySuccess('All motors have been stopped');
        console.log(chalk.red('\n⚠️  EMERGENCY STOP COMPLETE'));
        console.log(chalk.yellow('Vehicle systems may require restart before next operation'));
      } else {
        spinner.fail('Emergency stop failed');
        this.uiHelpers.displayError('Emergency stop command failed', response.message);
      }
    } catch (error) {
      spinner.fail('Emergency stop failed');
      this.uiHelpers.displayError('Could not execute emergency stop', error);
    }
  }

  public async parameterMenu(): Promise<void> {
    console.log(chalk.blue.bold('\n⚙️  MAVLink Parameters'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const action = await this.uiHelpers.selectFromList(
      'Parameter management options:',
      [
        { name: '📋 List All Parameters', value: 'list' },
        { name: '🔍 Search Parameters', value: 'search' },
        { name: '📄 Get Parameter Value', value: 'get' },
        { name: '✏️  Set Parameter Value', value: 'set' },
        { name: '💾 Backup Parameters', value: 'backup' },
        { name: '📁 Restore Parameters', value: 'restore' },
        { name: '🔄 Refresh Parameter List', value: 'refresh' },
        { name: '🔙 Back to MAVLink Menu', value: 'back' }
      ]
    );
    
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

  private async listParameters(): Promise<void> {
    console.log(chalk.blue('\n📋 Parameter List'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Loading parameters...').start();
    
    try {
      // Start parameter streaming if not already active
      await client.mavlink.parameters.startParameterStream();
      
      // Get cached parameters
      const parameters = client.mavlink.parameters.getAllCachedParameters();
      
      if (parameters.length === 0) {
        // Request parameter list if cache is empty
        spinner.text = 'Requesting parameter list...';
        await client.mavlink.parameters.requestParameterList();
        
        // Wait a moment for parameters to arrive
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const updatedParameters = client.mavlink.parameters.getAllCachedParameters();
        
        if (updatedParameters.length === 0) {
          spinner.warn('No parameters received');
          console.log(chalk.yellow('\n⚠️  No parameters available'));
          console.log(chalk.gray('Make sure MAVLink connection is established'));
          return;
        }
      }
      
      spinner.succeed(`Found ${parameters.length} parameters`);
      
      // Show parameters in pages
      const pageSize = 20;
      const totalPages = Math.ceil(parameters.length / pageSize);
      let currentPage = 0;
      
      while (currentPage < totalPages) {
        const startIdx = currentPage * pageSize;
        const endIdx = Math.min(startIdx + pageSize, parameters.length);
        const pageParams = parameters.slice(startIdx, endIdx);
        
        console.log(chalk.green(`\n📋 Parameters (Page ${currentPage + 1} of ${totalPages}):`));
        const table = this.uiHelpers.createTable(['Name', 'Value', 'Type']);
        
        pageParams.forEach(param => {
          table.push([
            param.name,
            param.value.toString(),
            param.type
          ]);
        });
        
        console.log(table.toString());
        
        if (currentPage < totalPages - 1) {
          const showNext = await this.uiHelpers.confirmAction(
            `Show next page (${currentPage + 2} of ${totalPages})?`,
            true
          );
          
          if (!showNext) break;
        }
        
        currentPage++;
      }
      
    } catch (error) {
      spinner.fail('Failed to load parameters');
      this.uiHelpers.displayError('Could not list parameters', error);
    }
  }

  private async searchParameters(): Promise<void> {
    console.log(chalk.blue('\n🔍 Search Parameters'));
    
    const searchTerm = await this.uiHelpers.getTextInput(
      'Enter search term (e.g., AHRS, GPS, BATT):',
      'AHRS',
      (input) => {
        if (!input.trim()) return { valid: false, error: 'Search term cannot be empty' };
        return { valid: true };
      }
    );
    
    const client = this.clientManager.getClient()!;
    const spinner = ora(`Searching for parameters containing "${searchTerm}"...`).start();
    
    try {
      const searchOptions = {
        query: searchTerm,
        limit: 50
      };
      
      const results = client.mavlink.parameters.searchCachedParameters(searchOptions);
      
      if (results.parameters.length === 0) {
        spinner.warn('No matching parameters found');
        console.log(chalk.yellow(`\n⚠️  No parameters found matching "${searchTerm}"`));
        console.log(chalk.gray('Try a different search term or ensure parameters are loaded'));
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
      }
      
    } catch (error) {
      spinner.fail('Search failed');
      this.uiHelpers.displayError('Could not search parameters', error);
    }
  }

  private async getParameter(): Promise<void> {
    console.log(chalk.blue('\n📄 Get Parameter'));
    
    const paramName = await this.uiHelpers.getTextInput(
      'Enter parameter name (e.g., AHRS_GPS_GAIN):',
      'AHRS_GPS_GAIN',
      (input) => {
        if (!input.trim()) return { valid: false, error: 'Parameter name cannot be empty' };
        if (input.length > 16) return { valid: false, error: 'Parameter name too long (max 16 chars)' };
        return { valid: true };
      }
    );
    
    const client = this.clientManager.getClient()!;
    const spinner = ora(`Getting parameter ${paramName}...`).start();
    
    try {
      // First check cache
      let parameter = client.mavlink.parameters.getParameterFromCache(paramName);
      
      if (!parameter) {
        // Request parameter if not in cache
        spinner.text = `Requesting ${paramName} from flight controller...`;
        const response = await client.mavlink.parameters.requestParameter(paramName);
        
        if (response.success) {
          // Wait for parameter to arrive via stream
          parameter = await client.mavlink.parameters.waitForParameter(paramName, 5000);
        } else {
          throw new Error(response.message || 'Parameter request failed');
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
      
    } catch (error) {
      spinner.fail(`Failed to get parameter ${paramName}`);
      this.uiHelpers.displayError('Could not retrieve parameter', error);
    }
  }

  private async setParameter(): Promise<void> {
    console.log(chalk.blue('\n✏️  Set Parameter'));
    console.log(chalk.red('⚠️  WARNING: Changing parameters can affect vehicle behavior!'));
    
    const paramName = await this.uiHelpers.getTextInput(
      'Parameter name:',
      'AHRS_GPS_GAIN',
      (input) => {
        if (!input.trim()) return { valid: false, error: 'Parameter name cannot be empty' };
        if (input.length > 16) return { valid: false, error: 'Parameter name too long (max 16 chars)' };
        return { valid: true };
      }
    );
    
    const client = this.clientManager.getClient()!;
    
    // Get current value first
    let currentParameter;
    try {
      currentParameter = client.mavlink.parameters.getParameterFromCache(paramName);
      if (!currentParameter) {
        const response = await client.mavlink.parameters.requestParameter(paramName);
        if (response.success) {
          currentParameter = await client.mavlink.parameters.waitForParameter(paramName, 3000);
        }
      }
    } catch (error) {
      // Parameter might not exist yet
    }
    
    if (currentParameter) {
      console.log(chalk.blue(`\nCurrent value: ${currentParameter.value}`));
    }
    
    const paramValue = await this.uiHelpers.getNumberInput(
      'New parameter value:',
      currentParameter?.value || 1.0
    );
    
    // Show parameter info if available
    const definition = this.getParameterDefinition(paramName);
    if (definition) {
      console.log(chalk.blue('\n📝 Parameter Info:'));
      console.log(chalk.gray(`Description: ${definition.description || 'No description'}`));
      if (definition.range) {
        console.log(chalk.gray(`Valid range: ${definition.range.min} - ${definition.range.max}`));
        
        if (paramValue < definition.range.min || paramValue > definition.range.max) {
          this.uiHelpers.displayWarning(`Value ${paramValue} is outside recommended range!`);
        }
      }
    }
    
    const confirmed = await this.uiHelpers.confirmAction(
      `Set ${paramName} = ${paramValue}? This may affect vehicle behavior.`,
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Parameter change cancelled');
      return;
    }
    
    const spinner = ora(`Setting ${paramName} = ${paramValue}...`).start();
    
    try {
      const response = await client.mavlink.parameters.setParameter(paramName, paramValue);
      
      if (response.success) {
        spinner.succeed(`Parameter ${paramName} updated`);
        this.uiHelpers.displaySuccess(`${paramName} = ${paramValue}`);
        
        if (definition?.rebootRequired) {
          this.uiHelpers.displayWarning('This parameter requires a reboot to take effect');
        }
      } else {
        spinner.fail('Failed to set parameter');
        this.uiHelpers.displayError('Parameter update failed', response.message);
      }
    } catch (error) {
      spinner.fail('Parameter update failed');
      this.uiHelpers.displayError('Could not set parameter', error);
    }
  }

  private async backupParameters(): Promise<void> {
    console.log(chalk.blue('\n💾 Backup Parameters'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Creating parameter backup...').start();
    
    try {
      const parameters = client.mavlink.parameters.getAllCachedParameters();
      
      if (parameters.length === 0) {
        spinner.warn('No parameters in cache');
        this.uiHelpers.displayWarning('No parameters available for backup');
        this.uiHelpers.displayInfo('Load parameters first using the parameter list option');
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        timestamp: new Date().toISOString(),
        deviceUrl: this.context.deviceUrl,
        parameterCount: parameters.length,
        parameters: parameters.reduce((acc, param) => {
          acc[param.name] = {
            value: param.value,
            type: param.type,
            timestamp: param.timestamp
          };
          return acc;
        }, {} as Record<string, any>)
      };
      
      const backupJson = JSON.stringify(backupData, null, 2);
      
      spinner.succeed('Parameter backup created');
      
      console.log(chalk.green('\n📋 Backup Summary:'));
      this.uiHelpers.displayKeyValuePairs({
        'Backup Time': backupData.timestamp,
        'Device URL': this.context.deviceUrl || 'Unknown',
        'Parameters': backupData.parameterCount,
        'Suggested Filename': `mavlink-params-${timestamp}.json`,
        'Backup Size': this.uiHelpers.formatBytes(Buffer.byteLength(backupJson, 'utf8'))
      });
      
      console.log(chalk.blue('\n📄 Parameter Backup Data:'));
      console.log(chalk.gray(backupJson));
      
      console.log(chalk.yellow('\n💡 Tip: Copy the backup data above to save as a file'));
      
    } catch (error) {
      spinner.fail('Backup failed');
      this.uiHelpers.displayError('Could not create parameter backup', error);
    }
  }

  private async restoreParameters(): Promise<void> {
    console.log(chalk.blue('\n📁 Restore Parameters'));
    
    console.log(chalk.red.bold('\n⚠️  WARNING: Parameter restore can significantly change vehicle behavior!'));
    console.log(chalk.red('• Only restore parameters from the same vehicle type'));
    console.log(chalk.red('• Incorrect parameters can cause crashes or damage'));
    console.log(chalk.red('• Always verify parameters after restore'));
    
    const proceed = await this.uiHelpers.confirmAction(
      'Do you understand the risks and want to continue?',
      false
    );
    
    if (!proceed) {
      this.uiHelpers.displayInfo('Parameter restore cancelled');
      return;
    }
    
    console.log(chalk.yellow('\nPlease paste your parameter backup JSON data:'));
    const backupJson = await this.uiHelpers.getTextInput(
      'Backup JSON:',
      '',
      (input) => {
        try {
          const parsed = JSON.parse(input);
          if (!parsed.parameters) {
            return { valid: false, error: 'Invalid backup format - missing parameters' };
          }
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid JSON format' };
        }
      }
    );
    
    try {
      const backupData = JSON.parse(backupJson);
      const parameterNames = Object.keys(backupData.parameters);
      
      console.log(chalk.blue('\n📋 Backup Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'Backup Date': backupData.timestamp || 'Unknown',
        'Source Device': backupData.deviceUrl || 'Unknown',
        'Parameter Count': parameterNames.length
      });
      
      const confirmed = await this.uiHelpers.confirmAction(
        `Restore ${parameterNames.length} parameters? This will overwrite current values.`,
        false
      );
      
      if (!confirmed) {
        this.uiHelpers.displayInfo('Restore cancelled');
        return;
      }
      
      const client = this.clientManager.getClient()!;
      const spinner = ora('Restoring parameters...').start();
      
      let successCount = 0;
      let failCount = 0;
      
      for (const [paramName, paramData] of Object.entries(backupData.parameters)) {
        try {
          const response = await client.mavlink.parameters.setParameter(
            paramName,
            (paramData as any).value
          );
          
          if (response.success) {
            successCount++;
          } else {
            failCount++;
            console.log(chalk.red(`\n• Failed to set ${paramName}: ${response.message}`));
          }
          
          spinner.text = `Restoring parameters... ${successCount + failCount}/${parameterNames.length}`;
          
          // Small delay to avoid overwhelming the flight controller
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          failCount++;
          console.log(chalk.red(`\n• Error setting ${paramName}: ${error}`));
        }
      }
      
      if (failCount === 0) {
        spinner.succeed(`All ${successCount} parameters restored successfully`);
        this.uiHelpers.displaySuccess('Parameter restore completed');
      } else {
        spinner.warn(`Restore completed with issues`);
        this.uiHelpers.displayWarning(`${successCount} succeeded, ${failCount} failed`);
      }
      
      this.uiHelpers.displayInfo('Recommend verifying critical parameters before flight');
      
    } catch (error) {
      this.uiHelpers.displayError('Failed to restore parameters', error);
    }
  }

  private async refreshParameters(): Promise<void> {
    console.log(chalk.blue('\n🔄 Refresh Parameters'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Refreshing parameter list...').start();
    spinner.text = 'This may take several minutes for large parameter sets...';
    
    try {
      // Clear existing cache
      client.mavlink.parameters.clearCache();
      
      // Start parameter streaming
      await client.mavlink.parameters.startParameterStream();
      
      // Request fresh parameter list
      const response = await client.mavlink.parameters.requestParameterList();
      
      if (!response.success) {
        throw new Error(response.message || 'Parameter list request failed');
      }
      
      spinner.text = 'Waiting for parameters to arrive...';
      
      // Wait for parameters to populate cache
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      while (attempts < maxAttempts) {
        const parameters = client.mavlink.parameters.getAllCachedParameters();
        
        if (parameters.length > 0) {
          spinner.succeed(`Parameter refresh completed - ${parameters.length} parameters loaded`);
          this.uiHelpers.displaySuccess(`${parameters.length} parameters are now available`);
          
          const stats = client.mavlink.parameters.getCacheStats();
          
          console.log(chalk.blue('\n📋 Parameter Statistics:'));
          this.uiHelpers.displayKeyValuePairs({
            'Total Parameters': stats.totalParameters,
            'Last Update': new Date(stats.lastUpdate).toLocaleString(),
            'Categories': Object.keys(stats.categoryCounts).length
          });
          
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        if (attempts % 5 === 0) {
          spinner.text = `Still waiting for parameters... (${attempts}s)`;
        }
      }
      
      spinner.warn('Parameter refresh timed out');
      this.uiHelpers.displayWarning('Parameters may still be loading in background');
      
    } catch (error) {
      spinner.fail('Parameter refresh failed');
      this.uiHelpers.displayError('Could not refresh parameters', error);
    }
  }

  public async missionMenu(): Promise<void> {
    console.log(chalk.blue.bold('\n🗺️  Mission Planning'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const action = await this.uiHelpers.selectFromList(
      'Mission management options:',
      [
        { name: '📋 List Current Mission', value: 'list' },
        { name: '📝 Create New Mission', value: 'create' },
        { name: '📂 Load Mission File', value: 'load' },
        { name: '💾 Save Mission', value: 'save' },
        { name: '🚀 Execute Mission', value: 'execute' },
        { name: '⏸️  Pause Mission', value: 'pause' },
        { name: '🗑️  Clear Mission', value: 'clear' },
        { name: '🔙 Back to MAVLink Menu', value: 'back' }
      ]
    );
    
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

  private async listMission(): Promise<void> {
    console.log(chalk.blue('\n📋 Current Mission'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Loading mission waypoints...').start();
    
    try {
      const mission = await client.mavlink.mission.getCurrentMission();
      
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
        'Mission Type': mission.type || 'Waypoint',
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
      
    } catch (error) {
      spinner.fail('Failed to load mission');
      this.uiHelpers.displayError('Could not retrieve mission', error);
    }
  }

  private async createMission(): Promise<void> {
    console.log(chalk.blue('\n📝 Create Mission'));
    
    const missionType = await this.uiHelpers.selectFromList(
      'Select mission type:',
      [
        { name: '🗺️ Simple Waypoint Mission', value: 'waypoint' },
        { name: '🔄 Return to Launch', value: 'rtl' },
        { name: '🏠 Land at Location', value: 'land' },
        { name: '🔙 Back', value: 'back' }
      ]
    );
    
    if (missionType === 'back') return;
    
    const client = this.clientManager.getClient()!;
    
    try {
      let missionItems: any[] = [];
      
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
      
      const confirmed = await this.uiHelpers.confirmAction(
        `Upload mission with ${missionItems.length} waypoints?`,
        true
      );
      
      if (!confirmed) {
        this.uiHelpers.displayInfo('Mission creation cancelled');
        return;
      }
      
      const spinner = ora('Uploading mission...').start();
      
      await client.mavlink.mission.uploadMission(missionItems);
      
      spinner.succeed('Mission uploaded successfully');
      this.uiHelpers.displaySuccess(`Mission with ${missionItems.length} waypoints is now loaded`);
      
    } catch (error) {
      this.uiHelpers.displayError('Failed to create mission', error);
    }
  }

  private async loadMission(): Promise<void> {
    console.log(chalk.blue('\n📂 Load Mission'));
    
    console.log(chalk.yellow('Please paste your mission data (JSON format):'));
    const missionJson = await this.uiHelpers.getTextInput(
      'Mission JSON:',
      '',
      (input) => {
        try {
          const parsed = JSON.parse(input);
          if (!parsed.items || !Array.isArray(parsed.items)) {
            return { valid: false, error: 'Invalid mission format - missing items array' };
          }
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid JSON format' };
        }
      }
    );
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Loading mission...').start();
    
    try {
      const missionData = JSON.parse(missionJson);
      
      console.log(chalk.blue('\n📋 Mission Information:'));
      this.uiHelpers.displayKeyValuePairs({
        'Name': missionData.name || 'Unnamed Mission',
        'Waypoints': missionData.items.length,
        'Type': missionData.type || 'Waypoint Mission'
      });
      
      const confirmed = await this.uiHelpers.confirmAction(
        `Load this mission with ${missionData.items.length} waypoints?`,
        true
      );
      
      if (!confirmed) {
        this.uiHelpers.displayInfo('Mission load cancelled');
        return;
      }
      
      await client.mavlink.mission.uploadMission(missionData.items);
      
      spinner.succeed('Mission loaded successfully');
      this.uiHelpers.displaySuccess('Mission is now ready for execution');
      
    } catch (error) {
      spinner.fail('Failed to load mission');
      this.uiHelpers.displayError('Could not load mission', error);
    }
  }

  private async saveMission(): Promise<void> {
    console.log(chalk.blue('\n💾 Save Mission'));
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Getting current mission...').start();
    
    try {
      const mission = await client.mavlink.mission.getCurrentMission();
      
      if (!mission || mission.items.length === 0) {
        spinner.warn('No mission to save');
        console.log(chalk.yellow('\n⚠️  No mission currently loaded'));
        console.log(chalk.gray('Load or create a mission first'));
        return;
      }
      
      const missionName = await this.uiHelpers.getTextInput(
        'Mission name:',
        `Mission_${new Date().toISOString().split('T')[0]}`
      );
      
      const timestamp = new Date().toISOString();
      const missionData = {
        name: missionName,
        timestamp,
        type: mission.type || 'Waypoint Mission',
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
      
    } catch (error) {
      spinner.fail('Failed to save mission');
      this.uiHelpers.displayError('Could not save mission', error);
    }
  }

  private async executeMission(): Promise<void> {
    console.log(chalk.blue('\n🚀 Execute Mission'));
    
    const client = this.clientManager.getClient()!;
    
    try {
      // Check if mission is loaded
      const mission = await client.mavlink.mission.getCurrentMission();
      
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
      
      const confirmed = await this.uiHelpers.confirmAction(
        'Start mission execution? This will switch to AUTO mode.',
        false
      );
      
      if (!confirmed) {
        this.uiHelpers.displayInfo('Mission execution cancelled');
        return;
      }
      
      const spinner = ora('Starting mission execution...').start();
      
      // Switch to AUTO mode to start mission
      const response = await client.mavlink.commands.setMode(3); // AUTO mode
      
      if (response.success) {
        spinner.succeed('Mission execution started');
        this.uiHelpers.displaySuccess('Mission is now executing');
        this.uiHelpers.displayInfo('Vehicle is in AUTO mode');
        
        const monitor = await this.uiHelpers.confirmAction(
          'Monitor mission progress?',
          true
        );
        
        if (monitor) {
          await this.monitorMissionProgress(client);
        }
      } else {
        spinner.fail('Failed to start mission');
        this.uiHelpers.displayError('Could not switch to AUTO mode', response.message);
      }
      
    } catch (error) {
      this.uiHelpers.displayError('Mission execution failed', error);
    }
  }

  private async clearMission(): Promise<void> {
    console.log(chalk.blue('\n🗑️  Clear Mission'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Clear all waypoints from the current mission?',
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Mission clear cancelled');
      return;
    }
    
    const client = this.clientManager.getClient()!;
    const spinner = ora('Clearing mission...').start();
    
    try {
      await client.mavlink.mission.clearMission();
      
      spinner.succeed('Mission cleared');
      this.uiHelpers.displaySuccess('All waypoints have been removed');
      this.uiHelpers.displayInfo('Flight controller mission is now empty');
      
    } catch (error) {
      spinner.fail('Failed to clear mission');
      this.uiHelpers.displayError('Could not clear mission', error);
    }
  }

  public async startTelemetryStream(): Promise<void> {
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
    
    const originalHandler = process.on('SIGINT', () => {
      streaming = false;
      console.log(chalk.yellow('\n\nTelemetry stream stopped'));
    });
    
    try {
      while (streaming) {
        // Clear screen and show current telemetry
        console.clear();
        console.log(chalk.cyan.bold('📡 Real-time Telemetry Display'));
        console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}\n`));
        
        // Note: This would normally get real telemetry data
        // For now, showing the structure with simulated data
        
        console.log(chalk.green('🚁 Flight Status:'));
        this.uiHelpers.displayKeyValuePairs({
          'Armed': 'Disarmed',
          'Flight Mode': 'STABILIZE',
          'System Status': 'Standby'
        });
        
        console.log(chalk.green('\n📍 Position:'));
        this.uiHelpers.displayKeyValuePairs({
          'Latitude': '37.7749°',
          'Longitude': '-122.4194°',
          'Altitude': '15.2 m',
          'Ground Speed': '0.0 m/s'
        });
        
        console.log(chalk.green('\n🦭 Attitude:'));
        this.uiHelpers.displayKeyValuePairs({
          'Roll': '0.5°',
          'Pitch': '-1.2°',
          'Yaw': '45.8°',
          'Heading': '045° NE'
        });
        
        console.log(chalk.green('\n🔋 Battery:'));
        this.uiHelpers.displayKeyValuePairs({
          'Voltage': '12.4 V',
          'Current': '2.1 A',
          'Remaining': '87%',
          'Flight Time': '15 min'
        });
        
        console.log(chalk.green('\n📶 GPS:'));
        this.uiHelpers.displayKeyValuePairs({
          'Fix Type': '3D GPS',
          'Satellites': '14',
          'HDOP': '0.8',
          'Accuracy': '±3.2 m'
        });
        
        console.log(chalk.gray('\nPress Ctrl+C to stop telemetry stream...'));
        console.log(chalk.yellow('\n⚠️  Note: This is simulated data for demonstration'));
        
        // Wait 1 second before next update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.uiHelpers.displayError('Telemetry stream error', error);
    } finally {
      process.removeListener('SIGINT', originalHandler as any);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  private getParameterDefinition(paramName: string): any {
    // This would normally come from the parameter definitions in the client
    // For now, return a placeholder structure
    const commonParams: Record<string, any> = {
      'AHRS_GPS_GAIN': {
        description: 'AHRS GPS gain',
        units: '',
        range: { min: 0.0, max: 2.0 },
        userLevel: 'Advanced'
      },
      'BATT_MONITOR': {
        description: 'Battery monitoring',
        units: '',
        range: { min: 0, max: 21 },
        userLevel: 'Standard'
      },
      'GPS_TYPE': {
        description: 'GPS type',
        units: '',
        range: { min: 0, max: 22 },
        userLevel: 'Standard'
      }
    };

    return commonParams[paramName];
  }

  private getMissionCommandName(command: number): string {
    const commandNames: Record<number, string> = {
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

  private async createWaypointMission(): Promise<any[]> {
    console.log(chalk.blue('\n📍 Create Waypoint Mission'));
    
    const waypoints = [];
    let addMore = true;
    let waypointNum = 1;
    
    while (addMore) {
      console.log(chalk.gray(`\nWaypoint #${waypointNum}:`));
      
      const lat = await this.uiHelpers.getNumberInput(
        'Latitude:',
        37.7749 + (waypointNum - 1) * 0.001,
        -90,
        90
      );
      
      const lng = await this.uiHelpers.getNumberInput(
        'Longitude:',
        -122.4194 + (waypointNum - 1) * 0.001,
        -180,
        180
      );
      
      const alt = await this.uiHelpers.getNumberInput(
        'Altitude (meters):',
        20,
        1,
        500
      );
      
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
      
      addMore = await this.uiHelpers.confirmAction(
        'Add another waypoint?',
        waypoints.length < 5
      );
    }
    
    return waypoints;
  }

  private async createRTLMission(): Promise<any[]> {
    console.log(chalk.blue('\n🏠 Create Return to Launch Mission'));
    
    const altitude = await this.uiHelpers.getNumberInput(
      'RTL altitude (meters):',
      30,
      10,
      100
    );
    
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

  private async createLandMission(): Promise<any[]> {
    console.log(chalk.blue('\n🛬 Create Land Mission'));
    
    const lat = await this.uiHelpers.getNumberInput(
      'Landing latitude:',
      37.7749,
      -90,
      90
    );
    
    const lng = await this.uiHelpers.getNumberInput(
      'Landing longitude:',
      -122.4194,
      -180,
      180
    );
    
    const abort_alt = await this.uiHelpers.getNumberInput(
      'Abort altitude (meters):',
      10,
      0,
      50
    );
    
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

  private calculateMissionDistance(items: any[]): string {
    if (items.length < 2) return '0 m';
    
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

  private estimateMissionTime(items: any[]): string {
    if (items.length === 0) return '0 min';
    
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

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async monitorMissionProgress(client: any): Promise<void> {
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
    } catch (error) {
      this.uiHelpers.displayError('Monitoring error', error);
    } finally {
      process.removeListener('SIGINT', originalHandler as any);
    }
  }
}