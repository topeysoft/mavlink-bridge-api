import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';

export function registerRTCMCommands (registry: CommandRegistry): void {
  // RTCM status command
  const rtcmStatusCommand: Command = {
    name: 'rtcm status',
    description: 'Show RTCM client status',
    category: 'RTCM',
    aliases: ['rtcm'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting RTCM status...');

      try {
        const [config, rtcmStatus] = await Promise.all([
          client.getConfiguration(),
          client.rtcm.getStatus().catch(() => null)
        ]);

        CUIHelpers.stopSpinner(true, 'RTCM status retrieved');

        console.log();
        console.log(chalk.bold.cyan('RTCM Configuration'));
        const configTable = CUIHelpers.createTable();
        configTable.push(['Enabled', CUIHelpers.formatBoolean(config.rtcm.enabled)]);

        if (config.rtcm.source) {
          configTable.push(
            ['Source Type', config.rtcm.source.type],
            ['Host', config.rtcm.source.host],
            ['Port', config.rtcm.source.port.toString()]
          );

          if (config.rtcm.source.mountpoint) {
            configTable.push(['Mountpoint', config.rtcm.source.mountpoint]);
          }

          if (config.rtcm.source.username) {
            configTable.push(['Username', config.rtcm.source.username]);
          }
        }
        console.log(configTable.toString());

        if (rtcmStatus) {
          console.log();
          console.log(chalk.bold.cyan('RTCM Runtime Status'));
          const statusTable = CUIHelpers.createTable();
          statusTable.push(
            ['State', CUIHelpers.formatStatus(rtcmStatus.state?.toString() || 'unknown')],
            ['Connected', CUIHelpers.formatBoolean(rtcmStatus.connected || false)],
            ['Messages Received', rtcmStatus.statistics?.messagesReceived?.toString() || '0'],
            ['Bytes Received', rtcmStatus.statistics?.bytesReceived ? CUIHelpers.formatBytes(rtcmStatus.statistics.bytesReceived) : '0 B'],
            ['Last Message', rtcmStatus.statistics?.lastMessageTime ? CUIHelpers.formatTimestamp(rtcmStatus.statistics.lastMessageTime) : 'Never']
          );
          console.log(statusTable.toString());
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get RTCM status');
        throw error;
      }
    }
  };

  // RTCM start command
  const rtcmStartCommand: Command = {
    name: 'rtcm start',
    description: 'Start the RTCM client',
    category: 'RTCM',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Starting RTCM client...');

      try {
        await client.startRTCM();
        CUIHelpers.stopSpinner(true, 'RTCM client started');

        // Show status after starting
        setTimeout(async () => {
          try {
            const status = await client.rtcm.getStatus();
            console.log();
            console.log(chalk.green(`RTCM client state: ${CUIHelpers.formatStatus(status.state?.toString() || 'unknown')}`));
          } catch (error) {
            // Ignore errors when checking status
          }
        }, 2000);

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to start RTCM client');
        throw error;
      }
    }
  };

  // RTCM stop command
  const rtcmStopCommand: Command = {
    name: 'rtcm stop',
    description: 'Stop the RTCM client',
    category: 'RTCM',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Stopping RTCM client...');

      try {
        await client.stopRTCM();
        CUIHelpers.stopSpinner(true, 'RTCM client stopped');
      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to stop RTCM client');
        throw error;
      }
    }
  };

  // RTCM config command
  const rtcmConfigCommand: Command = {
    name: 'rtcm config',
    description: 'Configure RTCM source',
    category: 'RTCM',
    usage: 'rtcm config <type> <host> <port> [options]',
    examples: [
      'rtcm config ntrip rtk2go.com 2101 --mountpoint=MyMount --user=myuser --pass=mypass',
      'rtcm config tcp 192.168.1.100 3000',
      'rtcm config udp 192.168.1.100 3001'
    ],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;
      const type = args._args?.[0];
      const host = args._args?.[1];
      const port = parseInt(args._args?.[2] || '0');

      if (!type || !host || !port) {
        CUIHelpers.printError('Type, host and port are required');
        console.log('Usage: rtcm config <type> <host> <port> [options]');
        console.log('Types: ntrip, tcp, udp');
        return;
      }

      if (!['ntrip', 'tcp', 'udp'].includes(type)) {
        CUIHelpers.printError('Invalid type. Must be: ntrip, tcp, or udp');
        return;
      }

      const options: any = {};
      if (args.mountpoint) options.mountpoint = args.mountpoint;
      if (args.user || args.username) options.username = args.user || args.username;
      if (args.pass || args.password) options.password = args.pass || args.password;

      const spinner = CUIHelpers.startSpinner(`Configuring RTCM source: ${type}://${host}:${port}...`);

      try {
        await client.configureRTCMSource(type as any, host, port, options);
        CUIHelpers.stopSpinner(true, `RTCM source configured: ${type}://${host}:${port}`);

        if (options.mountpoint) {
          console.log(chalk.gray(`  Mountpoint: ${options.mountpoint}`));
        }
        if (options.username) {
          console.log(chalk.gray(`  Username: ${options.username}`));
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to configure RTCM source');
        throw error;
      }
    }
  };

  // RTCM stats command
  const rtcmStatsCommand: Command = {
    name: 'rtcm stats',
    description: 'Show RTCM statistics',
    category: 'RTCM',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting RTCM statistics...');

      try {
        const status = await client.rtcm.getStatus();
        CUIHelpers.stopSpinner(true, 'RTCM statistics retrieved');

        if (!status.statistics) {
          CUIHelpers.printInfo('No RTCM statistics available');
          return;
        }

        const stats = status.statistics;

        console.log();
        console.log(chalk.bold.cyan('RTCM Statistics'));
        const table = CUIHelpers.createTable();

        table.push(
          ['Messages Received', stats.messagesReceived?.toString() || '0'],
          ['Bytes Received', stats.bytesReceived ? CUIHelpers.formatBytes(stats.bytesReceived) : '0 B'],
          ['Messages Sent', stats.messagesSent?.toString() || '0'],
          ['Bytes Sent', stats.bytesSent ? CUIHelpers.formatBytes(stats.bytesSent) : '0 B'],
          ['Errors', stats.errors?.toString() || '0'],
          ['Last Message', stats.lastMessageTime ? CUIHelpers.formatTimestamp(stats.lastMessageTime) : 'Never'],
          ['Connection Time', stats.connectionTime ? CUIHelpers.formatUptime(Math.floor((Date.now() - stats.connectionTime) / 1000)) : 'N/A']
        );

        console.log(table.toString());

        if (stats.messageTypes && Object.keys(stats.messageTypes).length > 0) {
          console.log();
          console.log(chalk.bold.cyan('Message Types'));
          const msgTable = CUIHelpers.createTable({
            head: ['Type', 'Count']
          });

          Object.entries(stats.messageTypes)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .forEach(([type, count]) => {
              msgTable.push([type, count.toString()]);
            });

          console.log(msgTable.toString());
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get RTCM statistics');
        throw error;
      }
    }
  };

  // Register commands
  registry.register(rtcmStatusCommand);
  registry.register(rtcmStartCommand);
  registry.register(rtcmStopCommand);
  registry.register(rtcmConfigCommand);
  registry.register(rtcmStatsCommand);
}