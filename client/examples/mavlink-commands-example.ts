#!/usr/bin/env ts-node

/**
 * MAVLink Commands Example
 * 
 * This example demonstrates how to send MAVLink commands to a flight controller
 * through the MAVLinkBridge ESP32 device.
 */

import { MAVLinkBridgeClient, ArduPilotMode, MAVCommand } from '../src/index';

const DEVICE_URL = process.env.DEVICE_URL || 'http://192.168.4.1';

async function main() {
  console.log('🚁 MAVLink Commands Example');
  console.log('=============================\n');

  // Create client instance
  const client = new MAVLinkBridgeClient(DEVICE_URL);

  try {
    // Connect to the device
    console.log('📡 Connecting to MAVLinkBridge device...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check device health
    const health = await client.getHealth();
    console.log(`📊 Device Status: ${health.status}`);
    console.log(`🔋 Free Heap: ${health.freeHeap} bytes\n`);

    // Get communication status to check if FC is connected
    const commStatus = await client.communication.getStatus();
    console.log(`🔗 Active Interface: ${commStatus.activeInterface}`);
    console.log(`📈 Upstream Rate: ${commStatus.upstreamRate.toFixed(2)} bytes/s`);
    console.log(`📉 Downstream Rate: ${commStatus.downstreamRate.toFixed(2)} bytes/s\n`);

    console.log('🎮 Sending MAVLink Commands:');
    console.log('==========================\n');

    // Example 1: Basic arm/disarm commands
    console.log('1️⃣ Testing ARM/DISARM commands...');
    
    try {
      const armResult = await client.mavlink.arm();
      console.log('✅ ARM command sent:', armResult);
      
      // Wait a bit before disarming
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const disarmResult = await client.mavlink.disarm();
      console.log('✅ DISARM command sent:', disarmResult);
    } catch (error) {
      console.log('❌ ARM/DISARM error:', error);
    }

    console.log('\n2️⃣ Testing mode changes...');
    
    try {
      // Set to Stabilize mode
      const stabilizeResult = await client.mavlink.setMode(ArduPilotMode.STABILIZE);
      console.log('✅ STABILIZE mode command sent:', stabilizeResult);
      
      // Set to Guided mode
      const guidedResult = await client.mavlink.setMode(ArduPilotMode.GUIDED);
      console.log('✅ GUIDED mode command sent:', guidedResult);
      
      // Set to RTL mode
      const rtlResult = await client.mavlink.setMode(ArduPilotMode.RTL);
      console.log('✅ RTL mode command sent:', rtlResult);
    } catch (error) {
      console.log('❌ Mode change error:', error);
    }

    console.log('\n3️⃣ Testing convenience methods...');
    
    try {
      // Return to Launch
      const rtlResult = await client.mavlink.returnToLaunch();
      console.log('✅ Return to Launch command sent:', rtlResult);
      
      // Land
      const landResult = await client.mavlink.land();
      console.log('✅ Land command sent:', landResult);
      
      // Set home position to current location
      const homeResult = await client.mavlink.setHomeHere();
      console.log('✅ Set home here command sent:', homeResult);
    } catch (error) {
      console.log('❌ Convenience method error:', error);
    }

    console.log('\n4️⃣ Testing generic command_long...');
    
    try {
      // Request autopilot capabilities
      const capResult = await client.mavlink.sendCommandLong({
        command: MAVCommand.REQUEST_AUTOPILOT_CAPABILITIES,
        param1: 1
      });
      console.log('✅ Request capabilities command sent:', capResult);
      
      // Preflight calibration (gyro)
      const calibResult = await client.mavlink.sendCommandLong({
        command: MAVCommand.PREFLIGHT_CALIBRATION,
        param1: 1, // Gyro calibration
        param2: 0,
        param3: 0,
        param4: 0,
        param5: 0,
        param6: 0,
        param7: 0
      });
      console.log('✅ Gyro calibration command sent:', calibResult);
    } catch (error) {
      console.log('❌ Command long error:', error);
    }

    console.log('\n5️⃣ Testing position target command...');
    
    try {
      // Set position target in local NED coordinates
      const posResult = await client.mavlink.setPositionTarget({
        x: 10.0,   // 10 meters north
        y: 5.0,    // 5 meters east
        z: -20.0,  // 20 meters down (negative in NED)
        yaw: 1.57  // 90 degrees in radians
      });
      console.log('✅ Position target command sent:', posResult);
    } catch (error) {
      console.log('❌ Position target error:', error);
    }

    console.log('\n6️⃣ Testing command_int...');
    
    try {
      // Navigate to waypoint using command_int
      const waypointResult = await client.mavlink.sendCommandInt({
        command: 16, // MAV_CMD_NAV_WAYPOINT
        frame: 3,    // MAV_FRAME_GLOBAL_RELATIVE_ALT
        current: 0,
        autocontinue: 1,
        param1: 0,   // Hold time
        param2: 2,   // Acceptance radius
        param3: 0,   // Pass radius
        param4: 0,   // Yaw
        x: -35.36326100,  // Latitude (scaled by 1e7)
        y: 149.16523400,  // Longitude (scaled by 1e7) 
        z: 100.0     // Altitude
      });
      console.log('✅ Navigate to waypoint command sent:', waypointResult);
    } catch (error) {
      console.log('❌ Command int error:', error);
    }

    console.log('\n🎉 All MAVLink commands tested successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Disconnect
    console.log('\n📡 Disconnecting from device...');
    client.disconnect();
    console.log('✅ Disconnected');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

export { main };