/**
 * RTCM Client Example
 * 
 * This example demonstrates how to use the TypeScript RTCM client
 * to interact with the ESP32 RTCM functionality.
 */

import { createClient, RTCMState } from '../src/index';

async function main() {
  // Create client instance
  const client = createClient('http://192.168.4.1');
  
  try {
    // Connect to the device
    console.log('Connecting to ESP32...');
    await client.connect();
    console.log('Connected!');
    
    // Set up RTCM event listeners
    const unsubscribeData = client.rtcm.onDataReceived((data) => {
      console.log(`RTCM Data: Type ${data.messageType} (${data.messageName}), ${data.length} bytes`);
      if (data.stationId) {
        console.log(`  Station ID: ${data.stationId}`);
      }
    });
    
    const unsubscribeState = client.rtcm.onStateChange((state) => {
      console.log(`RTCM State: ${state}`);
    });
    
    // Example 1: Start NTRIP client
    console.log('\n=== Starting NTRIP Client ===');
    try {
      const response = await client.rtcm.startNTRIP({
        host: 'rtk2go.com',
        port: 2101,
        mountpoint: 'DEMO',
        username: 'demo',
        password: 'demo',
        sendPosition: true,
        position: {
          latitude: 37.7749,   // San Francisco
          longitude: -122.4194,
          altitude: 16.0
        }
      });
      
      if (response.success) {
        console.log('NTRIP client started successfully');
      } else {
        console.error('Failed to start NTRIP client:', response.error);
      }
    } catch (error) {
      console.error('Error starting NTRIP client:', error);
    }
    
    // Monitor for 60 seconds
    console.log('\nMonitoring RTCM data for 60 seconds...');
    
    // Print status every 10 seconds
    const statusInterval = setInterval(async () => {
      try {
        const status = await client.rtcm.getStatus();
        console.log('\n=== RTCM Status ===');
        console.log(`Running: ${status.running}`);
        console.log(`State: ${status.state}`);
        console.log(`Client Type: ${status.clientType}`);
        console.log(`Uptime: ${status.uptime}s`);
        
        if (status.statistics) {
          console.log(`Messages: ${status.statistics.messagesReceived}`);
          console.log(`Bytes: ${status.statistics.bytesReceived}`);
          console.log(`Data Rate: ${status.statistics.dataRate.toFixed(2)} KB/s`);
          console.log(`CRC Errors: ${status.statistics.crcErrors}`);
          
          if (Object.keys(status.statistics.messageTypes).length > 0) {
            console.log('Message Types:');
            for (const [type, count] of Object.entries(status.statistics.messageTypes)) {
              console.log(`  ${type}: ${count}`);
            }
          }
        }
        console.log('==================');
      } catch (error) {
        console.error('Error getting status:', error);
      }
    }, 10000);
    
    // Wait for 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    clearInterval(statusInterval);
    
    // Stop RTCM client
    console.log('\nStopping RTCM client...');
    try {
      const response = await client.rtcm.stop();
      if (response.success) {
        console.log('RTCM client stopped successfully');
      } else {
        console.error('Failed to stop RTCM client:', response.error);
      }
    } catch (error) {
      console.error('Error stopping RTCM client:', error);
    }
    
    // Example 2: Start TCP client
    console.log('\n=== Starting TCP Client Example ===');
    try {
      const response = await client.rtcm.startTCP('192.168.1.100', 2101);
      if (response.success) {
        console.log('TCP client started successfully');
        
        // Wait a bit then stop
        await new Promise(resolve => setTimeout(resolve, 5000));
        await client.rtcm.stop();
        console.log('TCP client stopped');
      }
    } catch (error) {
      console.error('TCP client example failed:', error);
    }
    
    // Example 3: Start UDP client
    console.log('\n=== Starting UDP Client Example ===');
    try {
      const response = await client.rtcm.startUDP(2101);
      if (response.success) {
        console.log('UDP client started successfully');
        
        // Wait a bit then stop
        await new Promise(resolve => setTimeout(resolve, 5000));
        await client.rtcm.stop();
        console.log('UDP client stopped');
      }
    } catch (error) {
      console.error('UDP client example failed:', error);
    }
    
    // Cleanup
    unsubscribeData();
    unsubscribeState();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    client.disconnect();
    console.log('Disconnected from ESP32');
  }
}

// Advanced RTCM configuration example
async function advancedConfigExample() {
  const client = createClient('http://192.168.4.1');
  
  try {
    await client.connect();
    
    // Start RTCM with custom configuration
    const customConfig = {
      enabled: true,
      source: {
        type: 'ntrip' as const,
        host: 'your-ntrip-caster.com',
        port: 2101,
        mountpoint: 'YOUR_MOUNTPOINT',
        username: 'your_username',
        password: 'your_password',
        sendPosition: true,
        position: {
          latitude: 40.7128,   // New York
          longitude: -74.0060,
          altitude: 10.0
        }
      },
      outputFormat: 'mavlink' as const
    };
    
    const response = await client.rtcm.start(customConfig);
    if (response.success) {
      console.log('Custom RTCM configuration started');
      
      // Get current config
      const config = await client.rtcm.getConfig();
      console.log('Current RTCM config:', JSON.stringify(config, null, 2));
      
      // Monitor for a while
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      await client.rtcm.stop();
    }
    
  } catch (error) {
    console.error('Advanced config example failed:', error);
  } finally {
    client.disconnect();
  }
}

// Run the main example
if (require.main === module) {
  main().catch(console.error);
}