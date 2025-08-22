import { ref } from 'vue'

export interface DiscoveredDevice {
  name: string
  hostname: string
  ip: string
  port: number
  lastSeen: number
  rssi?: number
}

interface CachedScanResult {
  ip: string
  lastChecked: number
  found: boolean
}

class DeviceDiscoveryService {
  private devices = ref<Map<string, DiscoveredDevice>>(new Map())
  private isScanning = ref(false)
  private scanInterval: number | null = null
  private scanCache = new Map<string, CachedScanResult>()
  private readonly CACHE_DURATION = 60000 // 60 seconds
  private readonly SCAN_INTERVAL = 20000 // 20 seconds
  private readonly MAX_SCAN_DURATION = 60000 // 1 minute max
  private scanStartTime = 0

  async startDiscovery() {
    if (this.isScanning.value) return
    
    this.isScanning.value = true
    this.scanStartTime = Date.now()
    
    // Initial scan
    await this.scanForDevices()
    
    // Set up periodic scanning with longer intervals
    this.scanInterval = window.setInterval(() => {
      // Auto-stop after max duration
      if (Date.now() - this.scanStartTime > this.MAX_SCAN_DURATION) {
        this.stopDiscovery()
        return
      }
      void this.scanForDevices()
    }, this.SCAN_INTERVAL)
  }

  stopDiscovery() {
    this.isScanning.value = false
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }
  }

  private shouldSkipIP(ip: string): boolean {
    const cached = this.scanCache.get(ip)
    if (!cached) return false
    
    const isExpired = Date.now() - cached.lastChecked > this.CACHE_DURATION
    if (isExpired) {
      this.scanCache.delete(ip)
      return false
    }
    
    // Skip if recently checked and not found
    return !cached.found
  }

  private updateCache(ip: string, found: boolean) {
    this.scanCache.set(ip, {
      ip,
      lastChecked: Date.now(),
      found
    })
  }

  private async scanForDevices() {
    try {
      // Priority 1: Check saved devices first (most likely to succeed)
      const savedDevices = this.getSavedDevices()
      for (const device of savedDevices) {
        if (!this.shouldSkipIP(device.ip)) {
          await this.checkDevice(device.ip, device.port, device.name)
        }
      }
      
      // Priority 2: Check default AP mode address
      if (!this.shouldSkipIP('192.168.4.1')) {
        await this.checkDevice('192.168.4.1', 80, 'YardRover-AP')
      }
      
      // Priority 3: Check common device IPs (limited scope)
      await this.scanCommonIPs()
      
    } catch {
      console.error('Discovery error occurred')
    }
  }

  private async checkDevice(ip: string, port: number, name?: string) {
    try {
      const response = await fetch(`http://${ip}:${port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000) // Reduced timeout
      })
      
      if (response.ok) {
        const data = await response.json()
        const device: DiscoveredDevice = {
          name: data.device?.name || name || 'Unknown Device',
          hostname: data.device?.hostname || ip,
          ip,
          port,
          lastSeen: Date.now()
        }
        
        this.devices.value.set(ip, device)
        this.updateCache(ip, true)
      } else {
        this.updateCache(ip, false)
        this.devices.value.delete(ip)
      }
    } catch {
      // Device not responding, remove if exists and cache failure
      this.updateCache(ip, false)
      this.devices.value.delete(ip)
    }
  }

  private async scanCommonIPs() {
    // Common router/device IP ranges - much more limited than full subnet scan
    const commonIPs = [
      // Common router IPs
      '192.168.1.1', '192.168.0.1', '192.168.1.254',
      // Common device IPs
      '192.168.1.100', '192.168.1.101', '192.168.1.102',
      '192.168.1.200', '192.168.1.201', '192.168.1.202',
      // Alternative subnets
      '192.168.0.100', '192.168.0.101', '192.168.0.200',
      '10.0.0.1', '10.0.0.100'
    ]
    
    const promises = []
    for (const ip of commonIPs) {
      if (!this.shouldSkipIP(ip)) {
        promises.push(this.checkDevice(ip, 80))
        
        // Limit concurrent requests to prevent overwhelming
        if (promises.length >= 5) {
          await Promise.allSettled(promises)
          promises.length = 0
        }
      }
    }
    
    if (promises.length > 0) {
      await Promise.allSettled(promises)
    }
  }

  getSavedDevices(): DiscoveredDevice[] {
    const saved = localStorage.getItem('yardrover-saved-devices')
    return saved ? JSON.parse(saved) : []
  }

  saveDevice(device: DiscoveredDevice) {
    const saved = this.getSavedDevices()
    const index = saved.findIndex(d => d.ip === device.ip)
    
    if (index >= 0) {
      saved[index] = device
    } else {
      saved.push(device)
    }
    
    localStorage.setItem('yardrover-saved-devices', JSON.stringify(saved))
  }

  getDevices() {
    return Array.from(this.devices.value.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  get scanning() {
    return this.isScanning.value
  }

  clearCache() {
    this.scanCache.clear()
  }

  async refreshScan() {
    this.clearCache()
    this.devices.value.clear()
    await this.startDiscovery()
  }
}

export const deviceDiscovery = new DeviceDiscoveryService()