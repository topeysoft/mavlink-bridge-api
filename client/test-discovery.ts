#!/usr/bin/env tsx

/**
 * Test script for MAVLinkBridge device discovery
 */

import { discoverDevices, discoverMAVLinkBridgeDevices, startContinuousDiscovery } from './src/index';
import chalk from 'chalk';
import ora from 'ora';

async function testSimpleDiscovery() {
  console.log(chalk.blue('\n=== Testing Simple Discovery ===\n'));
  
  const spinner = ora('Discovering MAVLinkBridge devices...').start();
  
  try {
    const deviceUrls = await discoverDevices(5000);
    
    if (deviceUrls.length === 0) {
      spinner.warn('No devices found');
    } else {
      spinner.succeed(`Found ${deviceUrls.length} device(s)`);
      deviceUrls.forEach((url, index) => {
        console.log(chalk.green(`  ${index + 1}. ${url}`));
      });
    }
  } catch (error) {
    spinner.fail('Discovery failed');
    console.error(chalk.red('Error:'), error);
  }
}

async function testDetailedDiscovery() {
  console.log(chalk.blue('\n=== Testing Detailed Discovery ===\n'));
  
  const spinner = ora('Performing detailed device discovery...').start();
  
  try {
    const result = await discoverMAVLinkBridgeDevices({
      timeout: 5000,
      concurrent: 20
    });
    
    spinner.succeed(`Discovery complete in ${result.duration}ms`);
    console.log(chalk.gray(`  Hosts scanned: ${result.hostsScanned}`));
    console.log(chalk.gray(`  Successful responses: ${result.successfulResponses}`));
    
    if (result.devices.length > 0) {
      console.log(chalk.green(`\nFound ${result.devices.length} device(s):`));
      
      result.devices.forEach((device, index) => {
        console.log(chalk.cyan(`\n  Device ${index + 1}:`));
        console.log(`    Name: ${device.name}`);
        console.log(`    Hostname: ${device.hostname}`);
        console.log(`    IP: ${device.ip}`);
        console.log(`    MAC: ${device.id}`);
        console.log(`    Status: ${device.status}`);
        console.log(`    Provisioned: ${device.isProvisioned ? 'Yes' : 'No'}`);
        console.log(`    Chip: ${device.capabilities.chipModel} (Rev ${device.capabilities.chipRevision})`);
        
        if (device.network.wifi.ssid) {
          console.log(`    WiFi: Connected to "${device.network.wifi.ssid}" (RSSI: ${device.network.wifi.rssi}dBm)`);
        } else {
          console.log(`    WiFi: ${device.network.wifi.status}`);
        }
        
        if (device.network.ap.enabled) {
          console.log(`    AP Mode: Enabled (${device.network.ap.clients || 0} clients)`);
        }
      });
    }
  } catch (error) {
    spinner.fail('Discovery failed');
    console.error(chalk.red('Error:'), error);
  }
}

async function testContinuousDiscovery() {
  console.log(chalk.blue('\n=== Testing Continuous Discovery ===\n'));
  console.log(chalk.gray('Running discovery every 10 seconds. Press Ctrl+C to stop.\n'));
  
  const stopDiscovery = startContinuousDiscovery(
    (device) => {
      console.log(chalk.green(`[${new Date().toLocaleTimeString()}] Device found:`));
      console.log(`  ${device.name} (${device.ip}) - ${device.status}`);
    },
    (deviceId) => {
      console.log(chalk.yellow(`[${new Date().toLocaleTimeString()}] Device lost: ${deviceId}`));
    },
    {
      interval: 10000, // 10 seconds
      timeout: 5000
    }
  );
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log(chalk.blue('\n\nStopping continuous discovery...'));
    stopDiscovery();
    process.exit(0);
  });
}

// Main execution
async function main() {
  console.log(chalk.bold.blue('MAVLinkBridge Device Discovery Test\n'));
  
  // Test simple discovery
  await testSimpleDiscovery();
  
  // Test detailed discovery
  await testDetailedDiscovery();
  
  // Ask if user wants to test continuous discovery
  console.log(chalk.yellow('\nWould you like to test continuous discovery? (y/n)'));
  
  process.stdin.once('data', async (data) => {
    const answer = data.toString().trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      await testContinuousDiscovery();
    } else {
      console.log(chalk.blue('\nTest complete!'));
      process.exit(0);
    }
  });
}

// Run the test
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});