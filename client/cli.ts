#!/usr/bin/env node

import { Command } from 'commander';
import { CUIApplication } from './src/cui/CUIApplication';
import { CUIConfig } from './src/cui/types';
import chalk from 'chalk';

const program = new Command();

program
  .name('mavlink-bridge')
  .description('MAVLinkBridge ESP32 Command-Line Interface')
  .version('1.0.0');

program
  .option('-u, --url <url>', 'Device URL', 'http://192.168.4.1')
  .option('-c, --connect', 'Auto-connect to device on startup')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colored output')
  .option('-t, --timeout <ms>', 'Command timeout in milliseconds', '30000')
  .option('-h, --history <size>', 'Command history size', '100');

program.action(async (options) => {
  try {
    const config: Partial<CUIConfig> = {
      defaultDeviceUrl: options.url,
      autoConnect: options.connect || false,
      verbose: options.verbose || false,
      colorOutput: options.color !== false,
      commandTimeout: parseInt(options.timeout),
      historySize: parseInt(options.history)
    };

    // Disable colors if requested
    if (!config.colorOutput) {
      chalk.level = 0;
    }

    // Create and start the CUI application
    const app = new CUIApplication(config);

    // Handle process signals
    process.on('SIGINT', () => {
      app.stop();
    });

    process.on('SIGTERM', () => {
      app.stop();
    });

    // Start the application
    await app.start();

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red('Failed to start CLI:'), err.message);
    if (options.verbose && err.stack) {
      console.error(chalk.gray(err.stack));
    }
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

program.parse();