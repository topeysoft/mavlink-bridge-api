/**
 * Utility functions for MAVLink Bridge device discovery
 */

/**
 * Parse CIDR notation to generate array of IP addresses
 */
export function parseCIDR(cidr: string): string[] {
  const [network, prefixLength] = cidr.split('/');
  if (!network || !prefixLength) {
    throw new Error('Invalid CIDR notation');
  }
  const prefix = parseInt(prefixLength, 10);
  
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix length: ${prefix}`);
  }
  
  const networkParts = network.split('.').map(part => parseInt(part, 10));
  if (networkParts.length !== 4 || networkParts.some(part => isNaN(part) || part < 0 || part > 255)) {
    throw new Error(`Invalid network address: ${network}`);
  }
  
  const networkInt = (networkParts[0]! << 24) + (networkParts[1]! << 16) + (networkParts[2]! << 8) + networkParts[3]!;
  const hostBits = 32 - prefix;
  const hostCount = Math.pow(2, hostBits);
  const networkBase = networkInt & (0xFFFFFFFF << hostBits);
  
  const ips: string[] = [];
  
  // Skip network and broadcast addresses for /24 and smaller networks
  const startOffset = prefix >= 24 ? 1 : 0;
  const endOffset = prefix >= 24 ? 1 : 0;
  
  for (let i = startOffset; i < hostCount - endOffset; i++) {
    const ip = networkBase + i;
    const ipStr = [
      (ip >>> 24) & 0xFF,
      (ip >>> 16) & 0xFF,
      (ip >>> 8) & 0xFF,
      ip & 0xFF
    ].join('.');
    ips.push(ipStr);
  }
  
  return ips;
}

/**
 * Generate default discovery candidates based on common patterns
 */
export function getDefaultCandidates(): string[] {
  return [
    // Common private network ranges
    '192.168.1.0/24',
    '192.168.0.0/24',
    '10.0.0.0/24',
    '172.16.0.0/24'
  ];
}

/**
 * Validate if an IP address is valid
 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

/**
 * Generate URLs to test for a given host and ports
 */
export function generateTestUrls(host: string, ports: number[]): string[] {
  return ports.map(port => {
    const baseUrl = port === 80 ? `http://${host}` : `http://${host}:${port}`;
    return `${baseUrl}/api/health`;
  });
}

/**
 * Create a timeout promise for async operations
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
}

/**
 * Limit concurrent execution of async operations
 */
export async function limitConcurrency<T, R>(
  items: T[],
  asyncFn: (item: T) => Promise<R>,
  concurrency: number
): Promise<(R | Error)[]> {
  const results: (R | Error)[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = asyncFn(item)
      .then(result => {
        results.push(result);
      })
      .catch(error => {
        results.push(error);
      });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * Deduplicate devices by MAC address, keeping the most recent
 */
export function deduplicateDevices<T extends { id: string; lastSeen: number }>(devices: T[]): T[] {
  const deviceMap = new Map<string, T>();
  
  for (const device of devices) {
    const existing = deviceMap.get(device.id);
    if (!existing || device.lastSeen > existing.lastSeen) {
      deviceMap.set(device.id, device);
    }
  }
  
  return Array.from(deviceMap.values());
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}