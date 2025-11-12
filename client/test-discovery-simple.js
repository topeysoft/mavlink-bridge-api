#!/usr/bin/env node

/**
 * Simple test script for MAVLinkBridge device discovery
 */

const { discoverDevices, discoverMAVLinkBridgeDevices } = await import('./dist/index.js');

async function test() {
  console.log('=== Testing Simple Discovery ===\n');
  
  try {
    console.log('Discovering devices (5 second timeout)...');
    const deviceUrls = await discoverDevices(5000);
    
    if (deviceUrls.length === 0) {
      console.log('No devices found');
    } else {
      console.log(`Found ${deviceUrls.length} device(s):`);
      deviceUrls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
  } catch (error) {
    console.error('Discovery failed:', error);
  }
  
  console.log('\n=== Testing Detailed Discovery ===\n');
  
  try {
    console.log('Performing detailed device discovery...');
    const result = await discoverMAVLinkBridgeDevices({
      timeout: 5000,
      concurrent: 20
    });
    
    console.log(`Discovery complete in ${result.duration}ms`);
    console.log(`  Hosts scanned: ${result.hostsScanned}`);
    console.log(`  Successful responses: ${result.successfulResponses}`);
    
    if (result.devices.length > 0) {
      console.log(`\nFound ${result.devices.length} device(s):`);
      
      result.devices.forEach((device, index) => {
        console.log(`\n  Device ${index + 1}:`);
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
    console.error('Discovery failed:', error);
  }
}

// Run the test
test().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});