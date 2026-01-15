#!/usr/bin/env node

const { MAVLinkBridgeClient } = require('../client/dist/index.js');

async function test() {
  console.log('Testing RTCM client...\n');

  const client = new MAVLinkBridgeClient('http://192.168.86.55', {
    autoConnectWebSocket: false,
  });

  try {
    console.log('1. Testing health endpoint...');
    const health = await client.health.getHealthCheck();
    console.log('✓ Health check successful');
    console.log('RTCM in health:', health.rtcm);

    console.log('\n2. Testing RTCM status endpoint...');
    const rtcmStatus = await client.rtcm.getStatus();
    console.log('✓ RTCM status successful');
    console.log('RTCM status:', rtcmStatus);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
