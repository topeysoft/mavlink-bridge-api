import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';

export function registerUtilityCommands(registry: CommandRegistry): void {
  // Help command
  const helpCommand: Command = {
    name: 'help',
    description: 'Show available commands and their usage',
    category: 'Utility',
    usage: 'help [command]',
    examples: ['help', 'help connect', 'help wifi'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      const commandName = args._args?.[0];
      
      if (commandName) {
        // Show help for specific command
        const command = registry.get(commandName);
        if (!command) {
          CUIHelpers.printError(`Unknown command: ${commandName}`);
          return;
        }
        
        console.log(CUIHelpers.formatCommandHelp(command));
        return;
      }
      
      // Show general help
      console.log();
      console.log(chalk.bold.cyan('MAVLinkBridge CLI Commands'));
      CUIHelpers.printDivider();
      
      const categories = registry.getCategories();
      
      categories.forEach(category => {
        console.log();
        console.log(chalk.bold.yellow(category + ':'));
        
        const commands = registry.getByCategory(category);
        const table = CUIHelpers.createTable({
          style: { head: [], border: [] }
        });
        
        commands.forEach(cmd => {
          const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
          const connection = cmd.requiresConnection ? chalk.red(' *') : '';
          table.push([
            chalk.cyan(cmd.name) + aliases + connection,
            cmd.description
          ]);
        });
        
        console.log(table.toString());
      });
      
      console.log();
      console.log(chalk.red('* ') + 'Requires device connection');
      console.log();
      console.log('Use ' + chalk.cyan('help <command>') + ' for detailed information about a specific command.');
      console.log('Use ' + chalk.cyan('connect <device-url>') + ' to connect to a device.');
    }
  };

  // Exit command
  const exitCommand: Command = {
    name: 'exit',
    description: 'Exit the CLI application',
    category: 'Utility',
    aliases: ['quit', 'q'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      console.log(chalk.cyan('Goodbye!'));
      process.exit(0);
    }
  };

  // Clear command
  const clearCommand: Command = {
    name: 'clear',
    description: 'Clear the console screen',
    category: 'Utility',
    aliases: ['cls'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      CUIHelpers.clearConsole();
    }
  };

  // Monitor command
  const monitorCommand: Command = {
    name: 'monitor',
    description: 'Toggle real-time event monitoring',
    category: 'Utility',
    usage: 'monitor [on|off]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const action = args._args?.[0];
      
      if (action === 'off' || (action === undefined && context.monitoring)) {
        context.monitoring = false;
        CUIHelpers.printSuccess('Event monitoring disabled');
      } else {
        // Enhanced WebSocket state checking with immediate return for responsiveness
        if (!context.client) {
          CUIHelpers.printError('No client connection available');
          return;
        }
        
        const wsState = context.client.getConnectionState();
        console.log(chalk.gray(`WebSocket state: ${wsState}`));
        
        if (wsState !== 'open') {
          CUIHelpers.printWarning(`WebSocket is ${wsState}. Monitoring may not work properly.`);
          
          if (wsState === 'connecting') {
            CUIHelpers.printInfo('WebSocket is still connecting. Please wait a moment and try again.');
          } else if (wsState === 'closed') {
            CUIHelpers.printInfo('WebSocket is closed. Try disconnecting and reconnecting.');
          } else if (wsState === 'closing') {
            CUIHelpers.printInfo('WebSocket is closing. Please reconnect before enabling monitoring.');
          }
          
          // Don't enable monitoring if WebSocket isn't properly connected
          CUIHelpers.printInfo('Monitoring not enabled due to WebSocket state.');
          return;
        }
        
        // Quick responsiveness test - return immediately without blocking
        context.monitoring = true;
        CUIHelpers.printSuccess('Event monitoring enabled');
        console.log(chalk.gray('Real-time events will be displayed. Use "monitor off" to disable.'));
        
        // Non-blocking status check
        const activeRequests = context.client.getActiveRequestCount();
        if (activeRequests > 0) {
          console.log(chalk.yellow(`Note: ${activeRequests} HTTP requests are still active`));
        }
        
        // Quick test to ensure events flow properly
        console.log(chalk.gray('Listening for device events...'));
      }
    }
  };

  // Version command
  const versionCommand: Command = {
    name: 'version',
    description: 'Show CLI and device version information',
    category: 'Utility',
    aliases: ['ver'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      console.log();
      console.log(chalk.bold.cyan('Version Information'));
      const table = CUIHelpers.createTable();
      table.push(['CLI Version', '1.0.0']); // TODO: Get from package.json
      
      if (context.isConnected && context.client) {
        try {
          const health = await context.client.getHealth();
          table.push(['Device API', 'v1.0.0']); // TODO: Get from device
          table.push(['Device Uptime', CUIHelpers.formatUptime(health.uptime)]);
        } catch (error) {
          table.push(['Device API', 'Unable to retrieve']);
        }
      } else {
        table.push(['Device API', 'Not connected']);
      }
      
      console.log(table.toString());
    }
  };

  // Logs command
  const logsCommand: Command = {
    name: 'logs',
    description: 'Show recent device logs (requires monitoring)',
    category: 'Utility',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.monitoring) {
        CUIHelpers.printWarning('Log monitoring is not enabled');
        console.log('Use "monitor on" to enable real-time log monitoring');
        return;
      }
      
      CUIHelpers.printInfo('Logs are displayed in real-time when monitoring is enabled');
      console.log('Recent logs will appear here as they are received from the device');
    }
  };

  // About command
  const aboutCommand: Command = {
    name: 'about',
    description: 'Show information about the CLI application',
    category: 'Utility',
    execute: async (context: CommandContext, args: CommandArgs) => {
      console.log();
      console.log(chalk.bold.cyan('MAVLinkBridge Command-Line Interface'));
      console.log();
      console.log('A comprehensive CLI tool for interacting with MAVLinkBridge ESP32 devices.');
      console.log('Provides device management, configuration, WiFi control, RTCM handling,');
      console.log('and real-time monitoring capabilities.');
      console.log();
      console.log(chalk.bold('Features:'));
      console.log('  • Device connection and status monitoring');
      console.log('  • WiFi network management');
      console.log('  • RTCM client configuration and control');
      console.log('  • System health and performance monitoring');
      console.log('  • Real-time event streaming');
      console.log('  • Configuration management');
      console.log();
      console.log(chalk.bold('Repository:'), 'https://github.com/mavlinkbridge/esp32-api');
      console.log(chalk.bold('License:'), 'MIT');
    }
  };

  // Verbose command
  const verboseCommand: Command = {
    name: 'verbose',
    description: 'Toggle verbose output mode',
    category: 'Utility',
    usage: 'verbose [on|off]',
    execute: async (context: CommandContext, args: CommandArgs) => {
      const action = args._args?.[0];
      
      if (action === 'off' || (action === undefined && context.verbose)) {
        context.verbose = false;
        CUIHelpers.printSuccess('Verbose mode disabled');
      } else {
        context.verbose = true;
        CUIHelpers.printSuccess('Verbose mode enabled');
        console.log(chalk.gray('Detailed error information and debug output will be shown.'));
      }
    }
  };

  // Abort command
  const abortCommand: Command = {
    name: 'abort',
    description: 'Abort current command execution and cancel pending requests',
    category: 'Utility',
    aliases: ['stop', 'cancel'],
    usage: 'abort',
    examples: ['abort'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (context.client) {
        const activeRequests = context.client.getActiveRequestCount();
        context.client.abortAllRequests();
        
        if (activeRequests > 0) {
          CUIHelpers.printSuccess(`Aborted ${activeRequests} active request(s)`);
        } else {
          CUIHelpers.printInfo('No active requests to abort');
        }
      } else {
        CUIHelpers.printInfo('No active connection to abort requests for');
      }
    }
  };

  // Debug command
  const debugCommand: Command = {
    name: 'debug',
    description: 'Show CLI debug information and current state',
    category: 'Utility',
    usage: 'debug',
    examples: ['debug'],
    execute: async (context: CommandContext, args: CommandArgs) => {
      console.log();
      console.log(chalk.bold.cyan('CLI Debug Information'));
      console.log(chalk.gray('='.repeat(40)));
      
      // Connection state
      console.log(`Connected: ${context.isConnected ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`Device URL: ${context.deviceUrl}`);
      console.log(`Monitoring: ${context.monitoring ? chalk.yellow('ON') : chalk.gray('OFF')}`);
      console.log(`Verbose: ${context.verbose ? chalk.yellow('ON') : chalk.gray('OFF')}`);
      
      // Client state
      if (context.client) {
        console.log(`WebSocket State: ${context.client.getConnectionState()}`);
        console.log(`Active HTTP Requests: ${context.client.getActiveRequestCount()}`);
        
        // Get quick diagnostics
        try {
          const httpClient = (context.client as any).httpClient;
          const diagnostics = await httpClient.getDiagnostics();
          console.log(`Device Reachable: ${diagnostics.reachable ? chalk.green('✓') : chalk.red('✗')}`);
          if (diagnostics.responseTime) {
            console.log(`Response Time: ${diagnostics.responseTime}ms`);
          }
        } catch (error) {
          console.log(`Device Status: ${chalk.red('Error checking')}`);
        }
      } else {
        console.log('Client: Not initialized');
      }
      
      console.log();
    }
  };

  // Test command for debugging
  const testCommand: Command = {
    name: 'test',
    description: 'Test command execution',
    category: 'Utility',
    usage: 'test',
    execute: async (context: CommandContext, args: CommandArgs) => {
      CUIHelpers.printSuccess('Test command executed successfully!');
      console.log('Command context:', {
        isConnected: context.isConnected,
        deviceUrl: context.deviceUrl,
        monitoring: context.monitoring,
        verbose: context.verbose
      });
    }
  };

  // Register commands
  registry.register(helpCommand);
  registry.register(exitCommand);
  registry.register(clearCommand);
  registry.register(monitorCommand);
  registry.register(versionCommand);
  registry.register(logsCommand);
  registry.register(abortCommand);
  registry.register(debugCommand);
  registry.register(aboutCommand);
  registry.register(verboseCommand);
  registry.register(testCommand);
}