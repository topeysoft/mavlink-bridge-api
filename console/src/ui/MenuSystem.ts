import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConsoleContext, MenuItem } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';
import { DeviceCommands } from '../commands/DeviceCommands.js';
import { ConfigCommands } from '../commands/ConfigCommands.js';
import { WiFiCommands } from '../commands/WiFiCommands.js';
import { MAVLinkCommands } from '../commands/MAVLinkCommands.js';
import { TaskCommands } from '../commands/TaskCommands.js';
import { RTCMCommands } from '../commands/RTCMCommands.js';

export class MenuSystem {
  private context: ConsoleContext;
  private clientManager: ClientManager;
  private uiHelpers: UIHelpers;
  private commands: {
    device: DeviceCommands;
    config: ConfigCommands;
    wifi: WiFiCommands;
    mavlink: MAVLinkCommands;
    tasks: TaskCommands;
    rtcm: RTCMCommands;
  };

  constructor(context: ConsoleContext, clientManager: ClientManager, uiHelpers: UIHelpers) {
    this.context = context;
    this.clientManager = clientManager;
    this.uiHelpers = uiHelpers;
    
    // Set context for client manager
    this.clientManager.setContext(context);
    
    // Initialize command modules
    this.commands = {
      device: new DeviceCommands(context, clientManager, uiHelpers),
      config: new ConfigCommands(context, clientManager, uiHelpers),
      wifi: new WiFiCommands(context, clientManager, uiHelpers),
      mavlink: new MAVLinkCommands(context, clientManager, uiHelpers),
      tasks: new TaskCommands(context, clientManager, uiHelpers),
      rtcm: new RTCMCommands(context, clientManager, uiHelpers)
    };
  }

  public async displayMainMenu(): Promise<void> {
    this.displayHeader();
    this.displayConnectionStatus();
    
    const menuItems: MenuItem[] = [
      {
        key: 'device',
        label: 'Device Management',
        description: 'Connect, discover, and manage devices',
        action: () => this.deviceMenu()
      },
      {
        key: 'health',
        label: 'Health & Monitoring',
        description: 'System health, diagnostics, and monitoring',
        action: () => this.healthMenu(),
        requiresConnection: true
      },
      {
        key: 'config',
        label: 'Configuration',
        description: 'Device settings and configuration management',
        action: () => this.configMenu(),
        requiresConnection: true
      },
      {
        key: 'wifi',
        label: 'WiFi Management',
        description: 'Network connections and WiFi settings',
        action: () => this.wifiMenu(),
        requiresConnection: true
      },
      {
        key: 'mavlink',
        label: 'MAVLink Control',
        description: 'Flight controller communication and control',
        action: () => this.mavlinkMenu(),
        requiresConnection: true
      },
      {
        key: 'tasks',
        label: 'Task Management',
        description: 'Create, manage, and execute tasks',
        action: () => this.taskMenu(),
        requiresConnection: true
      },
      {
        key: 'rtcm',
        label: 'RTCM Correction Data',
        description: 'Manage RTCM correction data sources',
        action: () => this.rtcmMenu(),
        requiresConnection: true
      },
      {
        key: 'tools',
        label: 'Tools & Utilities',
        description: 'Additional tools and utilities',
        action: () => this.toolsMenu()
      },
      {
        key: 'exit',
        label: 'Exit',
        description: 'Exit the console application',
        action: () => this.exit()
      }
    ];

    await this.displayMenu('Main Menu', menuItems);
  }

