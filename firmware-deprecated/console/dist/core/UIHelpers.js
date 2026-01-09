import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
export class UIHelpers {
    displayError(message, error) {
        console.log(chalk.red.bold('❌ Error: ') + chalk.red(message));
        if (error && process.env.DEBUG) {
            console.log(chalk.gray('Debug info:'), error);
        }
    }
    displaySuccess(message) {
        console.log(chalk.green.bold('✅ Success: ') + chalk.green(message));
    }
    displayWarning(message) {
        console.log(chalk.yellow.bold('⚠️  Warning: ') + chalk.yellow(message));
    }
    displayInfo(message) {
        try {
            console.log(chalk.blue.bold('ℹ️  Info: ') + chalk.blue(message));
        }
        catch (er) {
        }
    }
    displayStatus(label, status, isOnline = true) {
        const icon = isOnline ? '🟢' : '🔴';
        const color = isOnline ? chalk.green : chalk.red;
        console.log(`${icon} ${chalk.bold(label)}: ${color(status)}`);
    }
    createTable(headers, options) {
        return new Table({
            head: headers.map(h => chalk.cyan.bold(h)),
            style: { border: ['gray'] },
            ...options
        });
    }
    async pressAnyKey(message = 'Press any key to continue...') {
        await inquirer.prompt([{
                type: 'input',
                name: 'continue',
                message: chalk.gray(message),
                transformer: () => ''
            }]);
    }
    async confirmAction(message, defaultValue = false) {
        const { confirmed } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirmed',
                message: message,
                default: defaultValue
            }]);
        return confirmed;
    }
    async getTextInput(message, defaultValue, validate) {
        const { input } = await inquirer.prompt([{
                type: 'input',
                name: 'input',
                message: message,
                default: defaultValue,
                validate: validate ? (input) => {
                    const result = validate(input);
                    return result.valid || result.error || 'Invalid input';
                } : undefined
            }]);
        return input;
    }
    async getNumberInput(message, defaultValue, min, max) {
        const { input } = await inquirer.prompt({
            type: 'number',
            name: 'input',
            message: message,
            default: defaultValue,
            validate: (input) => {
                if (input === undefined || isNaN(input))
                    return 'Please enter a valid number';
                if (min !== undefined && input < min)
                    return `Value must be at least ${min}`;
                if (max !== undefined && input > max)
                    return `Value must be at most ${max}`;
                return true;
            }
        });
        return input;
    }
    async selectFromList(message, choices) {
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
    async multiSelect(message, choices) {
        const { selected } = await inquirer.prompt([{
                type: 'checkbox',
                name: 'selected',
                message: message,
                choices: choices
            }]);
        return selected;
    }
    displayProgressBar(current, total, label = 'Progress') {
        const percentage = Math.round((current / total) * 100);
        const barLength = 30;
        const filledLength = Math.round((percentage / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        process.stdout.write(`\r${label}: [${chalk.green(bar)}] ${percentage}%`);
        if (current === total) {
            console.log(); // New line when complete
        }
    }
    formatBytes(bytes, decimals = 2) {
        if (bytes === undefined || bytes === null || isNaN(bytes))
            return 'N/A';
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    displayKeyValuePairs(data, options = {}) {
        const table = this.createTable(['Property', 'Value']);
        Object.entries(data).forEach(([key, value]) => {
            let displayValue = String(value);
            // Format special values
            if (typeof value === 'boolean') {
                displayValue = value ? chalk.green('✓') : chalk.red('✗');
            }
            else if (typeof value === 'number' && key.toLowerCase().includes('bytes')) {
                displayValue = this.formatBytes(value);
            }
            else if (value === null || value === undefined) {
                displayValue = chalk.gray('N/A');
            }
            table.push([chalk.bold(key), displayValue]);
        });
        console.log(table.toString());
    }
    clearScreen() {
        console.clear();
    }
    displaySeparator(char = '─', length = 50) {
        console.log(chalk.gray(char.repeat(length)));
    }
}
//# sourceMappingURL=UIHelpers.js.map