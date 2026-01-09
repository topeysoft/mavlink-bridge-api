/**
 * Connection Orchestrator Store
 *
 * Centralized connection management for all scenarios:
 * - App initialization (auto-reconnect)
 * - Onboarding flow
 * - Manual connection
 * - Reconnection after network loss
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore, type SavedDevice } from './connection'
import { useOnboardingStore } from './onboarding'

export type ConnectionMethod =
  | 'already-connected'
  | 'auto-reconnect'
  | 'recent-device'
  | 'manual'
  | 'discovery'

export type ConnectionPhase =
  | 'idle'
  | 'checking'
  | 'reconnecting'
  | 'authenticating'
  | 'success'
  | 'failed'

export interface ConnectionState {
  phase: ConnectionPhase
  message: string
  device?: string
  progress?: number
}

export interface ConnectionResult {
  success: boolean
  method?: ConnectionMethod
  device?: {
    name: string | null
    url: string | null
  }
  requiresUI?: boolean
  reason?: string
  error?: Error
}

export interface SmartConnectOptions {
  silent?: boolean // Try without showing UI
  context?: 'app-load' | 'onboarding' | 'manual' | 'reconnect'
  onProgress?: (state: ConnectionState) => void
  maxRetries?: number
}

/**
 * Connection Orchestrator - Smart connection management
 */
