import { MAVLinkBridgeClient, WiFiState, WiFiStatus } from '../src';

/**
 * Example demonstrating WiFi management with the MAVLinkBridge client
 */
async function wifiManagementExample() {
  console.log('=== MAVLinkBridge WiFi Management Example ===\n');

  // Create client instance
  const client = new MAVLinkBridgeClient('http://192.168.4.1');

  try {
    // Connect to the device
    console.log('Connecting to device...');
    await client.connect();
    console.log('✓ Connected to device\n');

    // Example 1: Get current WiFi status
    console.log('1. Getting WiFi status...');
    const status = await client.getWiFiStatus();
    console.log(`   State: ${status.state}`);
    console.log(`   Connected: ${status.connected}`);
    if (status.connected && status.ssid) {
      console.log(`   Network: ${status.ssid}`);
      console.log(`   IP: ${status.ip}`);
      console.log(`   Signal: ${status.rssi} dBm (${status.quality}%)`);
    }
    console.log();

    // Example 2: Scan for available networks
    console.log('2. Scanning for WiFi networks...');
    const networks = await client.scanWiFiNetworks(true); // Force new scan
    console.log(`   Found ${networks.length} networks:`);
    networks.slice(0, 5).forEach(network => {
      const security = network.secure ? '🔒' : '📶';
      console.log(`   ${security} ${network.ssid} (${network.rssi} dBm, ${network.quality}%)`);
    });
    console.log();

    // Example 3: Get saved networks
    console.log('3. Getting saved networks...');
    const savedNetworks = await client.getSavedWiFiNetworks();
    console.log(`   Saved networks: ${savedNetworks.length}`);
    savedNetworks.forEach(network => {
      console.log(`   - ${network.ssid} (priority: ${network.priority})`);
    });
    console.log();

    // Example 4: Add a new saved network (if not already connected)
    if (status.state !== WiFiState.CONNECTED) {
      console.log('4. Adding a saved network...');
      try {
        await client.addSavedWiFiNetwork('MyHomeWiFi', 'mypassword', 1);
        console.log('   ✓ Network saved successfully');
      } catch (error) {
        console.log(`   ⚠ Failed to save network: ${error.message}`);
      }
      console.log();
    }

    // Example 5: Set up event listeners for real-time WiFi updates
    console.log('5. Setting up real-time WiFi monitoring...');
    
    // Listen for WiFi state changes
    const unsubscribeState = client.onWiFiStateChange((state) => {
      console.log(`   📡 WiFi state changed: ${state}`);
    });

    // Listen for signal quality updates
    const unsubscribeSignal = client.wifi.onSignalUpdate((quality) => {
      console.log(`   📶 Signal update: ${quality.rssi} dBm (${quality.quality}%)`);
    });

    // Listen for connection events
    const unsubscribeConnection = client.wifi.onConnectionChange((status) => {
      if (status.connected) {
        console.log(`   ✓ Connected to ${status.ssid} (${status.ip})`);
      } else {
        console.log(`   ✗ Disconnected from WiFi`);
      }
    });

    console.log('   ✓ Event listeners registered');
    console.log('   Monitoring WiFi events for 30 seconds...\n');

    // Example 6: Connect to a specific network (demo only - use with caution)
    /*
    if (status.state === WiFiState.DISCONNECTED && networks.length > 0) {
      console.log('6. Attempting to connect to a network...');
      const targetNetwork = networks.find(n => n.ssid === 'YourNetworkName');
      if (targetNetwork) {
        try {
          await client.connectToWiFi({
            ssid: targetNetwork.ssid,
            password: 'your-password',
            save: true,
            priority: 1
          });
          console.log(`   ✓ Connection initiated to ${targetNetwork.ssid}`);
        } catch (error) {
          console.log(`   ⚠ Connection failed: ${error.message}`);
        }
      }
      console.log();
    }
    */

    // Example 7: Monitor WiFi for a period
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Clean up event listeners
    unsubscribeState();
    unsubscribeSignal();
    unsubscribeConnection();

    console.log('7. WiFi monitoring complete\n');

    // Example 8: Advanced WiFi client usage
    console.log('8. Advanced WiFi client features...');
    
    // Get direct access to WiFi client for advanced operations
    const wifiClient = client.wifi;
    
    // Scan with specific options
    const quickScan = await wifiClient.scan({ force: false }); // Use cached if available
    console.log(`   Quick scan found ${quickScan.length} networks (cached)`);
    
    // Get detailed status
    const detailedStatus = await wifiClient.getStatus();
    console.log(`   Detailed status: ${JSON.stringify(detailedStatus, null, 2)}`);
    
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Always disconnect when done
    client.disconnect();
    console.log('✓ Disconnected from device');
  }
}

