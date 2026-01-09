/**
 * Browser-compatible MAVLink Bridge device discovery
 * Uses fetch API for HTTP requests - works in all modern browsers
 */

import {
  DiscoveryOptions,
  DiscoveryResult,
  MAVLinkBridgeDevice,
  HealthResponse
} from './types';
import {
  parseCIDR,
  generateTestUrls,
  withTimeout,
  limitConcurrency,
  deduplicateDevices,
  isValidIP
} from './utils';

const DEFAULT_OPTIONS: Required<DiscoveryOptions> = {
  subnets: [],
  ports: [80, 8080, 8000, 3000, 3030, 5000],
  timeout: 5000,
  concurrent: 20,
  knownHostnames: [
    'localhost',
    '127.0.0.1',
    'mavlinkbridge.local',
    'esp32-mavlinkbridge.local',
    'yardrover.local',
    'yardrover-esp32.local',
    'yardrover-pi.local',
    'yardrover-dev.local'
  ],
  apModeIPs: ['192.168.4.1']
};

/**
 * Discover MAVLink Bridge devices on the network
 * Browser-compatible version using fetch API
 */
export async function discoverMAVLinkBridgeDevices (
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Generate all candidate hosts to test
  const candidates = await generateCandidates(config);

  // Test all candidates concurrently
  const devices = await testCandidates(candidates, config);

  // Deduplicate by MAC address
  const uniqueDevices = deduplicateDevices(devices);

  return {
    devices: uniqueDevices,
    duration: Date.now() - startTime,
    hostsScanned: candidates.length,
    successfulResponses: devices.length
  };
}

/**
 * Generate all candidate hosts to test
 */
async function generateCandidates (config: Required<DiscoveryOptions>): Promise<string[]> {
  const candidates = new Set<string>();

  // Add known hostnames (highest priority)
  config.knownHostnames.forEach(hostname => candidates.add(hostname));

  // Add AP mode IPs (unprovisioned devices)
  config.apModeIPs.forEach(ip => candidates.add(ip));

  // Add IPs from specified subnets
  for (const subnet of config.subnets) {
    try {
      const ips = parseCIDR(subnet);
      ips.forEach(ip => candidates.add(ip));
    } catch (error) {
      console.warn(`Invalid subnet ${subnet}:`, error);
    }
  }

  return Array.from(candidates);
}

/**
 * Test candidate hosts for MAVLink Bridge devices
 */
async function testCandidates (
  candidates: string[],
  config: Required<DiscoveryOptions>
): Promise<MAVLinkBridgeDevice[]> {
  const devices: MAVLinkBridgeDevice[] = [];

  // Generate all URLs to test
  const urlsToTest: Array<{ url: string; host: string }> = [];
  for (const host of candidates) {
    const urls = generateTestUrls(host, config.ports);
    urls.forEach(url => urlsToTest.push({ url, host }));
  }

  // Test URLs with concurrency limit
  const results = await limitConcurrency(
    urlsToTest,
    async ({ url, host }) => {
      try {
        const device = await testSingleHost(url, host, config.timeout);
        if (device) {
          devices.push(device);
        }
        return device;
      } catch (error) {
        // Silently ignore failed requests - expected for most IPs
        return null;
      }
    },
    config.concurrent
  );

  return devices;
}

/**
 * Test a single host for MAVLink Bridge device
 */
