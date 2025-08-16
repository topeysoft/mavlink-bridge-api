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
  private commandExecuting = false;
  private eventListenersSetup = false;

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
      history: this.commandHistory.slice(-this.config.historySize),
      prompt: '> '
    });

    // Note: Not using raw mode as it conflicts with readline interface

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

    // Auto-connect if enabled (non-blocking)
    if (this.config.autoConnect) {
      CUIHelpers.printInfo(`Auto-connecting to ${this.config.defaultDeviceUrl}...`);
      this.connectToDevice(this.config.defaultDeviceUrl)
        .then(() => {
          CUIHelpers.printSuccess('Auto-connect successful');
          // Re-show prompt after connection message
          this.showPrompt();
        })
        .catch((error) => {
          CUIHelpers.printWarning(`Failed to auto-connect to ${this.config.defaultDeviceUrl}`);
          if (this.config.verbose && error instanceof Error) {
            console.error(chalk.gray(`  ${error.message}`));
          }
          CUIHelpers.printInfo('Use "connect --discover" to automatically find devices');
          // Re-show prompt after error message
          this.showPrompt();
        });
    }

    // Start command loop immediately
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
      
      // Add timeout wrapper for WebSocket connection to prevent hanging
      const connectionTimeout = 15000; // 15 seconds timeout
      const connectionPromise = this.client.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`WebSocket connection timeout after ${connectionTimeout}ms`));
        }, connectionTimeout);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);

      // Update context
      this.context.client = this.client;
      this.context.isConnected = true;
      this.context.deviceUrl = deviceUrl;

      // Setup event listeners in the background (non-blocking)
      setImmediate(() => {
        try {
          this.setupEventListeners();
          if (this.config.verbose) {
            console.log(chalk.gray('[DEBUG] Event listeners setup completed'));
          }
        } catch (error) {
          console.warn('Warning: Event listener setup failed:', error);
        }
      });

      CUIHelpers.stopSpinner(true, `Connected to ${deviceUrl}`);
    } catch (error) {
      CUIHelpers.stopSpinner(false, `Failed to connect to ${deviceUrl}`);
      
      // Clean up client if connection failed
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
      
      // Update context to reflect failed connection
      this.context.client = null;
      this.context.isConnected = false;
      
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
    this.eventListenersSetup = false;

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
      CUIHelpers.printError('Failed to parse command');
      return;
    }

    // Debug output
    if (this.config.verbose) {
      console.log(chalk.gray(`[DEBUG] Parsed command: ${JSON.stringify(parsed)}`))
    }

    // Add to history
    this.addToHistory(input);

    const commandName = parsed.subcommand ? `${parsed.command} ${parsed.subcommand}` : parsed.command;
    const command = this.commandRegistry.get(commandName) || this.commandRegistry.get(parsed.command);

    if (!command) {
      CUIHelpers.printError(`Unknown command: ${commandName}`);
      CUIHelpers.printInfo('Type "help" for available commands');
      if (this.config.verbose) {
        console.log(chalk.gray(`[DEBUG] Available commands: ${Array.from(this.commandRegistry.getAll().map(c => c.name)).join(', ')}`))
      }
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

      // Execute command with timeout and abort capability
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          // Abort any active HTTP requests when command times out
          if (this.context.client) {
            this.context.client.abortAllRequests();
          }
          reject(new Error('Command timeout'));
        }, this.config.commandTimeout);
      });

      await Promise.race([
        command.execute(this.context, args),
        timeoutPromise
      ]);

    } catch (error: any) {
      // Handle different types of errors
      if (error?.message === 'Command timeout') {
        CUIHelpers.printError('Command timed out after 30 seconds');
        CUIHelpers.printInfo('The device may be unresponsive. Try "disconnect" and "connect" again.');
      } else {
        CUIHelpers.printError(`Command failed: ${error?.message || 'Unknown error'}`, error);
      }
      
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
   * Get current execution state
   */
  isCommandExecuting(): boolean {
    return this.commandExecuting;
  }
  
  /**
   * Force abort current command execution
   */
  abortCurrentCommand(): void {
    if (this.commandExecuting && this.context.client) {
      this.context.client.abortAllRequests();
      CUIHelpers.printWarning('Aborted current command execution');
    }
    this.commandExecuting = false;
  }

  /**
   * Setup readline event handlers
   */
  private setupReadlineHandlers (): void {
    this.rl.on('line', async (input) => {
      const trimmed = input.trim();
      
      // Debug output
      if (this.config.verbose) {
        console.log(chalk.gray(`[DEBUG] Received input: "${trimmed}"`))
      }
      
      // Prevent concurrent command execution
      if (this.commandExecuting) {
        CUIHelpers.printWarning('Another command is still executing. Please wait...');
        this.showPrompt();
        return;
      }
      
      if (trimmed) {
        this.commandExecuting = true;
        try {
          await this.executeCommand(trimmed);
        } catch (error) {
          // Command execution should handle its own errors, but ensure we recover
          console.error('Unexpected error in command execution:', error);
        } finally {
          this.commandExecuting = false;
        }
      }
      
      // Always show prompt regardless of command outcome
      setImmediate(() => this.showPrompt());
    });

    this.rl.on('SIGINT', () => {
      console.log(); // New line
      
      // If a command is executing, abort it
      if (this.commandExecuting) {
        this.abortCurrentCommand();
        this.commandExecuting = false;
      } else {
        CUIHelpers.printInfo('Use "exit" or "quit" to leave the application');
      }
      
      this.showPrompt();
    });

    this.rl.on('close', () => {
      this.stop();
    });

    this.rl.on('error', (err) => {
      console.error(chalk.red('Readline error:'), err.message);
      // Ensure prompt is shown even after errors
      this.showPrompt();
    });
  }

  /**
   * Setup device event listeners
   */
  private setupEventListeners (): void {
    if (!this.client) return;
    
    // Prevent duplicate setup
    if (this.eventListenersSetup) {
      return;
    }
    
    // Clear any existing listeners first
    this.eventListeners.forEach(listener => {
      if (listener.unsubscribe) {
        listener.unsubscribe();
      }
    });
    this.eventListeners = [];

    // Status updates
    const statusHandler = (status: any) => {
      if (this.context.monitoring) {
        console.log(chalk.blue(`[STATUS] Uptime: ${CUIHelpers.formatUptime(status.uptime)}, Free Heap: ${CUIHelpers.formatBytes(status.freeHeap)}`));
      }
    };
    this.client.onStatus(statusHandler);
    this.eventListeners.push({ type: 'status', handler: statusHandler });

    // Error events
    const errorHandler = (error: any) => {
      if (this.context.monitoring) {
        console.log(chalk.red(`[ERROR] ${error.message}`));
      }
    };
    this.client.onError(errorHandler);
    this.eventListeners.push({ type: 'error', handler: errorHandler });

    // Log events  
    const logHandler = (log: any) => {
      if (this.context.monitoring) {
        const timestamp = CUIHelpers.formatTimestamp(log.timestamp);
        console.log(chalk.gray(`[${timestamp}] ${log.level.toUpperCase()}: ${log.message}`));
      }
    };
    this.client.onLog(logHandler);
    this.eventListeners.push({ type: 'log', handler: logHandler });

    // WiFi events
    const wifiConnectedHandler = (wifi: any) => {
      if (this.context.monitoring) {
        console.log(chalk.green(`[WIFI] Connected to ${wifi.ssid}`));
      }
    };
    this.client.onWiFiConnected(wifiConnectedHandler);
    this.eventListeners.push({ type: 'wifi_connected', handler: wifiConnectedHandler });

    const wifiDisconnectedHandler = (wifi: any) => {
      if (this.context.monitoring) {
        console.log(chalk.yellow(`[WIFI] Disconnected from ${wifi.ssid || 'network'}`));
      }
    };
    this.client.onWiFiDisconnected(wifiDisconnectedHandler);
    this.eventListeners.push({ type: 'wifi_disconnected', handler: wifiDisconnectedHandler });

    // RTCM events
    const rtcmHandler = (data: any) => {
      if (this.context.monitoring) {
        console.log(chalk.cyan(`[RTCM] Message type ${data.messageType}, ${data.length} bytes`));
      }
    };
    this.client.onRTCMData(rtcmHandler);
    this.eventListeners.push({ type: 'rtcm', handler: rtcmHandler });
    
    // Mark event listeners as setup
    this.eventListenersSetup = true;
  }

  /**
   * Show command prompt
   */
  private showPrompt (): void {
    if (!this.isRunning) return;
    
    // Ensure we're not in the middle of output
    if (this.rl.line && this.rl.line.length > 0) {
      // Clear current line before showing prompt
      this.rl.write(null, { ctrl: true, name: 'u' });
    }

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
      console.log(chalk.gray('Use "connect --discover" to automatically find devices'));
      console.log(chalk.gray('Or "connect <device-url>" to connect to a specific device'));
    }
    CUIHelpers.printDivider();
  }
}