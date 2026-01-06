/**
 * Test script for MAVLink decoder
 * Run with: npx tsx client/test-decoder.ts
 */

import { MAVLinkDecoder, MAVLinkMessageType } from './src/mavlink';

// Test HEARTBEAT message
function testHeartbeat() {
  console.log('\n=== Testing HEARTBEAT Message ===');

  // Create a sample HEARTBEAT payload
  // heartbeat: custom_mode(4), type(1), autopilot(1), base_mode(1), system_status(1), mavlink_version(1)
  const heartbeatBytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x00,  // custom_mode (uint32) = 0
    0x02,                      // type (uint8) = MAV_TYPE_QUADROTOR
    0x03,                      // autopilot (uint8) = MAV_AUTOPILOT_ARDUPILOTMEGA
    0x81,                      // base_mode (uint8) = STABILIZE + ARMED
    0x03,                      // system_status (uint8) = MAV_STATE_STANDBY
    0x03                       // mavlink_version (uint8) = 3
  ]);

  // Encode to base64
  const base64 = Buffer.from(heartbeatBytes).toString('base64');
  console.log('Base64:', base64);

  // Decode
  const decoder = new MAVLinkDecoder();
  const decoded = decoder.decode(MAVLinkMessageType.HEARTBEAT, 1, 1, base64);

  console.log('Decoded:', JSON.stringify(decoded, null, 2));

  if (decoded && decoded.data) {
    const data = decoded.data as any;
    console.log('✓ Custom Mode:', data.customMode);
    console.log('✓ Type:', data.type);
    console.log('✓ Autopilot:', data.autopilot);
    console.log('✓ Base Mode:', data.baseMode);
    console.log('✓ System Status:', data.systemStatus);
    console.log('✓ MAVLink Version:', data.mavlinkVersion);
  }
}

// Test ATTITUDE message
function testAttitude() {
  console.log('\n=== Testing ATTITUDE Message ===');

  // Create a sample ATTITUDE payload
  // attitude: time_boot_ms(4), roll(4), pitch(4), yaw(4), rollspeed(4), pitchspeed(4), yawspeed(4)
  const buffer = new ArrayBuffer(28);
  const view = new DataView(buffer);

  view.setUint32(0, 12345, true);      // time_boot_ms
  view.setFloat32(4, 0.05, true);      // roll (rad)
  view.setFloat32(8, -0.02, true);     // pitch (rad)
  view.setFloat32(12, 1.57, true);     // yaw (rad)
  view.setFloat32(16, 0.01, true);     // rollspeed (rad/s)
  view.setFloat32(20, 0.0, true);      // pitchspeed (rad/s)
  view.setFloat32(24, 0.0, true);      // yawspeed (rad/s)

  const attitudeBytes = new Uint8Array(buffer);
  const base64 = Buffer.from(attitudeBytes).toString('base64');
  console.log('Base64:', base64);

  // Decode
  const decoder = new MAVLinkDecoder();
  const decoded = decoder.decode(MAVLinkMessageType.ATTITUDE, 1, 1, base64);

  console.log('Decoded:', JSON.stringify(decoded, null, 2));

  if (decoded && decoded.data) {
    const data = decoded.data as any;
    console.log('✓ Time Boot Ms:', data.timeBootMs);
    console.log('✓ Roll:', data.roll.toFixed(3), 'rad');
    console.log('✓ Pitch:', data.pitch.toFixed(3), 'rad');
    console.log('✓ Yaw:', data.yaw.toFixed(2), 'rad');
    console.log('✓ Rollspeed:', data.rollspeed.toFixed(3), 'rad/s');
  }
}

// Test GPS_RAW_INT message
function testGpsRawInt() {
  console.log('\n=== Testing GPS_RAW_INT Message ===');

  // Create a sample GPS_RAW_INT payload
  const buffer = new ArrayBuffer(30);
  const view = new DataView(buffer);

  view.setBigUint64(0, BigInt(123456789), true);  // time_usec
  view.setUint8(8, 3);                            // fix_type (3D fix)
  view.setInt32(9, 374123456, true);              // lat (deg * 1e7)
  view.setInt32(13, -1221234567, true);           // lon (deg * 1e7)
  view.setInt32(17, 123000, true);                // alt (mm above MSL)
  view.setUint16(21, 200, true);                  // eph (HDOP * 100)
  view.setUint16(23, 300, true);                  // epv (VDOP * 100)
  view.setUint16(25, 150, true);                  // vel (cm/s)
  view.setUint16(27, 18000, true);                // cog (deg * 100)
  view.setUint8(29, 12);                          // satellites_visible

  const gpsBytes = new Uint8Array(buffer);
  const base64 = Buffer.from(gpsBytes).toString('base64');
  console.log('Base64:', base64);

  // Decode
  const decoder = new MAVLinkDecoder();
  const decoded = decoder.decode(MAVLinkMessageType.GPS_RAW_INT, 1, 1, base64);

  console.log('Decoded:', JSON.stringify(decoded, null, 2));

  if (decoded && decoded.data) {
    const data = decoded.data as any;
    console.log('✓ Fix Type:', data.fixType);
    console.log('✓ Latitude:', (data.lat / 1e7).toFixed(6), 'deg');
    console.log('✓ Longitude:', (data.lon / 1e7).toFixed(6), 'deg');
    console.log('✓ Altitude:', (data.alt / 1000).toFixed(1), 'm');
    console.log('✓ Satellites:', data.satellitesVisible);
  }
}

// Run all tests
console.log('MAVLink Decoder Test Suite');
console.log('==========================');

try {
  testHeartbeat();
  testAttitude();
  testGpsRawInt();

  console.log('\n✅ All tests completed successfully!\n');
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
