import chalk from 'chalk';
import ora from 'ora';
import { MAVLinkBridgeClient, createClient, discoverMAVLinkBridgeDevices } from '@mavlinkbridge/api-client';
import type { DiscoveryOptions, DiscoveryResult, MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { ConsoleContext } from '../types/index.js';

export class ClientManager {
  private context: ConsoleContext | null = null;

  public setContext(context: ConsoleContext): void {
    this.context = context;
  }

  public async discoverDevices(
    options: DiscoveryOptions = {},
    onProgress?: (message: string) => void
  ): Promise<DiscoveryResult> {
    const spinner = ora('Initializing device discovery...').start();
    
    try {
      // Set default options if not provided
      const discoveryOptions: DiscoveryOptions = {
        timeout: 5000,
        concurrent: 20,
        ...options
      };

      // Log discovery configuration
      if (discoveryOptions.subnets && discoveryOptions.subnets.length > 0) {
        spinner.text = `Scanning subnets: ${discoveryOptions.subnets.join(', ')}`;
        onProgress?.(`Scanning subnets: ${discoveryOptions.subnets.join(', ')}`);
      } else {
        spinner.text = 'Auto-detecting network subnets...';
        onProgress?.('Auto-detecting network subnets...');
      }
      
      const result = await discoverMAVLinkBridgeDevices(discoveryOptions);
      
      if (result.devices.length === 0) {
        spinner.warn('No devices found');
        console.log(chalk.yellow('\n💡 Discovery tips:'));
        console.log(chalk.gray('  • Check if devices are powered on'));
        console.log(chalk.gray('  • Verify network connectivity'));
        console.log(chalk.gray('  • Try AP mode: http://192.168.4.1'));
        console.log(chalk.gray('  • Try mDNS: http://yardrover.local'));
        console.log(chalk.gray('  • Specify custom subnets to scan'));
      } else {
        spinner.succeed(`Found ${result.devices.length} device(s) in ${(result.duration / 1000).toFixed(1)}s`);
      }
      
      return result;
    } catch (error) {
      spinner.fail('Discovery failed');
      console.log(chalk.red('Error:'), error);
      return {
        devices: [],
        duration: 0,
        hostsScanned: 0,
        successfulResponses: 0
      };
    }
  }

  /**
   * Quick helper method for backward compatibility
   */
  public async discoverDeviceUrls(timeout: number = 5000): Promise<string[]> {
    const result = await this.discoverDevices({ timeout });
    return result.devices.map(device => {
      const port = device.network.wifi.status === 'connected' ? 80 : 80;
      return `http://${device.ip}:${port}`;
    });
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