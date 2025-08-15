import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';

export function registerWiFiCommands (registry: CommandRegistry): void {
  // WiFi status command
  const wifiStatusCommand: Command = {
    name: 'wifi status',
    description: 'Show WiFi connection status',
    category: 'WiFi',
    aliases: ['wifi'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting WiFi status...');

      try {
        const status = await client.getWiFiStatus();
        CUIHelpers.stopSpinner(true, 'WiFi status retrieved');

        console.log();
        console.log(chalk.bold.cyan('WiFi Status'));
        const table = CUIHelpers.createTable();

        table.push(
          ['State', CUIHelpers.formatStatus(status.state)],
          ['Connected', CUIHelpers.formatBoolean(status.connected)]
        );

        if (status.connected && status.ssid) {
          table.push(
            ['SSID', status.ssid],
            ['IP Address', status.ip || 'N/A'],
            ['Gateway', status.gateway || 'N/A'],
            ['Subnet', status.subnet || 'N/A']
          );

          if (status.rssi) {
            table.push(['Signal Strength', CUIHelpers.formatSignalStrength(status.rssi)]);
          }

          if (status.bssid) {
            table.push(['BSSID', status.bssid]);
          }
        }

        if (status.apMode) {
          table.push(
            ['AP Mode', CUIHelpers.formatBoolean(true)],
            ['AP SSID', status.apSSID || 'N/A'],
            ['AP IP', status.apIP || 'N/A'],
            ['Connected Clients', String(status.connectedClients || 0)]
          );
        }

        console.log(table.toString());

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get WiFi status');
        throw error;
      }
    }
  };

  // WiFi scan command
  const wifiScanCommand: Command = {
    name: 'wifi scan',
    description: 'Scan for available WiFi networks',
    category: 'WiFi',
    usage: 'wifi scan [--force]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const force = args.force || false;

      const spinner = CUIHelpers.startSpinner('Scanning for WiFi networks...');

      try {
        const networks = await client.scanWiFiNetworks(force);
        CUIHelpers.stopSpinner(true, `Found ${networks.length} networks`);

        if (networks.length === 0) {
          CUIHelpers.printInfo('No WiFi networks found');
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('Available WiFi Networks'));

        const table = CUIHelpers.createTable({
          head: ['SSID', 'Signal', 'Security', 'Channel']
        });

        networks
          .sort((a, b) => b.rssi - a.rssi) // Sort by signal strength
          .forEach(network => {
            table.push([
              network.ssid || '<Hidden>',
              CUIHelpers.formatSignalStrength(network.rssi),
              network.secure ? chalk.red('Secured') : chalk.green('Open'),
              network.channel.toString()
            ]);
          });

        console.log(table.toString());

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to scan WiFi networks');
        throw error;
      }
    }
  };

  // WiFi connect command
  const wifiConnectCommand: Command = {
    name: 'wifi connect',
    description: 'Connect to a WiFi network',
    category: 'WiFi',
    usage: 'wifi connect <ssid> [password] [--save] [--priority=0]',
    examples: [
      'wifi connect "MyNetwork" "password123" --save',
      'wifi connect "OpenNetwork"',
      'wifi connect "MyNetwork" "password" --priority=5'
    ],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const ssid = args._args?.[0];
      const password = args._args?.[1];
      const save = args.save || false;
      const priority = args.priority || 0;

      if (!ssid) {
        CUIHelpers.printError('SSID is required');
        console.log('Usage: wifi connect <ssid> [password] [--save] [--priority=0]');
        return;
      }

      const spinner = CUIHelpers.startSpinner(`Connecting to ${ssid}...`);

      try {
        await client.connectToWiFi({
          ssid,
          password: password || ''
        });

        CUIHelpers.stopSpinner(true, `Connected to ${ssid}`);

        // Show connection status
        const status = await client.getWiFiStatus();
        if (status.connected) {
          console.log();
          console.log(chalk.green('Connection Details:'));
          console.log(`  IP Address: ${status.ip}`);
          console.log(`  Gateway: ${status.gateway}`);
          if (status.rssi) {
            console.log(`  Signal: ${CUIHelpers.formatSignalStrength(status.rssi)}`);
          }
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to connect to ${ssid}`);
        throw error;
      }
    }
  };

  // WiFi disconnect command
  const wifiDisconnectCommand: Command = {
    name: 'wifi disconnect',
    description: 'Disconnect from current WiFi network',
    category: 'WiFi',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Disconnecting from WiFi...');

      try {
        await client.disconnectFromWiFi();
        CUIHelpers.stopSpinner(true, 'Disconnected from WiFi');
      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to disconnect from WiFi');
        throw error;
      }
    }
  };

  // WiFi saved command
  const wifiSavedCommand: Command = {
    name: 'wifi saved',
    description: 'Show saved WiFi networks',
    category: 'WiFi',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting saved networks...');

      try {
        const networks = await client.getSavedWiFiNetworks();
        CUIHelpers.stopSpinner(true, `Found ${networks.length} saved networks`);

        if (networks.length === 0) {
          CUIHelpers.printInfo('No saved WiFi networks');
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('Saved WiFi Networks'));

        const table = CUIHelpers.createTable({
          head: ['SSID', 'Priority']
        });

        networks
          .sort((a, b) => b.priority - a.priority)
          .forEach(network => {
            table.push([
              network.ssid,
              network.priority.toString()
            ]);
          });

        console.log(table.toString());

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get saved networks');
        throw error;
      }
    }
  };

  // WiFi add command
  const wifiAddCommand: Command = {
    name: 'wifi add',
    description: 'Add a WiFi network to saved networks',
    category: 'WiFi',
    usage: 'wifi add <ssid> <password> [--priority=0]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const ssid = args._args?.[0];
      const password = args._args?.[1];
      const priority = args.priority || 0;

      if (!ssid || !password) {
        CUIHelpers.printError('Both SSID and password are required');
        console.log('Usage: wifi add <ssid> <password> [--priority=0]');
        return;
      }

      const spinner = CUIHelpers.startSpinner(`Adding ${ssid} to saved networks...`);

      try {
        await client.addSavedWiFiNetwork(ssid, password, priority);
        CUIHelpers.stopSpinner(true, `Added ${ssid} to saved networks`);
      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to add ${ssid}`);
        throw error;
      }
    }
  };

  // WiFi remove command
  const wifiRemoveCommand: Command = {
    name: 'wifi remove',
    description: 'Remove a WiFi network from saved networks',
    category: 'WiFi',
    usage: 'wifi remove <ssid>',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const ssid = args._args?.[0];

      if (!ssid) {
        CUIHelpers.printError('SSID is required');
        console.log('Usage: wifi remove <ssid>');
        return;
      }

      const spinner = CUIHelpers.startSpinner(`Removing ${ssid} from saved networks...`);

      try {
        await client.removeSavedWiFiNetwork(ssid);
        CUIHelpers.stopSpinner(true, `Removed ${ssid} from saved networks`);
      } catch (error) {
        CUIHelpers.stopSpinner(false, `Failed to remove ${ssid}`);
        throw error;
      }
    }
  };

  // Register commands
  registry.register(wifiStatusCommand);
  registry.register(wifiScanCommand);
  registry.register(wifiConnectCommand);
  registry.register(wifiDisconnectCommand);
  registry.register(wifiSavedCommand);
  registry.register(wifiAddCommand);
  registry.register(wifiRemoveCommand);
}