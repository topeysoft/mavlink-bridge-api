import * as readline from 'readline';
import chalk from 'chalk';
import { MAVLinkBridgeClient } from '../MAVLinkBridgeClient';
import { CommandRegistry } from './CommandRegistry';
import { CommandParser, ParsedCommand } from './CommandParser';
import { CUIHelpers } from './CUIHelpers';
import { CommandContext, CUIConfig, EventListener } from './types';
import { registerCommands } from './commands';

export class CUIApplication {
  private rl: readline.Interface;
  private client: MAVLinkBridgeClient | null = null;
  private commandRegistry: CommandRegistry;
  private context: CommandContext;
  private config: CUIConfig;
  private eventListeners: EventListener[] = [];
  private isRunning = false;
  private commandHistory: string[] = [];

  constructor(config: Partial<CUIConfig> = {}) {
    this.config = {
      defaultDeviceUrl: 'http://192.168.4.1',
      autoConnect: false,
      verbose: false,
      colorOutput: true,
      historySize: 100,
      commandTimeout: 30000,
      ...config
    };

    this.commandRegistry = new CommandRegistry();
    this.context = {
      client: null,
      isConnected: false,
      deviceUrl: this.config.defaultDeviceUrl,
      verbose: this.config.verbose,
      monitoring: false
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history: this.commandHistory.slice(-this.config.historySize)
    });

    // Enable raw mode for better command line experience
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // Register all available commands
    registerCommands(this.commandRegistry);

