#!/usr/bin/env node

/**
 * MAVLinkBridge Configuration Management Example
 * 
 * This example demonstrates how to use the TypeScript client library
 * for configuration management operations.
 */

import { MAVLinkBridgeClient } from '../src/MAVLinkBridgeClient';
import { 
  Configuration, 
  ConfigPatchOperation, 
  VersionConflictError,
  ConfigValidationError,
  StorageError 
} from '../src/config/ConfigTypes';

async function main() {
  console.log('MAVLinkBridge Configuration Management Example');
  console.log('==========================================');

  // Initialize client (replace with your ESP32's IP address)
  const client = new MAVLinkBridgeClient({
    baseUrl: 'http://192.168.1.100', // Change this to your ESP32's IP
    timeout: 5000
  });

  try {
    // Example 1: Get current configuration
    await demonstrateConfigRetrieval(client);
    
    // Example 2: Update configuration with optimistic locking
    await demonstrateOptimisticLocking(client);
    
    // Example 3: JSON Patch operations
    await demonstrateJsonPatch(client);
    
    // Example 4: Batch updates
    await demonstrateBatchUpdates(client);
    
    // Example 5: Convenience methods
    await demonstrateConvenienceMethods(client);
    
    // Example 6: Error handling
    await demonstrateErrorHandling(client);
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

async function demonstrateConfigRetrieval(client: MAVLinkBridgeClient) {
  console.log('\n📥 Example 1: Configuration Retrieval');
  console.log('-------------------------------------');
  
  try {
    const config = await client.config.getConfiguration();
    
    console.log('Current configuration:');
    console.log(`  Version: ${config.version}`);
    console.log(`  Device: ${config.device.name} (${config.device.mode})`);
    console.log(`  Connection: ${config.connection.type}`);
    if (config.connection.type === 'wifi') {
      console.log(`    WiFi SSID: ${config.connection.wifi.ssid}`);
      console.log(`    Auto-connect: ${config.connection.wifi.autoConnect}`);
    }
    console.log(`  RTCM: ${config.rtcm.enabled ? 'enabled' : 'disabled'}`);
    if (config.rtcm.enabled) {
      console.log(`    Source: ${config.rtcm.source.type}://${config.rtcm.source.host}:${config.rtcm.source.port}`);
    }
    
  } catch (error) {
    console.error('Failed to retrieve configuration:', error);
    throw error;
  }
}

async function demonstrateOptimisticLocking(client: MAVLinkBridgeClient) {
  console.log('\n🔒 Example 2: Optimistic Locking');
  console.log('--------------------------------');
  
  try {
    // Get configuration with version
    const { config, version } = await client.config.getConfigurationWithVersion();
    console.log(`Current version: ${version}`);
    
    // Update configuration with version check
    const updatedConfig: Configuration = {
      ...config,
      device: {
        ...config.device,
        name: 'OptimisticLockingTest'
      }
    };
    
    await client.config.setConfiguration(updatedConfig, { expectedVersion: version });
    console.log('✅ Configuration updated with optimistic locking');
    
    // Verify the update
    const newConfig = await client.config.getConfiguration();
    console.log(`New device name: ${newConfig.device.name}`);
    console.log(`New version: ${newConfig.version}`);
    
  } catch (error) {
    if (error instanceof VersionConflictError) {
      console.log('⚠️  Version conflict detected - another client modified the configuration');
    } else {
      console.error('Failed to update with optimistic locking:', error);
      throw error;
    }
  }
}

async function demonstrateJsonPatch(client: MAVLinkBridgeClient) {
  console.log('\n🔧 Example 3: JSON Patch Operations');
  console.log('----------------------------------');
  
  try {
    const { version } = await client.config.getConfigurationWithVersion();
    
    const patchOperations: ConfigPatchOperation[] = [
      { op: 'replace', path: '/device/name', value: 'PatchedDevice' },
      { op: 'replace', path: '/device/mode', value: 'uart' },
      { op: 'replace', path: '/rtcm/enabled', value: true },
      { op: 'replace', path: '/rtcm/source/host', value: 'rtcm.patch.example.com' },
      { op: 'replace', path: '/rtcm/source/port', value: 2102 }
    ];
    
    console.log('Applying patch operations:');
    patchOperations.forEach((op, index) => {
      console.log(`  ${index + 1}. ${op.op.toUpperCase()} ${op.path} = ${op.value}`);
    });
    
    await client.config.patchConfiguration(patchOperations, { expectedVersion: version });
    console.log('✅ JSON patch operations applied successfully');
    
    // Verify the changes
    const patchedConfig = await client.config.getConfiguration();
    console.log(`Updated device name: ${patchedConfig.device.name}`);
    console.log(`Updated device mode: ${patchedConfig.device.mode}`);
    console.log(`RTCM enabled: ${patchedConfig.rtcm.enabled}`);
    console.log(`RTCM host: ${patchedConfig.rtcm.source.host}`);
    
  } catch (error) {
    console.error('Failed to apply JSON patch:', error);
    throw error;
  }
}

async function demonstrateBatchUpdates(client: MAVLinkBridgeClient) {
  console.log('\n📦 Example 4: Batch Updates');
  console.log('---------------------------');
  
  try {
    // Create a large batch of operations (more than 10)
    const batchOperations: ConfigPatchOperation[] = [
      { op: 'replace', path: '/device/name', value: 'BatchDevice' },
      { op: 'replace', path: '/connection/wifi/ssid', value: 'BatchNetwork' },
      { op: 'replace', path: '/connection/wifi/autoConnect', value: false },
      { op: 'replace', path: '/rtcm/enabled', value: true },
      { op: 'replace', path: '/rtcm/source/type', value: 'ntrip' },
      { op: 'replace', path: '/rtcm/source/host', value: 'batch.rtcm.com' },
      { op: 'replace', path: '/rtcm/source/port', value: 2103 },
      // Add more operations to test chunking
      { op: 'add', path: '/device/description', value: 'Batch updated device' },
      { op: 'add', path: '/connection/timeout', value: 30000 },
      { op: 'add', path: '/rtcm/retryCount', value: 3 },
      { op: 'add', path: '/rtcm/connectionTimeout', value: 10000 },
      { op: 'add', path: '/system/debugMode', value: false }
    ];
    
    console.log(`Applying batch of ${batchOperations.length} operations:`);
    
    await client.config.batchUpdate(batchOperations);
    console.log('✅ Batch update completed (operations were chunked automatically)');
    
    // Verify some of the changes
    const batchedConfig = await client.config.getConfiguration();
    console.log(`Device name after batch: ${batchedConfig.device.name}`);
    console.log(`WiFi SSID after batch: ${batchedConfig.connection.wifi.ssid}`);
    
  } catch (error) {
    console.error('Failed to apply batch update:', error);
    throw error;
  }
}

async function demonstrateConvenienceMethods(client: MAVLinkBridgeClient) {
  console.log('\n🎯 Example 5: Convenience Methods');
  console.log('---------------------------------');
  
  try {
    // Update device name
    await client.config.updateDeviceName('ConvenienceDevice');
    console.log('✅ Device name updated using convenience method');
    
    // Update device mode
    await client.config.updateDeviceMode('usb_otg');
    console.log('✅ Device mode updated using convenience method');
    
    // Update WiFi settings
    await client.config.updateWiFiSSID('ConvenienceNetwork');
    await client.config.updateWiFiAutoConnect(true);
    console.log('✅ WiFi settings updated using convenience methods');
    
    // Update RTCM settings
    await client.config.updateRTCMEnabled(true);
    await client.config.updateRTCMSource('ntrip', 'convenience.rtcm.com', 2104, {
      mountpoint: 'CONV01',
      username: 'testuser',
      password: 'testpass'
    });
    console.log('✅ RTCM settings updated using convenience methods');
    
    // Verify all changes
    const convenienceConfig = await client.config.getConfiguration();
    console.log('Final configuration after convenience method updates:');
    console.log(`  Device: ${convenienceConfig.device.name} (${convenienceConfig.device.mode})`);
    console.log(`  WiFi: ${convenienceConfig.connection.wifi.ssid} (auto: ${convenienceConfig.connection.wifi.autoConnect})`);
    console.log(`  RTCM: ${convenienceConfig.rtcm.source.host}:${convenienceConfig.rtcm.source.port}`);
    
  } catch (error) {
    console.error('Failed to use convenience methods:', error);
    throw error;
  }
}

async function demonstrateErrorHandling(client: MAVLinkBridgeClient) {
  console.log('\n⚠️  Example 6: Error Handling');
  console.log('-----------------------------');
  
  // Test validation error
  try {
    const invalidConfig: Configuration = {
      version: 1,
      device: {
        name: '', // Invalid: empty name
        mode: 'usb_otg'
      },
      connection: {
        type: 'wifi',
        wifi: {
          ssid: 'TestNetwork',
          autoConnect: true
        }
      },
      rtcm: {
        enabled: false,
        source: {
          type: 'ntrip',
          host: '',
          port: 2101
        }
      }
    };
    
    await client.config.setConfiguration(invalidConfig);
    console.log('❌ Should have failed validation');
    
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.log('✅ Validation error caught correctly:');
      error.errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('❌ Unexpected error type:', error);
    }
  }
  
  // Test retry mechanism with version conflict simulation
  try {
    console.log('\n🔄 Testing automatic retry on version conflict...');
    
    // Use the retry mechanism
    await client.config.updateConfigurationWithRetry((config) => ({
      ...config,
      device: {
        ...config.device,
        name: 'RetryTestDevice'
      }
    }), 3);
    
    console.log('✅ Update with retry completed successfully');
    
  } catch (error) {
    console.log('⚠️  Retry mechanism test result:', error.message);
  }
  
  // Test invalid device name
  try {
    await client.config.updateDeviceName(''); // Invalid
  } catch (error) {
    console.log('✅ Invalid device name rejected:', error.message);
  }
  
  // Test invalid WiFi SSID
  try {
    await client.config.updateWiFiSSID('A'.repeat(40)); // Too long
  } catch (error) {
    console.log('✅ Invalid WiFi SSID rejected:', error.message);
  }
}

// Helper function to demonstrate configuration diffing
async function demonstrateConfigDiff(client: MAVLinkBridgeClient) {
  console.log('\n🔍 Bonus: Configuration Diffing');
  console.log('-------------------------------');
  
  const oldConfig = await client.config.getConfiguration();
  
  const newConfig: Configuration = {
    ...oldConfig,
    device: {
      ...oldConfig.device,
      name: 'DiffTestDevice',
      mode: 'uart'
    },
    rtcm: {
      ...oldConfig.rtcm,
      enabled: !oldConfig.rtcm.enabled
    }
  };
  
  const patches = client.config.createConfigurationPatch(oldConfig, newConfig);
  
  console.log('Configuration differences:');
  patches.forEach((patch, index) => {
    console.log(`  ${index + 1}. ${patch.op.toUpperCase()} ${patch.path} = ${patch.value}`);
  });
  
  if (patches.length > 0) {
    await client.config.patchConfiguration(patches);
    console.log('✅ Patch applied based on configuration diff');
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runConfigExample };