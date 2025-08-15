import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';

export function registerConfigCommands(registry: CommandRegistry): void {
  // Config show command
  const configShowCommand: Command = {
    name: 'config show',
    description: 'Show current device configuration',
    category: 'Configuration',
    usage: 'config show [--json]',
    aliases: ['config', 'cfg'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      
      const spinner = CUIHelpers.startSpinner('Getting configuration...');
      
      try {
        const config = await client.getConfiguration();
        CUIHelpers.stopSpinner(true, 'Configuration retrieved');
        
        if (args.json) {
          console.log(CUIHelpers.formatJSON(config));
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('Device Configuration'));
        CUIHelpers.printDivider();
        
        // Device section
        console.log(chalk.bold('Device:'));
        const deviceTable = CUIHelpers.createTable();
        deviceTable.push(
          ['Name', config.device.name],
          ['Mode', config.device.mode]
        );
        console.log(deviceTable.toString());
        
        // Connection section
        console.log();
        console.log(chalk.bold('Connection:'));
        const connTable = CUIHelpers.createTable();
        connTable.push(['Type', config.connection.type]);
        
        if (config.connection.wifi) {
          connTable.push(
            ['WiFi SSID', config.connection.wifi.ssid || 'Not set'],
            ['WiFi Auto-Connect', CUIHelpers.formatBoolean(config.connection.wifi.autoConnect)]
          );
        }
        console.log(connTable.toString());
        
        // RTCM section
        console.log();
        console.log(chalk.bold('RTCM:'));
        const rtcmTable = CUIHelpers.createTable();
        rtcmTable.push(['Enabled', CUIHelpers.formatBoolean(config.rtcm.enabled)]);
        
        if (config.rtcm.source) {
          rtcmTable.push(
            ['Source Type', config.rtcm.source.type],
            ['Host', config.rtcm.source.host],
            ['Port', config.rtcm.source.port.toString()]
          );
          
          if (config.rtcm.source.mountpoint) {
            rtcmTable.push(['Mountpoint', config.rtcm.source.mountpoint]);
          }
        }
        console.log(rtcmTable.toString());
        
      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get configuration');
        throw error;
      }
    }
  };

  // Config set command
  const configSetCommand: Command = {
    name: 'config set',
    description: 'Set a configuration value',
    category: 'Configuration',
    usage: 'config set <path> <value>',
    examples: [
      'config set device.name "My Device"',
      'config set device.mode uart',
      'config set connection.wifi.ssid "MyNetwork"',
      'config set rtcm.enabled true'
    ],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const path = args._args?.[0];
      const value = args._args?.[1];

      if (!path || value === undefined) {
        CUIHelpers.printError('Both path and value are required');
        console.log('Usage: config set <path> <value>');
        return;
      }

      // Parse value to appropriate type
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      const spinner = CUIHelpers.startSpinner(`Setting ${path} to ${parsedValue}...`);
      
      try {
        await client.updateConfigValue(path, parsedValue);
        CUIHelpers.stopSpinner(true, `Configuration updated: ${path} = ${parsedValue}`);
      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to set ${path}`);
        throw error;
      }
    }
  };

  // Config reset command
  const configResetCommand: Command = {
    name: 'config reset',
    description: 'Reset configuration to defaults',
    category: 'Configuration',
    usage: 'config reset [--confirm]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      if (!args.confirm) {
        CUIHelpers.printWarning('This will reset all configuration to defaults!');
        console.log('Use --confirm to proceed: config reset --confirm');
        return;
      }

      const spinner = CUIHelpers.startSpinner('Resetting configuration...');
      
      try {
        await client.resetConfiguration();
        CUIHelpers.stopSpinner(true, 'Configuration reset to defaults');
        CUIHelpers.printWarning('Device may restart automatically');
      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to reset configuration');
        throw error;
      }
    }
  };

  // Register commands
  registry.register(configShowCommand);
  registry.register(configSetCommand);
  registry.register(configResetCommand);
}