    // Setup readline event handlers
    this.setupReadlineHandlers();
  }

  /**
   * Start the CUI application
   */
  async start (): Promise<void> {
    this.isRunning = true;

    // Print welcome banner
    this.printWelcomeBanner();

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      try {
        await this.connectToDevice(this.config.defaultDeviceUrl);
      } catch (error) {
        CUIHelpers.printWarning(`Failed to auto-connect to ${this.config.defaultDeviceUrl}`);
      }
    }

    // Start command loop
    this.showPrompt();
  }

  /**
   * Stop the CUI application
   */
  stop (): void {
    this.isRunning = false;

    // Cleanup event listeners
    this.eventListeners.forEach(listener => {
      if (listener.unsubscribe) {
        listener.unsubscribe();
      }
    });

    // Disconnect from device
    if (this.client) {
      this.client.disconnect();
    }

    // Close readline interface
    this.rl.close();

    CUIHelpers.printInfo('Goodbye!');
    process.exit(0);
  }

  /**
   * Connect to a device
   */
  async connectToDevice (deviceUrl: string): Promise<void> {
    const spinner = CUIHelpers.startSpinner(`Connecting to ${deviceUrl}...`);

    try {
      this.client = new MAVLinkBridgeClient(deviceUrl);
      await this.client.connect();

      // Update context
      this.context.client = this.client;
      this.context.isConnected = true;
      this.context.deviceUrl = deviceUrl;

      // Setup event listeners
      this.setupEventListeners();

      CUIHelpers.stopSpinner(true, `Connected to ${deviceUrl}`);
    } catch (error) {
      CUIHelpers.stopSpinner(false, `Failed to connect to ${deviceUrl}`);
      throw error;
    }
  }

  /**
   * Disconnect from the current device
   */
  disconnectFromDevice (): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    // Clear event listeners
    this.eventListeners.forEach(listener => {
      if (listener.unsubscribe) {
        listener.unsubscribe();
      }
    });
    this.eventListeners = [];

    // Update context
    this.context.client = null;
    this.context.isConnected = false;
    this.context.monitoring = false;

    CUIHelpers.printSuccess('Disconnected from device');
  }

  /**
   * Execute a command
   */
  async executeCommand (input: string): Promise<void> {
    const parsed = CommandParser.parse(input);
    if (!parsed) {
      return;
    }

    // Add to history
    this.addToHistory(input);

    const commandName = parsed.subcommand ? `${parsed.command} ${parsed.subcommand}` : parsed.command;
    const command = this.commandRegistry.get(commandName) || this.commandRegistry.get(parsed.command);

    if (!command) {
      CUIHelpers.printError(`Unknown command: ${commandName}`);
      CUIHelpers.printInfo('Type "help" for available commands');
      return;
    }

    // Check connection requirement
    if (command.requiresConnection && !this.context.isConnected) {
      CUIHelpers.printError('This command requires an active device connection');
      CUIHelpers.printInfo('Use "connect <device-url>" to connect to a device first');
      return;
    }

    try {
      // Create command arguments
      const args = {
        ...parsed.options,
        _args: parsed.args,
        _subcommand: parsed.subcommand
      };

      // Execute command with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), this.config.commandTimeout);
      });

      await Promise.race([
        command.execute(this.context, args),
        timeoutPromise
      ]);

    } catch (error: any) {
      CUIHelpers.printError(`Command failed: ${error?.message || 'Unknown error'}`, error);
      if (this.config.verbose && error?.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  /**
   * Get command registry for external access
   */
  getCommandRegistry (): CommandRegistry {
    return this.commandRegistry;
  }

  /**
   * Get current context
   */
  getContext (): CommandContext {
    return { ...this.context };
  }

  /**
   * Update application config
   */
  updateConfig (updates: Partial<CUIConfig>): void {
    this.config = { ...this.config, ...updates };
    this.context.verbose = this.config.verbose;
  }

  /**
   * Setup readline event handlers
   */
  private setupReadlineHandlers (): void {
    this.rl.on('line', async (input) => {
      const trimmed = input.trim();
      if (trimmed) {
        await this.executeCommand(trimmed);
      }
      this.showPrompt();
    });

    this.rl.on('SIGINT', () => {
      console.log(); // New line
      CUIHelpers.printInfo('Use "exit" or "quit" to leave the application');
      this.showPrompt();
    });

    this.rl.on('close', () => {
      this.stop();
    });

    // Setup tab completion
    this.rl.on('line', (input) => {
      // This is handled by the 'line' event above
    });
  }

  /**
   * Setup device event listeners
   */
  private setupEventListeners (): void {
    if (!this.client) return;

    // Status updates
    this.client.onStatus((status) => {
      if (this.context.monitoring) {
        console.log(chalk.blue(`[STATUS] Uptime: ${CUIHelpers.formatUptime(status.uptime)}, Free Heap: ${CUIHelpers.formatBytes(status.freeHeap)}`));
      }
    });

    // Error events
    this.client.onError((error) => {
      if (this.context.monitoring) {
        console.log(chalk.red(`[ERROR] ${error.message}`));
      }
    });

    // Log events
    this.client.onLog((log) => {
      if (this.context.monitoring) {
        const timestamp = CUIHelpers.formatTimestamp(log.timestamp);
        console.log(chalk.gray(`[${timestamp}] ${log.level.toUpperCase()}: ${log.message}`));
      }
    });

    // WiFi events
    this.client.onWiFiConnected((wifi) => {
      if (this.context.monitoring) {
        console.log(chalk.green(`[WIFI] Connected to ${wifi.ssid}`));
      }
    });

    this.client.onWiFiDisconnected((wifi) => {
      if (this.context.monitoring) {
        console.log(chalk.yellow(`[WIFI] Disconnected from ${wifi.ssid || 'network'}`));
      }
    });

    // RTCM events
    this.client.onRTCMData((data) => {
      if (this.context.monitoring) {
        console.log(chalk.cyan(`[RTCM] Message type ${data.messageType}, ${data.length} bytes`));
      }
    });
  }

  /**
   * Show command prompt
   */
  private showPrompt (): void {
    if (!this.isRunning) return;

    const deviceIndicator = this.context.isConnected
      ? chalk.green('●')
      : chalk.red('○');

    const monitorIndicator = this.context.monitoring
      ? chalk.yellow(' [MON]')
      : '';

    const prompt = `${deviceIndicator} mavlink-bridge${monitorIndicator}> `;
    this.rl.setPrompt(prompt);
    this.rl.prompt();
  }

  /**
   * Add command to history
   */
  private addToHistory (command: string): void {
    // Remove duplicate if it exists
    const index = this.commandHistory.indexOf(command);
    if (index !== -1) {
      this.commandHistory.splice(index, 1);
    }

    // Add to end
    this.commandHistory.push(command);

    // Trim to max size
    if (this.commandHistory.length > this.config.historySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * Print welcome banner
   */
  private printWelcomeBanner (): void {
    console.log(chalk.cyan.bold('MAVLinkBridge Command-Line Interface'));
    console.log(chalk.gray('Type "help" for available commands'));
    console.log(chalk.gray(`Default device URL: ${this.config.defaultDeviceUrl}`));
    if (!this.config.autoConnect) {
      console.log(chalk.gray('Use "connect <device-url>" to connect to a device'));
    }
    CUIHelpers.printDivider();
  }
}