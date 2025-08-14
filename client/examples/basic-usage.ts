/**
 * Basic usage example for MAVLinkBridge API client
 */

import { MAVLinkBridgeClient, EventType } from '../src/index';

async function basicExample() {
  // Create client instance
  const client = new MAVLinkBridgeClient('http://192.168.4.1', {
    httpTimeout: 10000, // 10 second timeout
    maxReconnectAttempts: 3,
    reconnectDelay: 2000
  });

  try {
    // Connect to the device
    console.log('Connecting to MAVLinkBridge device...');
    await client.connect();
    console.log('Connected successfully!');

    // Get device health
    const health = await client.getHealth();
    console.log('Device Health:');
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${health.uptime} seconds`);
    console.log(`  Free Heap: ${health.freeHeap} bytes`);

    // Get current configuration
    const config = await client.getConfiguration();
    console.log('\nCurrent Configuration:');
    console.log(`  Device Name: ${config.device.name}`);
    console.log(`  Device Mode: ${config.device.mode}`);
    console.log(`  Connection Type: ${config.connection.type}`);
    console.log(`  WiFi SSID: ${config.connection.wifi.ssid || '(not set)'}`);
    console.log(`  WiFi Auto-Connect: ${config.connection.wifi.autoConnect}`);
    console.log(`  RTCM Enabled: ${config.rtcm.enabled}`);

    if (config.rtcm.enabled) {
      console.log(`  RTCM Source: ${config.rtcm.source.type}://${config.rtcm.source.host}:${config.rtcm.source.port}`);
      if (config.rtcm.source.mountpoint) {
        console.log(`  RTCM Mountpoint: ${config.rtcm.source.mountpoint}`);
      }
    }

    // Set up event listeners
    client.onStatus((status) => {
      console.log(`\nStatus Update: ${status.status}`);
      console.log(`  Uptime: ${status.uptime}s`);
      console.log(`  Free Heap: ${status.freeHeap} bytes`);
      if (status.wifiConnected !== undefined) {
        console.log(`  WiFi: ${status.wifiConnected ? 'Connected' : 'Disconnected'}`);
      }
      if (status.rtcmActive !== undefined) {
        console.log(`  RTCM: ${status.rtcmActive ? 'Active' : 'Inactive'}`);
      }
    });

    client.onConfigChanged((change) => {
      console.log(`\nConfiguration Changed: ${change.section}`);
      console.log('  Changes:', JSON.stringify(change.changes, null, 2));
    });

    client.onRTCMData((data) => {
      console.log(`\nRTCM Data Received:`);
      console.log(`  Message Type: ${data.messageType}`);
      console.log(`  Length: ${data.length} bytes`);
      console.log(`  Timestamp: ${new Date(data.timestamp).toISOString()}`);
    });

    client.onError((error) => {
      console.error(`\nDevice Error [${error.severity}]: ${error.message}`);
      console.error(`  Code: ${error.code}`);
      console.error(`  Time: ${new Date(error.timestamp).toISOString()}`);
    });

    client.onLog((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const component = log.component ? `[${log.component}] ` : '';
      console.log(`[${timestamp}] ${log.level.toUpperCase()}: ${component}${log.message}`);
    });

    // Example configuration update
    console.log('\nUpdating device name...');
    await client.updateDeviceName('My-MAVLinkBridge-Device');
    console.log('Device name updated successfully');

    // Keep the connection alive for 30 seconds to observe events
    console.log('\nListening for events for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    client.disconnect();
    console.log('\nDisconnected from device');
  }
}

// Run the example
basicExample().catch(console.error);