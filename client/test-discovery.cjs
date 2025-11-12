#!/usr/bin/env node

/**
 * CommonJS test script for MAVLinkBridge device discovery
 */

async function test() {
  console.log('=== Testing Device Discovery ===\n');
  
  try {
    // Dynamic import for ES modules
    const clientModule = await import('./dist/index.js');
    const { discoverDevices, discoverMAVLinkBridgeDevices } = clientModule;
    
    console.log('Testing simple discovery (5 second timeout)...');
    const deviceUrls = await discoverDevices(5000);
    
    if (deviceUrls.length === 0) {
      console.log('No devices found via simple discovery\n');
    } else {
      console.log(`Found ${deviceUrls.length} device(s) via simple discovery:`);
      deviceUrls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
      console.log();
    }
    
    console.log('Testing detailed discovery...');
    const result = await discoverMAVLinkBridgeDevices({
      timeout: 5000,
      concurrent: 20
    });
    
    console.log(`\nDiscovery complete in ${result.duration}ms`);
    console.log(`Hosts scanned: ${result.hostsScanned}`);
    console.log(`Successful responses: ${result.successfulResponses}`);
    
    if (result.devices.length > 0) {
      console.log(`\nFound ${result.devices.length} device(s) with detailed info:`);
      
      result.devices.forEach((device, index) => {
        console.log(`\nDevice ${index + 1}:`);
        console.log(`  Name: ${device.name}`);
        console.log(`  Hostname: ${device.hostname}`);
        console.log(`  IP: ${device.ip}`);
        console.log(`  MAC: ${device.id}`);
        console.log(`  Status: ${device.status}`);
        console.log(`  Provisioned: ${device.isProvisioned ? 'Yes' : 'No'}`);
        console.log(`  Chip: ${device.capabilities.chipModel} (Rev ${device.capabilities.chipRevision})`);
        
        if (device.network.wifi.ssid) {
          console.log(`  WiFi: Connected to "${device.network.wifi.ssid}" (RSSI: ${device.network.wifi.rssi}dBm)`);
        } else {
          console.log(`  WiFi: ${device.network.wifi.status}`);
        }
        
        if (device.network.ap.enabled) {
          console.log(`  AP Mode: Enabled (${device.network.ap.clients || 0} clients)`);
        }
      });
    } else {
      console.log('\nNo devices found via detailed discovery');
    }
    
  } catch (error) {
    console.error('Discovery failed:', error.message || error);
  }
}

// Run the test
test().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});