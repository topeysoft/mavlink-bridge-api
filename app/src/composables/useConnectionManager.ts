import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMAVLinkClient } from './useMAVLinkClient'
import { deviceDiscovery } from '../services/DeviceDiscovery'
import type { DiscoveredDevice } from '../services/DeviceDiscovery'

type DeviceRef = DiscoveredDevice | null

export interface ConnectionOptions {
  autoReconnect?: boolean
  maxRetries?: number
  retryDelay?: number
}

export function useConnectionManager () {
  const router = useRouter()
  const { connect, disconnect, isConnected } = useMAVLinkClient()

  const lastConnectedDevice = ref<DeviceRef>(null)
  const connectionRetries = ref(0)
  const autoReconnecting = ref(false)

  const loadLastDevice = () => {
    const saved = localStorage.getItem('yardrover-last-device')
    if (saved) {
      lastConnectedDevice.value = JSON.parse(saved)
    }
  }

  const saveLastDevice = (device: DiscoveredDevice) => {
    lastConnectedDevice.value = device
    localStorage.setItem('yardrover-last-device', JSON.stringify(device))
    deviceDiscovery.saveDevice(device)
  }

  const connectToDevice = async (device: DiscoveredDevice, options: ConnectionOptions = {}) => {
    const {
      autoReconnect = false, // Changed default to false for manual connections
      maxRetries = 3,
      retryDelay = 2000
    } = options

    try {
      const url = `http://${device.ip}:${device.port}`
      await connect(url)

      saveLastDevice(device)
      connectionRetries.value = 0

      // Navigate to dashboard if on connection page
      if (router.currentRoute?.value?.name === 'connect') {
        void router.push('/')
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Connection failed:', error)

      if (autoReconnect && connectionRetries.value < maxRetries) {
        connectionRetries.value++
        autoReconnecting.value = true

        setTimeout(() => {
          void connectToDevice(device, options)
        }, retryDelay)

        throw new Error(`Connection failed. Retrying... (${connectionRetries.value}/${maxRetries})`)
      } else {
        autoReconnecting.value = false
        connectionRetries.value = 0

        // Re-throw the error to be handled by the calling component
        throw error
      }
    }
  }

  const disconnectFromDevice = () => {
    try {
      disconnect()
      connectionRetries.value = 0
      autoReconnecting.value = false
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  const autoConnect = async () => {
    loadLastDevice()

    if (lastConnectedDevice.value && !isConnected.value) {
      await connectToDevice(lastConnectedDevice.value, {
        autoReconnect: true,
        maxRetries: 1
      })
    }
  }

  return {
    lastConnectedDevice: computed(() => lastConnectedDevice.value),
    autoReconnecting: computed(() => autoReconnecting.value),
    connectionRetries: computed(() => connectionRetries.value),
    connectToDevice,
    disconnectFromDevice,
    autoConnect
  }
}