async function testSingleHost (
  url: string,
  host: string,
  timeout: number
): Promise<MAVLinkBridgeDevice | null> {
  try {
    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      }),
      timeout
    );

    if (!response.ok) {
      return null;
    }

    const healthData: HealthResponse = await response.json();

    // Validate that this is actually a MAVLink Bridge device
    if (!isMAVLinkBridgeDevice(healthData)) {
      return null;
    }

    // Extract port from URL
    const urlObj = new URL(url);
    const port = parseInt(urlObj.port || '80', 10);

    // Extract IP from health data, but prioritize the host we actually connected to
    // This handles cases where the device is in AP mode and wifi.ip is not set or is 0.0.0.0
    let deviceIP = host;

    // Only use the reported WiFi IP if it's valid and the device is connected to WiFi
    if (healthData.network?.wifi?.ip &&
      healthData.network.wifi.ip !== '0.0.0.0' &&
      healthData.network.wifi.status === 'connected') {
      deviceIP = healthData.network.wifi.ip;
    }

    // Handle Python backend (snake_case) vs ESP32 (camelCase) field names
    const macAddress = healthData.network.macAddress || (healthData.network as any).mac_address;
    const apMacAddress = healthData.network.apMacAddress || (healthData.network as any).ap_mac_address;
    const ipAddress = (healthData.network as any).ipAddress || (healthData.network as any).ip_address || deviceIP;
    const wifiStatus = healthData.network?.wifi?.status || ((healthData.network as any)?.connected ? 'connected' : 'disconnected');

    return {
      id: macAddress,
      name: healthData.device.name,
      hostname: healthData.device.hostname,
      ip: ipAddress,
      port: port,
      status: healthData.status,
      isProvisioned: wifiStatus === 'connected' || (healthData.network as any)?.connected === true,
      capabilities: {
        chipModel: healthData.device.chipModel || (healthData.device as any).chip_model || 'Unknown',
        chipRevision: healthData.device.chipRevision || (healthData.device as any).chip_revision || 0,
        flashSize: healthData.device.flashSize || (healthData.device as any).flash_size || 0,
        sdkVersion: healthData.device.sdkVersion || (healthData.device as any).sdk_version || 'Unknown',
        coreCount: healthData.device.coreCount || (healthData.device as any).core_count || 1
      },
      network: {
        macAddress: macAddress,
        apMacAddress: apMacAddress || '',
        wifi: {
          status: wifiStatus,
          ...(healthData.network.wifi?.ssid && { ssid: healthData.network.wifi.ssid }),
          ...(healthData.network.wifi?.rssi !== undefined && { rssi: healthData.network.wifi.rssi }),
          ...((healthData.network as any).ssid && { ssid: (healthData.network as any).ssid }),
          ...((healthData.network as any).rssi !== undefined && { rssi: (healthData.network as any).rssi })
        },
        ap: {
          enabled: healthData.network.ap?.enabled ?? false,
          ...(healthData.network.ap?.clients !== undefined && { clients: healthData.network.ap.clients })
        }
      },
      lastSeen: Date.now()
    };

  } catch (error) {
    return null;
  }
}

/**
 * Check if health response indicates a MAVLink Bridge device
 */
function isMAVLinkBridgeDevice (health: HealthResponse | any): boolean {
  // Check device name patterns
  const deviceName = health.device?.name?.toLowerCase() || '';
  const hostname = health.device?.hostname?.toLowerCase() || '';

  const mavlinkPatterns = [
    'mavlink',
    'bridge',
    'yardrover',
    'esp32-mavlinkbridge'
  ];

  const matchesPattern = mavlinkPatterns.some(pattern =>
    deviceName.includes(pattern) || hostname.includes(pattern)
  );

  // Check for ESP32 device (has network.macAddress)
  const isESP32Device = !!health.device?.chipModel && !!health.network?.macAddress;

  // Check for Python backend (has network.mac_address or network.macAddress)
  const isPythonBackend = !!health.device?.hostname &&
    (!!health.network?.mac_address || !!health.network?.macAddress);

  return matchesPattern && (isESP32Device || isPythonBackend);
}

/**
 * Continuous discovery with callback for real-time updates
 */
export function startContinuousDiscovery (
  onDeviceFound: (device: MAVLinkBridgeDevice) => void,
  onDeviceLost: (deviceId: string) => void,
  options: DiscoveryOptions & { interval?: number } = {}
): () => void {
  const interval = options.interval || 30000; // 30 seconds
  const knownDevices = new Map<string, MAVLinkBridgeDevice>();
  let isRunning = true;

  const discovery = async () => {
    if (!isRunning) return;

    try {
      const result = await discoverMAVLinkBridgeDevices(options);
      const now = Date.now();
      const currentDeviceIds = new Set<string>();

      // Process discovered devices
      for (const device of result.devices) {
        currentDeviceIds.add(device.id);
        const existing = knownDevices.get(device.id);

        if (!existing) {
          // New device found
          knownDevices.set(device.id, device);
          onDeviceFound(device);
        } else {
          // Update existing device
          knownDevices.set(device.id, device);
        }
      }

      // Check for lost devices (not seen for 2 intervals)
      const lostThreshold = now - (interval * 2);
      for (const [deviceId, device] of knownDevices.entries()) {
        if (!currentDeviceIds.has(deviceId) && device.lastSeen < lostThreshold) {
          knownDevices.delete(deviceId);
          onDeviceLost(deviceId);
        }
      }

    } catch (error) {
      console.error('Discovery error:', error);
    }

    // Schedule next discovery
    setTimeout(discovery, interval);
  };

  // Start initial discovery
  discovery();

  // Return stop function
  return () => {
    isRunning = false;
  };
}