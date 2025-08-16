/**
 * Node.js-specific MAVLink Bridge device discovery
 * Enhanced with mDNS resolution and network interface detection
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

// Node.js imports (conditional for browser compatibility)
let os: typeof import('os') | undefined;
let dns: typeof import('dns') | undefined;
let https: typeof import('https') | undefined;
let http: typeof import('http') | undefined;

try {
  os = require('os');
  dns = require('dns');
  https = require('https');
  http = require('http');
} catch (error) {
  // Running in browser environment
}

const DEFAULT_OPTIONS: Required<DiscoveryOptions> = {
  subnets: [],
  ports: [80, 8080],
  timeout: 5000,
  concurrent: 20,
  knownHostnames: [
    'mavlinkbridge.local',
    'esp32-mavlinkbridge.local',
    'yardrover.local',
    'yardrover-esp32.local'
  ],
  apModeIPs: ['192.168.4.1']
};

/**
 * Discover MAVLink Bridge devices on the network
 * Node.js version with enhanced capabilities
 */
export async function discoverMAVLinkBridgeDevices(
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Auto-detect local network interfaces if no subnets specified
  if (config.subnets.length === 0 && os) {
    config.subnets = await getLocalNetworkSubnets();
  }
  
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
 * Get local network subnets by examining network interfaces
 */
async function getLocalNetworkSubnets(): Promise<string[]> {
  if (!os) return [];
  
  const subnets: string[] = [];
  const interfaces = os.networkInterfaces();
  
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    
    for (const addr of addresses) {
      // Skip loopback, IPv6, and internal interfaces
      if (addr.internal || addr.family !== 'IPv4') continue;
      
      // Calculate network address from IP and netmask
      const ipParts = addr.address.split('.').map(p => parseInt(p, 10));
      const maskParts = addr.netmask.split('.').map(p => parseInt(p, 10));
      
      const networkParts = ipParts.map((ip, i) => ip & maskParts[i]);
      const networkAddr = networkParts.join('.');
      
      // Convert netmask to CIDR prefix length
      const prefixLength = maskParts
        .map(part => part.toString(2).split('1').length - 1)
        .reduce((sum, bits) => sum + bits, 0);
      
      subnets.push(`${networkAddr}/${prefixLength}`);
    }
  }
  
  return subnets;
}

/**
 * Generate all candidate hosts to test
 */
async function generateCandidates(config: Required<DiscoveryOptions>): Promise<string[]> {
  const candidates = new Set<string>();
  
  // Resolve known hostnames to IPs (mDNS support)
  if (dns) {
    for (const hostname of config.knownHostnames) {
      try {
        const addresses = await resolveHostname(hostname);
        addresses.forEach(ip => candidates.add(ip));
        // Also add the hostname itself in case it works directly
        candidates.add(hostname);
      } catch (error) {
        // Hostname resolution failed, skip
        candidates.add(hostname); // Still try the hostname directly
      }
    }
  } else {
    // Fallback for browser environment
    config.knownHostnames.forEach(hostname => candidates.add(hostname));
  }
  
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
 * Resolve hostname to IP addresses
 */
async function resolveHostname(hostname: string): Promise<string[]> {
  if (!dns) return [];
  
  return new Promise((resolve) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        resolve([]);
      } else {
        resolve(addresses);
      }
    });
  });
}

/**
 * Test candidate hosts for MAVLink Bridge devices
 */
async function testCandidates(
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
async function testSingleHost(
  url: string, 
  host: string, 
  timeout: number
): Promise<MAVLinkBridgeDevice | null> {
  try {
    const healthData = await makeHttpRequest(url, timeout);
    
    // Validate that this is actually a MAVLink Bridge device
    if (!isMAVLinkBridgeDevice(healthData)) {
      return null;
    }
    
    // Extract IP from health data or use host
    const deviceIP = healthData.network?.wifi?.ip || host;
    
    return {
      id: healthData.network.macAddress,
      name: healthData.device.name,
      hostname: healthData.device.hostname,
      ip: deviceIP,
      status: healthData.status,
      isProvisioned: healthData.network.wifi.status === 'connected',
      capabilities: {
        chipModel: healthData.device.chipModel,
        chipRevision: healthData.device.chipRevision,
        flashSize: healthData.device.flashSize,
        sdkVersion: healthData.device.sdkVersion,
        coreCount: healthData.device.coreCount
      },
      network: {
        macAddress: healthData.network.macAddress,
        apMacAddress: healthData.network.apMacAddress,
        wifi: {
          status: healthData.network.wifi.status,
          ssid: healthData.network.wifi.ssid,
          rssi: healthData.network.wifi.rssi
        },
        ap: {
          enabled: healthData.network.ap.enabled,
          clients: healthData.network.ap.clients
        }
      },
      lastSeen: Date.now()
    };
    
  } catch (error) {
    return null;
  }
}

/**
 * Make HTTP request using Node.js native modules
 */
async function makeHttpRequest(url: string, timeout: number): Promise<HealthResponse> {
  // Fallback to fetch if available (newer Node.js versions)
  if (typeof fetch !== 'undefined') {
    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }),
      timeout
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }
  
  // Use native Node.js HTTP modules
  if (!http || !https) {
    throw new Error('HTTP modules not available');
  }
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === 'https:' ? https : http;
    
    const request = httpModule.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: timeout
    }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.end();
  });
}

/**
 * Check if health response indicates a MAVLink Bridge device
 */
function isMAVLinkBridgeDevice(health: HealthResponse): boolean {
  // Check device name patterns
  const deviceName = health.device?.name?.toLowerCase() || '';
  const hostname = health.device?.hostname?.toLowerCase() || '';
  
  const mavlinkPatterns = [
    'mavlink',
    'bridge',
    'yardrover',
    'esp32-mavlinkbridge'
  ];
  
  return mavlinkPatterns.some(pattern => 
    deviceName.includes(pattern) || hostname.includes(pattern)
  ) && 
  // Ensure we have required device info
  !!health.device?.chipModel &&
  !!health.network?.macAddress;
}

/**
 * Continuous discovery with callback for real-time updates
 */
export function startContinuousDiscovery(
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