export const useConnectionOrchestrator = defineStore('connectionOrchestrator', () => {
  const connectionStore = useConnectionStore()
  const onboardingStore = useOnboardingStore()

  // State
  const currentState = ref<ConnectionState>({ phase: 'idle', message: '' })
  const isConnecting = ref(false)
  const lastConnectionAttempt = ref<number | null>(null)
  const lastConnectionResult = ref<ConnectionResult | null>(null)

  // Computed
  const canAttemptConnection = computed(() => {
    // Throttle connection attempts (max once per 2 seconds)
    if (lastConnectionAttempt.value) {
      const timeSinceLastAttempt = Date.now() - lastConnectionAttempt.value
      return timeSinceLastAttempt > 2000
    }
    return true
  })

  // Actions

  /**
   * Smart connect: Handles all connection scenarios intelligently
   */
  async function smartConnect(options: SmartConnectOptions = {}): Promise<ConnectionResult> {
    const {
      silent = false,
      context = 'manual',
      onProgress,
      maxRetries = 2
    } = options

    // Don't start if already connecting
    if (isConnecting.value) {
      return { success: false, reason: 'connection-in-progress' }
    }

    // Throttle connection attempts
    if (!canAttemptConnection.value) {
      return { success: false, reason: 'too-soon' }
    }

    isConnecting.value = true
    lastConnectionAttempt.value = Date.now()

    try {
      // Step 1: Check if already connected
      if (connectionStore.isConnected) {
        updateState({ phase: 'success', message: 'Already connected' })
        const result: ConnectionResult = {
          success: true,
          method: 'already-connected',
          device: {
            name: connectionStore.currentDeviceName,
            url: connectionStore.currentDeviceUrl
          }
        }
        lastConnectionResult.value = result
        return result
      }

      // Step 2: Try auto-reconnect (if enabled and available)
      if (silent && connectionStore.hasPersistedConnection()) {
        updateState({ phase: 'reconnecting', message: 'Reconnecting to last device...' }, onProgress)

        const result = await attemptAutoReconnect(maxRetries, onProgress)
        if (result.success) {
          updateState({ phase: 'success', message: `Connected to ${result.device?.name}` }, onProgress)
          lastConnectionResult.value = result
          return result
        }
      }

      // Step 3: Try recent devices (silent retry)
      if (silent && connectionStore.savedDevices.length > 0) {
        updateState({ phase: 'checking', message: 'Checking recent devices...' }, onProgress)

        const result = await tryRecentDevices(onProgress)
        if (result.success) {
          updateState({ phase: 'success', message: `Connected to ${result.device?.name}` }, onProgress)
          lastConnectionResult.value = result
          return result
        }
      }

      // Step 4: Silent attempts failed - need user interaction
      updateState({ phase: 'failed', message: 'Could not auto-connect' }, onProgress)

      const result: ConnectionResult = {
        success: false,
        requiresUI: true,
        reason: context === 'app-load' ? 'no-auto-connect' : 'connection-failed'
      }
      lastConnectionResult.value = result
      return result

    } catch (error) {
      console.error('[ConnectionOrchestrator] Smart connect error:', error)
      updateState({ phase: 'failed', message: 'Connection error' }, onProgress)

      const result: ConnectionResult = {
        success: false,
        requiresUI: true,
        reason: 'error',
        error: error instanceof Error ? error : new Error('Unknown error')
      }
      lastConnectionResult.value = result
      return result
    } finally {
      isConnecting.value = false
    }
  }

  /**
   * Attempt auto-reconnect with retry logic
   */
  async function attemptAutoReconnect(
    maxAttempts: number = 2,
    onProgress?: (state: ConnectionState) => void
  ): Promise<ConnectionResult> {
    const deviceName = connectionStore.currentDeviceName || 'device'

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        updateState({
          phase: 'reconnecting',
          message: `Connecting to ${deviceName}...`,
          device: deviceName,
          progress: (attempt / maxAttempts) * 50
        }, onProgress)

        const success = await connectionStore.autoReconnect()

        if (success) {
          return {
            success: true,
            method: 'auto-reconnect',
            device: {
              name: connectionStore.currentDeviceName,
              url: connectionStore.currentDeviceUrl
            }
          }
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxAttempts) {
          updateState({
            phase: 'reconnecting',
            message: `Retrying... (${attempt}/${maxAttempts})`,
            device: deviceName,
            progress: (attempt / maxAttempts) * 50 + 10
          }, onProgress)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`[ConnectionOrchestrator] Auto-reconnect attempt ${attempt} failed:`, error)
        if (attempt === maxAttempts) {
          return {
            success: false,
            reason: 'auto-reconnect-failed',
            error: error instanceof Error ? error : new Error('Connection failed')
          }
        }
      }
    }

    return { success: false, reason: 'auto-reconnect-failed' }
  }

  /**
   * Try connecting to recent devices
   */
  async function tryRecentDevices(
    onProgress?: (state: ConnectionState) => void
  ): Promise<ConnectionResult> {
    // Sort by lastConnected (most recent first)
    const recentDevices = [...connectionStore.savedDevices]
      .filter(d => d.lastConnected)
      .sort((a, b) => {
        const timeA = new Date(a.lastConnected!).getTime()
        const timeB = new Date(b.lastConnected!).getTime()
        return timeB - timeA
      })
      .slice(0, 3) // Try up to 3 most recent

    for (const device of recentDevices) {
      try {
        updateState({
          phase: 'reconnecting',
          message: `Trying ${device.name}...`,
          device: device.name
        }, onProgress)

        const success = await connectionStore.connect(device.url, device.name)

        if (success) {
          return {
            success: true,
            method: 'recent-device',
            device: {
              name: device.name,
              url: device.url
            }
          }
        }
      } catch (error) {
        console.error(`[ConnectionOrchestrator] Failed to connect to ${device.name}:`, error)
        // Continue to next device
      }
    }

    return { success: false, reason: 'no-recent-devices' }
  }

  /**
   * Connect to a specific device
   */
  async function connectToDevice(
    deviceUrl: string,
    deviceName?: string,
    onProgress?: (state: ConnectionState) => void
  ): Promise<ConnectionResult> {
    isConnecting.value = true

    try {
      updateState({
        phase: 'reconnecting',
        message: `Connecting to ${deviceName || 'device'}...`,
        device: deviceName
      }, onProgress)

      const success = await connectionStore.connect(deviceUrl, deviceName)

      if (success) {
        updateState({ phase: 'success', message: 'Connected!' }, onProgress)
        return {
          success: true,
          method: 'manual',
          device: {
            name: connectionStore.currentDeviceName,
            url: connectionStore.currentDeviceUrl
          }
        }
      }

      updateState({ phase: 'failed', message: 'Connection failed' }, onProgress)
      return { success: false, reason: 'connection-failed' }
    } catch (error) {
      console.error('[ConnectionOrchestrator] Connection error:', error)
      updateState({ phase: 'failed', message: 'Connection error' }, onProgress)
      return {
        success: false,
        reason: 'error',
        error: error instanceof Error ? error : new Error('Connection failed')
      }
    } finally {
      isConnecting.value = false
    }
  }

  /**
   * Get user-friendly error message based on result
   */
  function getErrorMessage(result: ConnectionResult, isConsumerMode: boolean = false): string {
    if (!result.reason) return 'Connection failed'

    const messages: Record<string, { consumer: string; technical: string }> = {
      'no-auto-connect': {
        consumer: 'We couldn\'t find your YardRover. Let\'s connect manually.',
        technical: 'Auto-connect failed. Manual connection required.'
      },
      'connection-failed': {
        consumer: 'We couldn\'t connect to your device. Is it powered on?',
        technical: 'Connection failed. Verify device is online and accessible.'
      },
      'auto-reconnect-failed': {
        consumer: 'Lost connection to your YardRover. Let\'s reconnect.',
        technical: 'Auto-reconnect failed. Device may be offline or network changed.'
      },
      'no-recent-devices': {
        consumer: 'No recent devices found.',
        technical: 'No recent device connections available.'
      },
      'error': {
        consumer: 'Something went wrong. Please try again.',
        technical: result.error?.message || 'An error occurred during connection.'
      }
    }

    const message = messages[result.reason]
    return message ? (isConsumerMode ? message.consumer : message.technical) : 'Connection failed'
  }

  /**
   * Update current connection state
   */
  function updateState(state: ConnectionState, onProgress?: (state: ConnectionState) => void) {
    currentState.value = state
    if (onProgress) {
      onProgress(state)
    }
  }

  /**
   * Reset connection state
   */
  function reset() {
    currentState.value = { phase: 'idle', message: '' }
    isConnecting.value = false
    lastConnectionResult.value = null
  }

  return {
    // State
    currentState,
    isConnecting,
    lastConnectionResult,

    // Computed
    canAttemptConnection,

    // Actions
    smartConnect,
    attemptAutoReconnect,
    tryRecentDevices,
    connectToDevice,
    getErrorMessage,
    reset
  }
})
