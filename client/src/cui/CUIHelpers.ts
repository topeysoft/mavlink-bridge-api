import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { Ora } from 'ora';

export class CUIHelpers {
  private static spinner: Ora | null = null;

  /**
   * Format bytes to human readable format
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format uptime to human readable format
   */
  static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }

  /**
   * Format boolean value with color
   */
  static formatBoolean(value: boolean): string {
    return value ? chalk.green('Yes') : chalk.red('No');
  }

  /**
   * Format status with appropriate color
   */
  static formatStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'active':
      case 'ok':
        return chalk.green(status);
      case 'warning':
      case 'connecting':
      case 'pending':
        return chalk.yellow(status);
      case 'error':
      case 'failed':
      case 'disconnected':
      case 'inactive':
        return chalk.red(status);
      default:
        return status;
    }
  }

  /**
   * Format WiFi signal strength
   */
  static formatSignalStrength(rssi: number): string {
    let quality: string;
    if (rssi >= -50) quality = 'excellent';
    else if (rssi >= -60) quality = 'good';
    else if (rssi >= -70) quality = 'fair';
    else quality = 'poor';
    
    const colorMap: Record<string, any> = {
      excellent: chalk.green,
      good: chalk.greenBright,
      fair: chalk.yellow,
      poor: chalk.red
    };
    
    const color = colorMap[quality];
    
    return color(`${rssi} dBm (${quality})`);
  }

  /**
   * Create a formatted table
   */
  static createTable(options?: any): Table.Table {
    return new Table({
      style: { 
        head: ['cyan'],
        border: ['gray']
      },
      ...options
    });
  }

  /**
   * Print error message
   */
  static printError(message: string, error?: Error): void {
    console.error(chalk.red('✖'), message);
    if (error && error.message) {
      console.error(chalk.gray(`  ${error.message}`));
    }
  }

  /**
   * Print success message
   */
  static printSuccess(message: string): void {
    console.log(chalk.green('✔'), message);
  }

  /**
   * Print warning message
   */
  static printWarning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Print info message
   */
  static printInfo(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Start a spinner
   */
  static startSpinner(text: string): Ora {
    this.stopSpinner();
    this.spinner = ora(text).start();
    return this.spinner;
  }

  /**
   * Stop the current spinner
   */
  static stopSpinner(success: boolean = true, text?: string): void {
    if (this.spinner) {
      if (text) {
        if (success) {
          this.spinner.succeed(text);
        } else {
          this.spinner.fail(text);
        }
      } else {
        this.spinner.stop();
      }
      this.spinner = null;
    }
  }

  /**
   * Format timestamp
   */
  static formatTimestamp(timestamp: number | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString();
  }

  /**
   * Format JSON with syntax highlighting
   */
  static formatJSON(obj: any, indent: number = 2): string {
    const json = JSON.stringify(obj, null, indent);
    return json
      .replace(/(".*?")/g, chalk.yellow('$1'))
      .replace(/:\s*(\d+)/g, ': ' + chalk.cyan('$1'))
      .replace(/:\s*(true|false)/g, ': ' + chalk.magenta('$1'))
      .replace(/:\s*(null)/g, ': ' + chalk.gray('$1'));
  }

  /**
   * Print a divider line
   */
  static printDivider(char: string = '─', length: number = 60): void {
    console.log(chalk.gray(char.repeat(length)));
  }

  /**
   * Format percentage with color
   */
  static formatPercentage(value: number, thresholds?: { warning: number; critical: number }): string {
    const percentage = `${value.toFixed(1)}%`;
    
    if (!thresholds) {
      return percentage;
    }
    
    if (value >= thresholds.critical) {
      return chalk.red(percentage);
    } else if (value >= thresholds.warning) {
      return chalk.yellow(percentage);
    } else {
      return chalk.green(percentage);
    }
  }

  /**
   * Clear the console
   */
  static clearConsole(): void {
    process.stdout.write('\x1Bc');
  }

  /**
   * Format command help
   */
  static formatCommandHelp(command: { name: string; description: string; usage?: string; examples?: string[] }): string {
    let help = `\n${chalk.bold(command.name)} - ${command.description}\n`;
    
    if (command.usage) {
      help += `\n${chalk.bold('Usage:')}\n  ${command.usage}\n`;
    }
    
    if (command.examples && command.examples.length > 0) {
      help += `\n${chalk.bold('Examples:')}\n`;
      command.examples.forEach(example => {
        help += `  ${example}\n`;
      });
    }
    
    return help;
  }
}