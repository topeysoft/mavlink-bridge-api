/**
 * MAVLink Bridge Device Discovery Library
 * 
 * Cross-platform discovery library that works in both browser and Node.js environments.
 * Uses the existing /api/health endpoint for device detection without requiring additional
 * REST API endpoints on the device.
 */

// Export types
export type {
  MAVLinkBridgeDevice,
  DiscoveryOptions,
  DiscoveryResult,
  HealthResponse
} from './types';

// Export utilities
export {
  parseCIDR,
  generateTestUrls,
  withTimeout,
  limitConcurrency,
  deduplicateDevices,
  isValidIP,
  getDefaultCandidates
} from './utils';

// Platform detection
const isNode = typeof process !== 'undefined' && 
               process.versions && 
               process.versions.node;

const isBrowser = typeof window !== 'undefined';

/**
 * Main discovery function that automatically uses the appropriate implementation
 * based on the runtime environment
 */
export async function discoverMAVLinkBridgeDevices(
  options: import('./types').DiscoveryOptions = {}
): Promise<import('./types').DiscoveryResult> {
  if (isNode) {
    // Use Node.js implementation with enhanced capabilities
    const { discoverMAVLinkBridgeDevices: nodeDiscovery } = await import('./node');
    return nodeDiscovery(options);
  } else {
    // Use browser-compatible implementation
    const { discoverMAVLinkBridgeDevices: browserDiscovery } = await import('./browser');
    return browserDiscovery(options);
  }
}

/**
 * Start continuous discovery with real-time device updates
 */
export function startContinuousDiscovery(
  onDeviceFound: (device: import('./types').MAVLinkBridgeDevice) => void,
  onDeviceLost: (deviceId: string) => void,
  options: import('./types').DiscoveryOptions & { interval?: number } = {}
): () => void {
  if (isNode) {
    // Use Node.js implementation
    const { startContinuousDiscovery: nodeDiscovery } = require('./node');
    return nodeDiscovery(onDeviceFound, onDeviceLost, options);
  } else {
    // Use browser implementation
    const { startContinuousDiscovery: browserDiscovery } = require('./browser');
    return browserDiscovery(onDeviceFound, onDeviceLost, options);
  }
}

/**
 * Convenience function for quick device discovery with sensible defaults
 */
export async function findMAVLinkBridgeDevices(subnets?: string[]): Promise<import('./types').MAVLinkBridgeDevice[]> {
  const result = await discoverMAVLinkBridgeDevices({
    subnets: subnets || [],
    timeout: 3000,
    concurrent: 30
  });
  
  return result.devices;
}

/**
 * Find devices in AP mode (unprovisioned)
 */
export async function findUnprovisionedDevices(): Promise<import('./types').MAVLinkBridgeDevice[]> {
  const result = await discoverMAVLinkBridgeDevices({
    subnets: [],
    apModeIPs: ['192.168.4.1', '192.168.1.1'], // Common AP mode IPs
    knownHostnames: [], // Skip hostname resolution for speed
    timeout: 2000,
    concurrent: 5
  });
  
  return result.devices.filter(device => !device.isProvisioned);
}

/**
 * Find devices on the local network (provisioned)
 */
export async function findProvisionedDevices(subnets?: string[]): Promise<import('./types').MAVLinkBridgeDevice[]> {
  const result = await discoverMAVLinkBridgeDevices({
    subnets: subnets || [],
    apModeIPs: [], // Skip AP mode IPs
    timeout: 5000,
    concurrent: 20
  });
  
  return result.devices.filter(device => device.isProvisioned);
}

// Export platform-specific implementations for advanced usage
export const platform = {
  isNode,
  isBrowser,
  
  // Direct access to platform-specific implementations
  async browser() {
    return await import('./browser');
  },
  
  async node() {
    return await import('./node');
  }
};

// Default export for simple usage
export default {
  discover: discoverMAVLinkBridgeDevices,
  findDevices: findMAVLinkBridgeDevices,
  findUnprovisioned: findUnprovisionedDevices,
  findProvisioned: findProvisionedDevices,
  startContinuous: startContinuousDiscovery,
  platform
};