# MAVLink Bridge Device Discovery

Cross-platform device discovery library for MAVLink Bridge devices using only the existing `/api/health` endpoint. Works in both browser and Node.js environments without requiring additional REST API endpoints on the device.

## Features

- **Cross-platform**: Works in browsers and Node.js
- **Zero device changes**: Uses existing health endpoint
- **Configurable subnet scanning**: CIDR notation support
- **Auto network detection**: Node.js automatically detects local networks
- **mDNS hostname resolution**: Resolves `.local` hostnames
- **AP mode discovery**: Finds unprovisioned devices
- **Real-time monitoring**: Continuous discovery with callbacks
- **Concurrent scanning**: Fast parallel network scanning

## Installation

```bash
npm install @yardrover/discovery
```

## Quick Start

### Basic Discovery

```typescript
import { discoverMAVLinkBridgeDevices } from '@yardrover/discovery';

// Discover all devices on auto-detected networks
const result = await discoverMAVLinkBridgeDevices();
console.log(`Found ${result.devices.length} devices in ${result.duration}ms`);

// Discover devices on specific subnets
const devices = await discoverMAVLinkBridgeDevices({
  subnets: ['192.168.1.0/24', '10.0.0.0/24'],
  timeout: 5000,
  concurrent: 20
});
```

### Convenience Functions

```typescript
import { findMAVLinkBridgeDevices, findUnprovisionedDevices, findProvisionedDevices } from '@yardrover/discovery';

// Quick discovery with defaults
const allDevices = await findMAVLinkBridgeDevices(['192.168.1.0/24']);

// Find unprovisioned devices (AP mode)
const unprovisionedDevices = await findUnprovisionedDevices();

// Find provisioned devices on network
const provisionedDevices = await findProvisionedDevices();
```

### Real-time Discovery

```typescript
import { startContinuousDiscovery } from '@yardrover/discovery';

const stopDiscovery = startContinuousDiscovery(
  (device) => {
    console.log('Device found:', device.name, device.ip);
  },
  (deviceId) => {
    console.log('Device lost:', deviceId);
  },
  {
    interval: 30000, // 30 seconds
    subnets: ['192.168.1.0/24']
  }
);

// Stop discovery when done
stopDiscovery();
```

## API Reference

### Discovery Options

```typescript
interface DiscoveryOptions {
  /** Subnets to scan in CIDR notation (e.g., '192.168.1.0/24') */
  subnets?: string[];
  /** HTTP ports to check */
  ports?: number[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum concurrent requests */
  concurrent?: number;
  /** Known hostnames to try first */
  knownHostnames?: string[];
  /** AP mode IPs to check for unprovisioned devices */
  apModeIPs?: string[];
}
```

### Device Information

```typescript
interface MAVLinkBridgeDevice {
  /** Unique device identifier (MAC address) */
  id: string;
  /** Device name from configuration */
  name: string;
  /** Device hostname */
  hostname: string;
  /** Device IP address */
  ip: string;
  /** Device health status */
  status: 'healthy' | 'degraded';
  /** Whether device has been provisioned */
  isProvisioned: boolean;
  /** Device capabilities */
  capabilities: {
    chipModel: string;
    chipRevision: number;
    flashSize: number;
    sdkVersion: string;
    coreCount: number;
  };
  /** Network information */
  network: {
    macAddress: string;
    apMacAddress: string;
    wifi: {
      status: string;
      ssid?: string;
      rssi?: number;
    };
    ap: {
      enabled: boolean;
      clients?: number;
    };
  };
  /** Last discovery timestamp */
  lastSeen: number;
}
```

## Examples

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Device Discovery</title>
</head>
<body>
    <button id="discover">Discover Devices</button>
    <div id="devices"></div>

    <script type="module">
        import { discoverMAVLinkBridgeDevices } from './discovery/index.js';
        
        document.getElementById('discover').addEventListener('click', async () => {
            const result = await discoverMAVLinkBridgeDevices({
                subnets: ['192.168.1.0/24'],
                timeout: 3000
            });
            
            const deviceList = result.devices.map(device => 
                `<p>${device.name} (${device.ip}) - ${device.status}</p>`
            ).join('');
            
            document.getElementById('devices').innerHTML = deviceList;
        });
    </script>
</body>
</html>
```

### Node.js Usage

```typescript
import { discoverMAVLinkBridgeDevices } from '@yardrover/discovery';

