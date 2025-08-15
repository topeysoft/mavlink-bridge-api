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
        context.monitoring = true;
        CUIHelpers.printSuccess('Event monitoring enabled');
        console.log(chalk.gray('Real-time events will be displayed. Use "monitor off" to disable.'));
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

  // Register commands
  registry.register(helpCommand);
  registry.register(exitCommand);
  registry.register(clearCommand);
  registry.register(monitorCommand);
  registry.register(versionCommand);
  registry.register(logsCommand);
  registry.register(aboutCommand);
  registry.register(verboseCommand);
}