  private async displayMenu(title: string, items: MenuItem[]): Promise<void> {
    const choices = items
      .filter(item => !item.requiresConnection || this.context.connected)
      .map(item => ({
        name: `${chalk.bold(item.label)} - ${chalk.gray(item.description)}`,
        value: item,
        disabled: item.requiresConnection && !this.context.connected ? 'Requires connection' : false
      }));

    if (choices.length === 0) {
      this.uiHelpers.displayWarning('No menu options available. Please connect to a device first.');
      await this.uiHelpers.pressAnyKey();
      return;
    }

    const { selectedItem } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedItem',
      message: `${chalk.cyan.bold(title)} - Select an option:`,
      choices: choices,
      pageSize: 15
    }]);

    if (selectedItem.action) {
      try {
        await selectedItem.action();
      } catch (error) {
        this.uiHelpers.displayError('Menu action failed', error);
        await this.uiHelpers.pressAnyKey();
      }
    }
  }

  private displayHeader(): void {
    console.clear();
    console.log(chalk.cyan.bold('┌─────────────────────────────────────────┐'));
    console.log(chalk.cyan.bold('│        YardRover Console Manager        │'));
    console.log(chalk.cyan.bold('└─────────────────────────────────────────┘'));
    console.log();
  }

  private displayConnectionStatus(): void {
    if (this.context.connected) {
      this.uiHelpers.displayStatus('Connection', `Connected to ${this.context.deviceUrl}`, true);
    } else {
      this.uiHelpers.displayStatus('Connection', 'Not connected', false);
    }
    console.log();
  }

  private async deviceMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'discover',
        label: 'Discover Devices',
        description: 'Scan network for available devices',
        action: () => this.commands.device.discoverDevices()
      },
      {
        key: 'connect',
        label: 'Connect to Device',
        description: 'Connect to a device by URL',
        action: () => this.commands.device.connectToDevice()
      },
      {
        key: 'test',
        label: 'Test Connection',
        description: 'Test current device connection',
        action: () => this.commands.device.testConnection(),
        requiresConnection: true
      },
      {
        key: 'info',
        label: 'Device Info',
        description: 'Show detailed device information',
        action: () => this.commands.device.showDeviceInfo(),
        requiresConnection: true
      },
      {
        key: 'disconnect',
        label: 'Disconnect',
        description: 'Disconnect from current device',
        action: () => this.commands.device.disconnect(),
        requiresConnection: true
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('Device Management', items);
  }

  private async healthMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'status',
        label: 'System Status',
        description: 'Show current system health and status',
        action: () => this.commands.device.showSystemHealth()
      },
      {
        key: 'metrics',
        label: 'System Metrics',
        description: 'Display detailed system metrics',
        action: () => this.commands.device.showSystemMetrics()
      },
      {
        key: 'monitor',
        label: 'Real-time Monitoring',
        description: 'Start real-time system monitoring',
        action: () => this.commands.device.startMonitoring()
      },
      {
        key: 'logs',
        label: 'View Logs',
        description: 'Display system logs',
        action: () => this.commands.device.viewLogs()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('Health & Monitoring', items);
  }

  private async configMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'view',
        label: 'View Configuration',
        description: 'Display current device configuration',
        action: () => this.commands.config.viewConfiguration()
      },
      {
        key: 'edit',
        label: 'Edit Configuration',
        description: 'Modify device configuration settings',
        action: () => this.commands.config.editConfiguration()
      },
      {
        key: 'backup',
        label: 'Backup Configuration',
        description: 'Create configuration backup',
        action: () => this.commands.config.backupConfiguration()
      },
      {
        key: 'restore',
        label: 'Restore Configuration',
        description: 'Restore configuration from backup',
        action: () => this.commands.config.restoreConfiguration()
      },
      {
        key: 'reset',
        label: 'Reset to Defaults',
        description: 'Reset configuration to factory defaults',
        action: () => this.commands.config.resetConfiguration()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('Configuration Management', items);
  }

  private async wifiMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'status',
        label: 'WiFi Status',
        description: 'Show current WiFi connection status',
        action: () => this.commands.wifi.showStatus()
      },
      {
        key: 'scan',
        label: 'Scan Networks',
        description: 'Scan for available WiFi networks',
        action: () => this.commands.wifi.scanNetworks()
      },
      {
        key: 'connect',
        label: 'Connect to Network',
        description: 'Connect to a WiFi network',
        action: () => this.commands.wifi.connectToNetwork()
      },
      {
        key: 'disconnect',
        label: 'Disconnect WiFi',
        description: 'Disconnect from current network',
        action: () => this.commands.wifi.disconnect()
      },
      {
        key: 'saved',
        label: 'Saved Networks',
        description: 'Manage saved WiFi networks',
        action: () => this.commands.wifi.manageSavedNetworks()
      },
      {
        key: 'ap',
        label: 'Access Point Mode',
        description: 'Configure and manage AP mode',
        action: () => this.commands.wifi.manageAccessPoint()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('WiFi Management', items);
  }

  private async mavlinkMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'status',
        label: 'Vehicle Status',
        description: 'Show flight controller status',
        action: () => this.commands.mavlink.showVehicleStatus()
      },
      {
        key: 'control',
        label: 'Flight Control',
        description: 'Basic flight control commands',
        action: () => this.commands.mavlink.flightControlMenu()
      },
      {
        key: 'parameters',
        label: 'Parameters',
        description: 'Manage MAVLink parameters',
        action: () => this.commands.mavlink.parameterMenu()
      },
      {
        key: 'missions',
        label: 'Mission Planning',
        description: 'Create and manage missions',
        action: () => this.commands.mavlink.missionMenu()
      },
      {
        key: 'telemetry',
        label: 'Telemetry Stream',
        description: 'View real-time telemetry data',
        action: () => this.commands.mavlink.startTelemetryStream()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('MAVLink Control', items);
  }

  private async taskMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'list',
        label: 'List Tasks',
        description: 'Show all available tasks',
        action: () => this.commands.tasks.listTasks()
      },
      {
        key: 'create',
        label: 'Create Task',
        description: 'Create a new task',
        action: () => this.commands.tasks.createTask()
      },
      {
        key: 'execute',
        label: 'Execute Task',
        description: 'Execute an existing task',
        action: () => this.commands.tasks.executeTask()
      },
      {
        key: 'status',
        label: 'Task Status',
        description: 'View task execution status',
        action: () => this.commands.tasks.showTaskStatus()
      },
      {
        key: 'templates',
        label: 'Task Templates',
        description: 'Manage task templates',
        action: () => this.commands.tasks.manageTemplates()
      },
      {
        key: 'history',
        label: 'Task History',
        description: 'View task execution history',
        action: () => this.commands.tasks.viewHistory()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('Task Management', items);
  }

  private async rtcmMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'status',
        label: 'View RTCM Status',
        description: 'View current RTCM client status and statistics',
        action: () => this.commands.rtcm.viewStatus()
      },
      {
        key: 'start',
        label: 'Start RTCM Client',
        description: 'Start RTCM correction data client',
        action: () => this.commands.rtcm.startClient()
      },
      {
        key: 'stop',
        label: 'Stop RTCM Client',
        description: 'Stop RTCM correction data client',
        action: () => this.commands.rtcm.stopClient()
      },
      {
        key: 'monitor',
        label: 'Real-time Monitoring',
        description: 'Monitor RTCM data in real-time',
        action: () => this.commands.rtcm.monitorRealtime()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('RTCM Correction Data', items);
  }

  private async toolsMenu(): Promise<void> {
    const items: MenuItem[] = [
      {
        key: 'debug',
        label: 'Debug Mode',
        description: 'Toggle debug output',
        action: () => this.toggleDebugMode()
      },
      {
        key: 'export',
        label: 'Export Data',
        description: 'Export device data and logs',
        action: () => this.exportData()
      },
      {
        key: 'update',
        label: 'Update Firmware',
        description: 'Update device firmware (if supported)',
        action: () => this.updateFirmware()
      },
      {
        key: 'back',
        label: 'Back to Main Menu',
        description: 'Return to main menu',
        action: async () => {}
      }
    ];

    await this.displayMenu('Tools & Utilities', items);
  }

  private async toggleDebugMode(): Promise<void> {
    const currentDebug = process.env.DEBUG === 'true';
    const newDebug = !currentDebug;
    
    process.env.DEBUG = newDebug.toString();
    
    if (newDebug) {
      this.uiHelpers.displaySuccess('Debug mode enabled');
    } else {
      this.uiHelpers.displaySuccess('Debug mode disabled');
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  private async exportData(): Promise<void> {
    this.uiHelpers.displayInfo('Data export functionality coming soon...');
    await this.uiHelpers.pressAnyKey();
  }

  private async updateFirmware(): Promise<void> {
    this.uiHelpers.displayInfo('Firmware update functionality coming soon...');
    await this.uiHelpers.pressAnyKey();
  }

  private async exit(): Promise<void> {
    const confirmed = await this.uiHelpers.confirmAction(
      'Are you sure you want to exit?',
      false
    );
    
    if (confirmed) {
      this.context.exitRequested = true;
    }
  }
}