async function main() {
  console.log('Discovering MAVLink Bridge devices...');
  
  const result = await discoverMAVLinkBridgeDevices({
    // Auto-detect local networks in Node.js
    timeout: 5000,
    concurrent: 30
  });
  
  console.log(`Discovery completed in ${result.duration}ms`);
  console.log(`Scanned ${result.hostsScanned} hosts`);
  console.log(`Found ${result.devices.length} devices:`);
  
  result.devices.forEach(device => {
    console.log(`  ${device.name} (${device.ip})`);
    console.log(`    MAC: ${device.id}`);
    console.log(`    Status: ${device.status}`);
    console.log(`    Provisioned: ${device.isProvisioned}`);
    console.log(`    Chip: ${device.capabilities.chipModel}`);
    if (device.network.wifi.ssid) {
      console.log(`    WiFi: ${device.network.wifi.ssid} (${device.network.wifi.rssi}dBm)`);
    }
    console.log('');
  });
}

main().catch(console.error);
```

### Advanced Configuration

```typescript
import { discoverMAVLinkBridgeDevices } from '@yardrover/discovery';

const result = await discoverMAVLinkBridgeDevices({
  // Multiple subnets
  subnets: [
    '192.168.1.0/24',
    '192.168.0.0/24',
    '10.0.0.0/24'
  ],
  
  // Multiple ports
  ports: [80, 8080, 3000],
  
  // Custom hostnames
  knownHostnames: [
    'mavlinkbridge.local',
    'yardrover.local',
    'my-device.local'
  ],
  
  // AP mode IPs
  apModeIPs: ['192.168.4.1', '192.168.1.1'],
  
  // Performance tuning
  timeout: 3000,
  concurrent: 50
});
```

## Platform Differences

### Browser Environment
- Uses `fetch()` API for HTTP requests
- No automatic network interface detection
- Must specify subnets manually
- CORS support required on device (already enabled)

### Node.js Environment
- Automatic network interface detection
- mDNS hostname resolution support
- Enhanced error handling and retry logic
- Uses native HTTP modules or fetch (Node.js 18+)

## Error Handling

The discovery library handles errors gracefully:

- Network timeouts are silently ignored (expected for most IPs)
- Invalid subnets log warnings but don't stop discovery
- Failed hostname resolutions fall back to direct connection attempts
- Malformed health responses are filtered out

## Performance

- **Concurrent scanning**: Default 20 concurrent requests (configurable)
- **Smart timeouts**: 5-second default timeout per request
- **Efficient deduplication**: Uses MAC address as unique identifier
- **Memory efficient**: Streams results, doesn't store all responses

## Device Provisioning Workflow

Once you've discovered unprovisioned devices, you can configure them using the existing REST API:

### 1. Find Unprovisioned Devices

```typescript
import { findUnprovisionedDevices } from '@yardrover/discovery';

const unprovisionedDevices = await findUnprovisionedDevices();
console.log(`Found ${unprovisionedDevices.length} devices in setup mode`);
```

### 2. Configure WiFi Credentials

```typescript
// Configure device with WiFi credentials
const deviceIP = unprovisionedDevices[0].ip; // e.g., "192.168.4.1"

const wifiConfig = {
  ssid: "YourNetworkName",
  password: "YourNetworkPassword"
};

const response = await fetch(`http://${deviceIP}/api/wifi/connect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(wifiConfig)
});

if (response.ok) {
  console.log('WiFi configuration sent successfully');
} else {
  console.error('Failed to configure WiFi');
}
```

### 3. Monitor Provisioning Status

```typescript
// Wait for device to connect and become provisioned
const checkProvisioning = async () => {
  const devices = await discoverMAVLinkBridgeDevices();
  const provisionedDevice = devices.find(d => 
    d.id === unprovisionedDevices[0].id && d.isProvisioned
  );
  
  if (provisionedDevice) {
    console.log(`Device provisioned! New IP: ${provisionedDevice.ip}`);
    return provisionedDevice;
  }
  
  // Wait and check again
  setTimeout(checkProvisioning, 5000);
};

checkProvisioning();
```

### 4. Complete Configuration

```typescript
// Once provisioned, configure device settings
const deviceConfig = {
  device: {
    name: "My MAVLink Bridge",
    mode: "usb_otg"
  }
};

await fetch(`http://${provisionedDevice.ip}/api/config`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(deviceConfig)
});
```

## Security

- Only uses existing device endpoints
- No authentication required for discovery
- Read-only health endpoint access
- CORS-compliant for browser usage