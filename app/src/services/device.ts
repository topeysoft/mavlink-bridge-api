/**
 * Device Discovery Service
 *
 * Provides utilities for discovering and managing YardRover devices on the network
 */

import { discoverMAVLinkBridgeDevices, startContinuousDiscovery, type MAVLinkBridgeDevice, type DiscoveryOptions } from '@mavlinkbridge/api-client'

export interface DiscoveryServiceOptions {
  /** Discovery timeout in milliseconds */
  timeout?: number
  /** Whether to use mDNS discovery */
  useMDNS?: boolean
  /** Whether to use network scanning */
  useNetworkScan?: boolean
  /** Callback for discovered devices */
  onDeviceDiscovered?: (device: MAVLinkBridgeDevice) => void
  /** Callback for discovery errors */
  onError?: (error: Error) => void
}

/**
 * Discover YardRover devices on the local network
 *
 * Uses mDNS and network scanning to find devices
 */
export async function discoverDevices(options: DiscoveryServiceOptions = {}): Promise<MAVLinkBridgeDevice[]> {
  const {
    timeout = 5000,
    onError
  } = options

  try {
    const discoveryOptions: DiscoveryOptions = {
      timeout
    }

    const result = await discoverMAVLinkBridgeDevices(discoveryOptions)
    return result.devices
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Discovery failed')
    onError?.(err)
    throw err
  }
}

/**
 * Start continuous device discovery
 *
 * Continuously scans for devices and calls the callback when devices are found
 */
export function startContinuousDeviceDiscovery(
  callback: (devices: MAVLinkBridgeDevice[]) => void,
  options: DiscoveryServiceOptions = {}
): () => void {
  const {
    timeout = 5000,
    onDeviceDiscovered,
    onError
  } = options

  const discoveryOptions: DiscoveryOptions & { interval?: number } = {
    timeout,
    interval: 30000
  }

  // Device found callback
  const handleDeviceFound = (device: MAVLinkBridgeDevice) => {
    onDeviceDiscovered?.(device)
  }

  // Device lost callback
  const handleDeviceLost = (deviceId: string) => {
    console.log('Device lost:', deviceId)
  }

  // Start continuous discovery
  const stopDiscovery = startContinuousDiscovery(
    handleDeviceFound,
    handleDeviceLost,
    discoveryOptions
  )

  // Return stop function
  return stopDiscovery
}

/**
 * Parse device URL from various formats
 *
 * Accepts:
 * - http://192.168.4.1
 * - 192.168.4.1
 * - yardrover.local
 */
export function parseDeviceUrl(input: string): string {
  // Remove whitespace
  input = input.trim()

  // If already has protocol, return as-is
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input
  }

  // Add http:// prefix
  return `http://${input}`
}

/**
 * Validate device URL format
 */
export function isValidDeviceUrl(url: string): boolean {
  try {
    const parsed = new URL(parseDeviceUrl(url))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extract hostname from device URL
 */
export function getDeviceHostname(url: string): string {
  try {
    const parsed = new URL(parseDeviceUrl(url))
    return parsed.hostname
  } catch {
    return url
  }
}

/**
 * Format device name for display
 */
export function formatDeviceName(device: MAVLinkBridgeDevice): string {
  if (device.name) {
    return device.name
  }

  // Fallback to hostname or IP
  return device.hostname === 'yardrover.local' ? 'YardRover Device' : device.hostname
}

/**
 * Get device connection quality based on signal strength
 */
export function getDeviceConnectionQuality(device: MAVLinkBridgeDevice): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
  // If device doesn't report signal strength, return unknown
  if (!device.network.wifi.rssi) {
    return 'unknown'
  }

  const signal = device.network.wifi.rssi

  if (signal >= -50) return 'excellent'
  if (signal >= -60) return 'good'
  if (signal >= -70) return 'fair'
  return 'poor'
}

/**
 * Sort devices by preference
 *
 * Priority:
 * 1. Devices with names
 * 2. Provisioned devices
 * 3. Devices by IP address
 */
export function sortDevicesByPreference(devices: MAVLinkBridgeDevice[]): MAVLinkBridgeDevice[] {
  return [...devices].sort((a, b) => {
    // Devices with names come first
    if (a.name && !b.name) return -1
    if (!a.name && b.name) return 1

    // Then by provisioned status
    if (a.isProvisioned && !b.isProvisioned) return -1
    if (!a.isProvisioned && b.isProvisioned) return 1

    // Finally alphabetically by IP
    return a.ip.localeCompare(b.ip)
  })
}
