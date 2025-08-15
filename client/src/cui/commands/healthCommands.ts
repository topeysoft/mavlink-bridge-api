import chalk from 'chalk';
import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { CUIHelpers } from '../CUIHelpers';

export function registerHealthCommands (registry: CommandRegistry): void {
  // Health status command
  const healthCommand: Command = {
    name: 'health',
    description: 'Show comprehensive system health information',
    category: 'Health',
    usage: 'health [--detailed] [--json]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting system health...');

      try {
        const [basicHealth, systemHealth, metrics] = await Promise.all([
          client.getHealth(),
          client.getSystemHealth().catch(() => null),
          client.getSystemMetrics().catch(() => null)
        ]);

        CUIHelpers.stopSpinner(true, 'System health retrieved');

        if (args.json) {
          console.log(CUIHelpers.formatJSON({
            basic: basicHealth,
            system: systemHealth,
            metrics: metrics
          }));
          return;
        }

        // Overall Health Status
        console.log();
        console.log(chalk.bold.cyan('System Health Overview'));
        const overviewTable = CUIHelpers.createTable();

        if (systemHealth) {
          overviewTable.push(
            ['Overall Status', CUIHelpers.formatStatus(systemHealth.overall?.status || 'unknown')],
            ['Memory Health', CUIHelpers.formatStatus(systemHealth.memory?.status || 'unknown')],
            ['Task Health', CUIHelpers.formatStatus(systemHealth.tasks.length > 0 ? 'OK' : 'No tasks')],
            ['Component Health', CUIHelpers.formatStatus(systemHealth.components.length > 0 ? 'OK' : 'No components')]
          );
        } else {
          overviewTable.push(['Status', CUIHelpers.formatStatus(basicHealth.status)]);
        }

        overviewTable.push(
          ['Uptime', CUIHelpers.formatUptime(basicHealth.uptime)],
          ['Free Heap', CUIHelpers.formatBytes(basicHealth.freeHeap)]
        );

        console.log(overviewTable.toString());

        // Memory Details
        if (metrics && metrics.memory) {
          console.log();
          console.log(chalk.bold.cyan('Memory Information'));
          const memoryTable = CUIHelpers.createTable();

          const mem = metrics.memory;
          const usagePercent = mem.totalHeap ? ((mem.totalHeap - mem.freeHeap) / mem.totalHeap) * 100 : 0;

          memoryTable.push(
            ['Total Heap', CUIHelpers.formatBytes(mem.totalHeap || 0)],
            ['Free Heap', CUIHelpers.formatBytes(mem.freeHeap)],
            ['Used Heap', CUIHelpers.formatBytes((mem.totalHeap || 0) - mem.freeHeap)],
            ['Usage', CUIHelpers.formatPercentage(usagePercent, { warning: 70, critical: 85 })],
            ['Min Free Heap', CUIHelpers.formatBytes(mem.minFreeHeap || 0)],
            ['Max Allocated', CUIHelpers.formatBytes(mem.maxAllocHeap || 0)]
          );

          if (mem.psramSize) {
            memoryTable.push(
              ['PSRAM Total', CUIHelpers.formatBytes(mem.psramSize)],
              ['PSRAM Free', CUIHelpers.formatBytes(mem.freePsram || 0)]
            );
          }

          console.log(memoryTable.toString());
        }

        // Task Information (if detailed)
        if (args.detailed && metrics && metrics.tasks) {
          console.log();
          console.log(chalk.bold.cyan('Task Information'));
          const taskTable = CUIHelpers.createTable({
            head: ['Task Name', 'State', 'Priority', 'Stack Free', 'CPU %']
          });

          metrics.tasks.forEach(task => {
            taskTable.push([
              task.name,
              task.state || 'Unknown',
              task.priority?.toString() || 'N/A',
              task.stackHighWaterMark ? CUIHelpers.formatBytes(task.stackHighWaterMark) : 'N/A',
              task.cpuUsage ? CUIHelpers.formatPercentage(task.cpuUsage) : 'N/A'
            ]);
          });

          console.log(taskTable.toString());
        }

        // Component Status (if available)
        if (systemHealth && systemHealth.components && Object.keys(systemHealth.components).length > 0) {
          console.log();
          console.log(chalk.bold.cyan('Component Status'));
          const componentTable = CUIHelpers.createTable({
            head: ['Component', 'Status', 'Details']
          });

          Object.entries(systemHealth.components).forEach(([name, component]) => {
            componentTable.push([
              name,
              CUIHelpers.formatStatus(component.status),
              component.message || 'OK'
            ]);
          });

          console.log(componentTable.toString());
        }

        // Errors (if any)
        if (systemHealth && systemHealth.errors && systemHealth.errors.length > 0) {
          console.log();
          console.log(chalk.bold.red('System Errors'));
          systemHealth.errors.forEach(error => {
            console.log(chalk.red(`  ● ${error.message} (${error.component || 'System'})`));
            if (error.timestamp) {
              console.log(chalk.gray(`    ${CUIHelpers.formatTimestamp(error.timestamp)}`));
            }
          });
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get system health');
        throw error;
      }
    }
  };

  // Memory command
  const memoryCommand: Command = {
    name: 'memory',
    description: 'Show detailed memory information',
    category: 'Health',
    aliases: ['mem'],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting memory information...');

      try {
        const [basicHealth, metrics] = await Promise.all([
          client.getHealth(),
          client.getSystemMetrics().catch(() => null)
        ]);

        CUIHelpers.stopSpinner(true, 'Memory information retrieved');

        console.log();
        console.log(chalk.bold.cyan('Memory Information'));

        const memoryTable = CUIHelpers.createTable();

        if (metrics && metrics.memory) {
          const mem = metrics.memory;
          const usagePercent = mem.totalHeap ? ((mem.totalHeap - mem.freeHeap) / mem.totalHeap) * 100 : 0;

          memoryTable.push(
            ['Total Heap', CUIHelpers.formatBytes(mem.totalHeap || 0)],
            ['Free Heap', CUIHelpers.formatBytes(mem.freeHeap)],
            ['Used Heap', CUIHelpers.formatBytes((mem.totalHeap || 0) - mem.freeHeap)],
            ['Usage Percentage', CUIHelpers.formatPercentage(usagePercent, { warning: 70, critical: 85 })],
            ['Minimum Free Heap', CUIHelpers.formatBytes(mem.minFreeHeap || 0)],
            ['Maximum Allocated', CUIHelpers.formatBytes(mem.maxAllocHeap || 0)]
          );

          if (mem.psramSize) {
            memoryTable.push(
              ['PSRAM Total', CUIHelpers.formatBytes(mem.psramSize)],
              ['PSRAM Free', CUIHelpers.formatBytes(mem.freePsram || 0)],
              ['PSRAM Used', CUIHelpers.formatBytes(mem.psramSize - (mem.freePsram || 0))]
            );
          }

          if (mem.flashSize) {
            memoryTable.push(
              ['Flash Size', CUIHelpers.formatBytes(mem.flashSize)],
              ['Flash Used', CUIHelpers.formatBytes(mem.usedFlash || 0)],
              ['Flash Free', CUIHelpers.formatBytes(mem.flashSize - (mem.usedFlash || 0))]
            );
          }
        } else {
          memoryTable.push(['Free Heap', CUIHelpers.formatBytes(basicHealth.freeHeap)]);
        }

        console.log(memoryTable.toString());

        // Memory usage warning
        if (metrics && metrics.memory) {
          const usagePercent = metrics.memory.totalHeap ?
            ((metrics.memory.totalHeap - metrics.memory.freeHeap) / metrics.memory.totalHeap) * 100 : 0;

          if (usagePercent > 85) {
            CUIHelpers.printWarning('Memory usage is critically high!');
          } else if (usagePercent > 70) {
            CUIHelpers.printWarning('Memory usage is high');
          }
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get memory information');
        throw error;
      }
    }
  };

  // Tasks command
  const tasksCommand: Command = {
    name: 'tasks',
    description: 'Show running tasks information',
    category: 'Health',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting task information...');

      try {
        const metrics = await client.getSystemMetrics();
        CUIHelpers.stopSpinner(true, 'Task information retrieved');

        if (!metrics.tasks || metrics.tasks.length === 0) {
          CUIHelpers.printInfo('No task information available');
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('Running Tasks'));

        const taskTable = CUIHelpers.createTable({
          head: ['Task Name', 'State', 'Priority', 'Stack Free', 'CPU %']
        });

        metrics.tasks
          .sort((a, b) => (b.priority || 0) - (a.priority || 0))
          .forEach(task => {
            taskTable.push([
              task.name,
              task.state || 'Unknown',
              task.priority?.toString() || 'N/A',
              task.stackHighWaterMark ? CUIHelpers.formatBytes(task.stackHighWaterMark) : 'N/A',
              task.cpuUsage ? CUIHelpers.formatPercentage(task.cpuUsage) : 'N/A'
            ]);
          });

        console.log(taskTable.toString());

        // Summary
        console.log();
        console.log(chalk.bold('Task Summary:'));
        console.log(`  Total tasks: ${metrics.tasks.length}`);

        const runningTasks = metrics.tasks.filter(t => t.state === 'Running').length;
        const blockedTasks = metrics.tasks.filter(t => t.state === 'Blocked').length;

        console.log(`  Running: ${runningTasks}`);
        console.log(`  Blocked: ${blockedTasks}`);

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get task information');
        throw error;
      }
    }
  };

  // CPU command
  const cpuCommand: Command = {
    name: 'cpu',
    description: 'Show CPU usage information',
    category: 'Health',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      const client = context.client!;

      const spinner = CUIHelpers.startSpinner('Getting CPU information...');

      try {
        const cpuUsage = await client.getCPUUsage();
        CUIHelpers.stopSpinner(true, 'CPU information retrieved');

        console.log();
        console.log(chalk.bold.cyan('CPU Information'));
        const table = CUIHelpers.createTable();
        table.push(['CPU Usage', CUIHelpers.formatPercentage(cpuUsage, { warning: 70, critical: 85 })]);
        console.log(table.toString());

        if (cpuUsage > 85) {
          CUIHelpers.printWarning('CPU usage is critically high!');
        } else if (cpuUsage > 70) {
          CUIHelpers.printWarning('CPU usage is high');
        }

      } catch (error) {
        CUIHelpers.stopSpinner(false, 'Failed to get CPU information');
        throw error;
      }
    }
  };

  // Register commands
  registry.register(healthCommand);
  registry.register(memoryCommand);
  registry.register(tasksCommand);
  registry.register(cpuCommand);
}