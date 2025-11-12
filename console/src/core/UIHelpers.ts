import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { ValidationResult, DisplayOptions } from '../types/index.js';

export class UIHelpers {
  public displayError (message: string, error?: any): void {
    console.log(chalk.red.bold('❌ Error: ') + chalk.red(message));
    if (error && process.env.DEBUG) {
      console.log(chalk.gray('Debug info:'), error);
    }
  }

  public displaySuccess (message: string): void {
    console.log(chalk.green.bold('✅ Success: ') + chalk.green(message));
  }

  public displayWarning (message: string): void {
    console.log(chalk.yellow.bold('⚠️  Warning: ') + chalk.yellow(message));
  }

  public displayInfo (message: string): void {
    try {
      console.log(chalk.blue.bold('ℹ️  Info: ') + chalk.blue(message));
    } catch (er) {

    }
  }

  public displayStatus (label: string, status: string, isOnline: boolean = true): void {
    const icon = isOnline ? '🟢' : '🔴';
    const color = isOnline ? chalk.green : chalk.red;
    console.log(`${icon} ${chalk.bold(label)}: ${color(status)}`);
  }

  public createTable (headers: string[], options?: any): Table.Table {
    return new Table({
      head: headers.map(h => chalk.cyan.bold(h)),
      style: { border: ['gray'] },
      ...options
    });
  }

  public async pressAnyKey (message: string = 'Press any key to continue...'): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: chalk.gray(message),
      transformer: () => ''
    }]);
  }

  public async confirmAction (message: string, defaultValue: boolean = false): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: message,
      default: defaultValue
    }]);
    return confirmed;
  }

  public async getTextInput (message: string, defaultValue?: string, validate?: (input: string) => ValidationResult): Promise<string> {
    const { input } = await inquirer.prompt([{
      type: 'input',
      name: 'input',
      message: message,
      default: defaultValue,
      validate: validate ? (input: string) => {
        const result = validate(input);
        return result.valid || result.error || 'Invalid input';
      } : undefined
    }]);
    return input;
  }

  public async getNumberInput (message: string, defaultValue?: number, min?: number, max?: number): Promise<number> {
    const { input } = await inquirer.prompt({
      type: 'number',
      name: 'input',
      message: message,
      default: defaultValue,
      validate: (input: number | undefined) => {
        if (input === undefined || isNaN(input)) return 'Please enter a valid number';
        if (min !== undefined && input < min) return `Value must be at least ${min}`;
        if (max !== undefined && input > max) return `Value must be at most ${max}`;
        return true;
      }
    });
    return input;
  }

  public async selectFromList<T> (message: string, choices: Array<{ name: string; value: T; description?: string }>): Promise<T> {
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: message,
      choices: choices.map(choice => ({
        name: choice.description ? `${choice.name} - ${chalk.gray(choice.description)}` : choice.name,
        value: choice.value
      }))
    }]);
    return selected;
  }

  public async multiSelect<T> (message: string, choices: Array<{ name: string; value: T; checked?: boolean }>): Promise<T[]> {
    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: message,
      choices: choices
    }]);
    return selected;
  }

  public displayProgressBar (current: number, total: number, label: string = 'Progress'): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    process.stdout.write(`\r${label}: [${chalk.green(bar)}] ${percentage}%`);
    if (current === total) {
      console.log(); // New line when complete
    }
  }

  public formatBytes (bytes: number, decimals: number = 2): string {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  public formatDuration (milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  public displayKeyValuePairs (data: Record<string, any>, options: DisplayOptions = {}): void {
    const table = this.createTable(['Property', 'Value']);

    Object.entries(data).forEach(([key, value]) => {
      let displayValue = String(value);

      // Format special values
      if (typeof value === 'boolean') {
        displayValue = value ? chalk.green('✓') : chalk.red('✗');
      } else if (typeof value === 'number' && key.toLowerCase().includes('bytes')) {
        displayValue = this.formatBytes(value);
      } else if (value === null || value === undefined) {
        displayValue = chalk.gray('N/A');
      }

      table.push([chalk.bold(key), displayValue]);
    });

    console.log(table.toString());
  }

  public clearScreen (): void {
    console.clear();
  }

  public displaySeparator (char: string = '─', length: number = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }
}