/**
 * Example of handling WiFi events in a reactive way
 */
async function reactiveWiFiExample() {
  console.log('\n=== Reactive WiFi Management Example ===\n');

  const client = new MAVLinkBridgeClient('http://192.168.4.1');

  try {
    await client.connect();
    console.log('✓ Connected to device');

    // Create a reactive WiFi state manager
    class WiFiStateManager {
      private currentState: WiFiState = WiFiState.DISCONNECTED;
      private currentStatus: WiFiStatus | null = null;

      constructor(private client: MAVLinkBridgeClient) {
        this.setupEventListeners();
      }

      private setupEventListeners() {
        // State changes
        this.client.onWiFiStateChange((state) => {
          this.handleStateChange(state);
        });

        // Signal updates
        this.client.wifi.onSignalUpdate((quality) => {
          this.handleSignalUpdate(quality);
        });

        // Connection changes
        this.client.wifi.onConnectionChange((status) => {
          this.currentStatus = status;
          this.handleConnectionChange(status);
        });
      }

      private handleStateChange(newState: WiFiState) {
        const oldState = this.currentState;
        this.currentState = newState;
        
        console.log(`🔄 State transition: ${oldState} → ${newState}`);
        
        switch (newState) {
          case WiFiState.CONNECTING:
            console.log('   ⏳ Connection in progress...');
            break;
          case WiFiState.CONNECTED:
            console.log('   ✅ Successfully connected!');
            break;
          case WiFiState.DISCONNECTED:
            console.log('   ❌ Disconnected');
            break;
          case WiFiState.AP_MODE:
            console.log('   📡 Access Point mode active');
            break;
          case WiFiState.ERROR:
            console.log('   ⚠️ WiFi error state');
            break;
        }
      }

      private handleSignalUpdate(quality: any) {
        if (this.currentState === WiFiState.CONNECTED) {
          const bars = '█'.repeat(Math.ceil(quality.quality / 25));
          const spaces = '░'.repeat(4 - Math.ceil(quality.quality / 25));
          console.log(`📶 Signal: ${bars}${spaces} ${quality.quality}% (${quality.rssi} dBm)`);
        }
      }

      private handleConnectionChange(status: WiFiStatus) {
        if (status.connected && status.ssid) {
          console.log(`🌐 Connected to "${status.ssid}" (${status.ip})`);
        } else if (status.apMode) {
          console.log(`🏠 Access Point "${status.apSSID}" active (${status.apIP})`);
        }
      }

      getCurrentState() {
        return this.currentState;
      }

      getCurrentStatus() {
        return this.currentStatus;
      }
    }

    // Initialize the reactive state manager
    const stateManager = new WiFiStateManager(client);
    
    // Get initial state
    const initialStatus = await client.getWiFiStatus();
    console.log(`Initial WiFi state: ${initialStatus.state}\n`);

    // Monitor for changes
    console.log('Monitoring WiFi events (press Ctrl+C to stop)...\n');
    
    // Keep the example running
    await new Promise(resolve => {
      // In a real application, this would run until the application exits
      setTimeout(resolve, 60000); // Run for 1 minute
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.disconnect();
    console.log('\n✓ Disconnected from device');
  }
}

// Run the examples
if (require.main === module) {
  async function main() {
    try {
      await wifiManagementExample();
      await reactiveWiFiExample();
    } catch (error) {
      console.error('Example failed:', error);
      process.exit(1);
    }
  }

  main();
}

export { wifiManagementExample, reactiveWiFiExample };