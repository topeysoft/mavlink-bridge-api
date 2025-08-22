import chalk from 'chalk';
import ora from 'ora';
import { MAVLinkBridgeClient, createClient, discoverDevices } from '@mavlinkbridge/api-client';
import { ConsoleContext } from '../types/index.js';

export class ClientManager {
  private context: ConsoleContext | null = null;

  public setContext(context: ConsoleContext): void {
    this.context = context;
  }

  public async discoverDevices(timeout: number = 5000): Promise<string[]> {
    const spinner = ora('Discovering devices...').start();
    
    try {
      const devices = await discoverDevices(timeout);
      
      if (devices.length === 0) {
        spinner.warn('No devices found');
        console.log(chalk.yellow('Try these common addresses:'));
        console.log(chalk.gray('  • http://192.168.4.1 (AP mode)'));
        console.log(chalk.gray('  • http://192.168.1.100 (Station mode)'));
        console.log(chalk.gray('  • http://yardrover.local (mDNS)'));
        
        // Return common addresses as fallback
        return ['http://192.168.4.1', 'http://192.168.1.100', 'http://yardrover.local'];
      }
      
      spinner.succeed(`Found ${devices.length} device(s)`);
      return devices;
    } catch (error) {
      spinner.fail('Discovery failed');
      console.log(chalk.red('Error:'), error);
      return [];
    }
  }

  public async connect(deviceUrl: string): Promise<boolean> {
    if (!this.context) {
      throw new Error('Context not set');
    }

    const spinner = ora(`Connecting to ${deviceUrl}...`).start();
    
    try {
      const client = createClient(deviceUrl, {
        httpTimeout: 10000,
        maxReconnectAttempts: 3,
        reconnectDelay: 2000,
        autoConnectWebSocket: true
      });

      // Test connection by getting device health
      await client.health.getSystemHealth();
      
      this.context.client = client;
      this.context.deviceUrl = deviceUrl;
      this.context.connected = true;
      
      spinner.succeed(`Connected to ${deviceUrl}`);
      
      // Set up event listeners
      this.setupEventListeners(client);
      
      return true;
    } catch (error) {
      spinner.fail(`Failed to connect to ${deviceUrl}`);
      console.log(chalk.red('Connection error:'), error);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.context?.client) {
      return;
    }

    const spinner = ora('Disconnecting...').start();
    
    try {
      // Clean up client connection
      // Note: WebSocket cleanup would be handled here when available
      
      this.context.client = null;
      this.context.deviceUrl = null;
      this.context.connected = false;
      
      spinner.succeed('Disconnected successfully');
    } catch (error) {
      spinner.fail('Error during disconnection');
      console.log(chalk.red('Disconnect error:'), error);
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.context?.client) {
      console.log(chalk.red('Not connected to any device'));
      return false;
    }

    const spinner = ora('Testing connection...').start();
    
    try {
      const health = await this.context.client.health.getSystemHealth();
      spinner.succeed('Connection test passed');
      
      console.log(chalk.green('Device Status:'));
      console.log(`  • Status: ${health.systemHealthy ? 'Healthy' : 'Unhealthy'}`);
      console.log(`  • Uptime: ${Math.floor((health.uptime || 0) / 1000)}s`);
      console.log(`  • Free Memory: ${Math.floor((health.freeHeap || 0) / 1024)}KB`);
      
      return true;
    } catch (error) {
      spinner.fail('Connection test failed');
      console.log(chalk.red('Error:'), error);
      
      // Reset connection status
      this.context.connected = false;
      return false;
    }
  }

  private setupEventListeners(client: MAVLinkBridgeClient): void {
    // Event listeners would be set up here when the WebSocket API is available
    // For now, we'll just note that the client is connected
    if (process.env.DEBUG) {
      console.log(chalk.blue('[DEBUG] Event listeners would be configured here'));
    }
  }

  public getClient(): MAVLinkBridgeClient | null {
    return this.context?.client || null;
  }

  public isConnected(): boolean {
    return this.context?.connected || false;
  }

  public getDeviceUrl(): string | null {
    return this.context?.deviceUrl || null;
  }
}