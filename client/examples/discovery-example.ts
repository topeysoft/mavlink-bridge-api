#!/usr/bin/env node

/**
 * MAVLink Bridge Device Discovery Example
 * 
 * This example demonstrates various ways to discover MAVLink Bridge devices
 * on your network using the discovery library.
 */

import { 
  discoverMAVLinkBridgeDevices, 
  findMAVLinkBridgeDevices,
  findUnprovisionedDevices,
  findProvisionedDevices,
  startContinuousDiscovery,
  type MAVLinkBridgeDevice,
  type DiscoveryOptions
} from '../src/discovery/index';

async function basicDiscovery() {
  console.log('=== Basic Discovery ===');
  
  const result = await discoverMAVLinkBridgeDevices();
  
  console.log(`Discovery completed in ${result.duration}ms`);
  console.log(`Scanned ${result.hostsScanned} hosts`);
  console.log(`Found ${result.devices.length} devices:`);
  
  result.devices.forEach(device => {
    console.log(`  ${device.name} (${device.ip})`);
    console.log(`    MAC: ${device.id}`);
    console.log(`    Status: ${device.status}`);
    console.log(`    Provisioned: ${device.isProvisioned}`);
  });
  
  console.log('');
}

async function customSubnetDiscovery() {
  console.log('=== Custom Subnet Discovery ===');
  
  const options: DiscoveryOptions = {
    subnets: ['192.168.1.0/24', '10.0.0.0/24'],
    timeout: 3000,
    concurrent: 30
  };
  
  const result = await discoverMAVLinkBridgeDevices(options);
  
  console.log(`Found ${result.devices.length} devices on specified subnets:`);
  result.devices.forEach(device => {
    console.log(`  ${device.name} @ ${device.ip}`);
  });
  
  console.log('');
}

async function findUnprovisioned() {
  console.log('=== Finding Unprovisioned Devices ===');
  
  const devices = await findUnprovisionedDevices();
  
  if (devices.length === 0) {
    console.log('No unprovisioned devices found');
  } else {
    console.log(`Found ${devices.length} unprovisioned devices:`);
    devices.forEach(device => {
      console.log(`  ${device.name} @ ${device.ip}`);
      console.log(`    AP Mode: ${device.network.ap.enabled}`);
      console.log(`    WiFi Status: ${device.network.wifi.status}`);
    });
  }
  
  console.log('');
}

async function findProvisioned() {
  console.log('=== Finding Provisioned Devices ===');
  
  const devices = await findProvisionedDevices();
  
  if (devices.length === 0) {
    console.log('No provisioned devices found');
  } else {
    console.log(`Found ${devices.length} provisioned devices:`);
    devices.forEach(device => {
      console.log(`  ${device.name} @ ${device.ip}`);
      if (device.network.wifi.ssid) {
        console.log(`    Connected to: ${device.network.wifi.ssid}`);
        console.log(`    Signal: ${device.network.wifi.rssi}dBm`);
      }
    });
  }
  
  console.log('');
}

async function detailedDeviceInfo() {
  console.log('=== Detailed Device Information ===');
  
  const devices = await findMAVLinkBridgeDevices();
  
  devices.forEach(device => {
    console.log(`Device: ${device.name}`);
    console.log(`  IP: ${device.ip}`);
    console.log(`  MAC: ${device.id}`);
    console.log(`  Hostname: ${device.hostname}`);
    console.log(`  Status: ${device.status}`);
    console.log(`  Provisioned: ${device.isProvisioned}`);
    
    console.log(`  Hardware:`);
    console.log(`    Chip: ${device.capabilities.chipModel} rev ${device.capabilities.chipRevision}`);
    console.log(`    Flash: ${(device.capabilities.flashSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`    Cores: ${device.capabilities.coreCount}`);
    console.log(`    SDK: ${device.capabilities.sdkVersion}`);
    
    console.log(`  Network:`);
    console.log(`    WiFi MAC: ${device.network.macAddress}`);
    console.log(`    AP MAC: ${device.network.apMacAddress}`);
    console.log(`    WiFi Status: ${device.network.wifi.status}`);
    if (device.network.wifi.ssid) {
      console.log(`    SSID: ${device.network.wifi.ssid}`);
      console.log(`    RSSI: ${device.network.wifi.rssi}dBm`);
    }
    console.log(`    AP Enabled: ${device.network.ap.enabled}`);
    if (device.network.ap.enabled && device.network.ap.clients !== undefined) {
      console.log(`    AP Clients: ${device.network.ap.clients}`);
    }
    
    console.log('');
  });
}

function continuousDiscoveryExample() {
  console.log('=== Continuous Discovery ===');
  console.log('Starting continuous discovery (will run for 60 seconds)...');
  
  const knownDevices = new Map<string, MAVLinkBridgeDevice>();
  
  const stopDiscovery = startContinuousDiscovery(
    (device) => {
      if (!knownDevices.has(device.id)) {
        console.log(`NEW DEVICE: ${device.name} @ ${device.ip}`);
      } else {
        console.log(`UPDATED: ${device.name} @ ${device.ip}`);
      }
      knownDevices.set(device.id, device);
    },
    (deviceId) => {
      const device = knownDevices.get(deviceId);
      if (device) {
        console.log(`LOST DEVICE: ${device.name} (${deviceId})`);
        knownDevices.delete(deviceId);
      }
    },
    {
      interval: 10000, // Check every 10 seconds
      subnets: ['192.168.1.0/24'],
      timeout: 3000
    }
  );
  
  // Stop after 60 seconds
  setTimeout(() => {
    console.log('Stopping continuous discovery...');
    stopDiscovery();
    console.log(`Final device count: ${knownDevices.size}`);
  }, 60000);
}

async function performanceTest() {
  console.log('=== Performance Test ===');
  
  const start = Date.now();
  
  // Test different concurrency levels
  const concurrencyLevels = [10, 20, 50];
  
  for (const concurrent of concurrencyLevels) {
    const testStart = Date.now();
    
    const result = await discoverMAVLinkBridgeDevices({
      subnets: ['192.168.1.0/24'],
      concurrent,
      timeout: 2000
    });
    
    const duration = Date.now() - testStart;
    const hostsPerSecond = Math.round(result.hostsScanned / (duration / 1000));
    
    console.log(`Concurrency ${concurrent}: ${duration}ms, ${hostsPerSecond} hosts/sec, ${result.devices.length} devices`);
  }
  
  console.log(`Total test time: ${Date.now() - start}ms`);
  console.log('');
}

async function main() {
  console.log('MAVLink Bridge Device Discovery Examples\n');
  
  try {
    // Run all examples
    await basicDiscovery();
    await customSubnetDiscovery();
    await findUnprovisioned();
    await findProvisioned();
    await detailedDeviceInfo();
    await performanceTest();
    
    // Run continuous discovery (comment out if not needed)
    // continuousDiscoveryExample();
    
  } catch (error) {
    console.error('Discovery error:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

export {
  basicDiscovery,
  customSubnetDiscovery,
  findUnprovisioned,
  findProvisioned,
  detailedDeviceInfo,
  continuousDiscoveryExample,
  performanceTest
};