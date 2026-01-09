import chalk from 'chalk';
import ora from 'ora';
import { MenuSystem } from '../ui/MenuSystem.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from './UIHelpers.js';
export class ConsoleApp {
    context;
    menuSystem;
    clientManager;
    uiHelpers;
    constructor() {
        this.context = {
            client: null,
            deviceUrl: null,
            connected: false,
            currentMenu: 'main',
            exitRequested: false
        };
        this.clientManager = new ClientManager();
        this.uiHelpers = new UIHelpers();
        this.menuSystem = new MenuSystem(this.context, this.clientManager, this.uiHelpers);
    }
    async start() {
        this.displayWelcome();
        while (!this.context.exitRequested) {
            try {
                await this.menuSystem.displayMainMenu();
            }
            catch (error) {
                console.error(chalk.red('An error occurred:'), error);
                await this.uiHelpers.pressAnyKey('Press any key to continue...');
            }
        }
        await this.shutdown();
    }
    displayWelcome() {
        console.clear();
        console.log(chalk.cyan.bold('┌─────────────────────────────────────────┐'));
        console.log(chalk.cyan.bold('│        YardRover Console Manager        │'));
        console.log(chalk.cyan.bold('│     Interactive MAVLinkBridge Client    │'));
        console.log(chalk.cyan.bold('└─────────────────────────────────────────┘'));
        console.log();
        console.log(chalk.gray('Welcome to the YardRover Console Manager!'));
        console.log(chalk.gray('This interactive console provides comprehensive control'));
        console.log(chalk.gray('over your MAVLinkBridge ESP32 device.'));
        console.log();
        if (!this.context.connected) {
            console.log(chalk.yellow('⚠️  Not connected to any device'));
            console.log(chalk.gray('   Use the Device menu to discover and connect to devices'));
        }
        console.log();
    }
    async shutdown() {
        const spinner = ora('Shutting down console...').start();
        try {
            if (this.context.client) {
                await this.clientManager.disconnect();
            }
            spinner.succeed('Console shut down successfully');
        }
        catch (error) {
            spinner.fail('Error during shutdown');
            console.error(chalk.red('Shutdown error:'), error);
        }
        console.log(chalk.cyan('Thank you for using YardRover Console Manager!'));
    }
    getContext() {
        return this.context;
    }
}
//# sourceMappingURL=ConsoleApp.js.map