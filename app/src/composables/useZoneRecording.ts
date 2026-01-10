/**
 * Composable for zone recording functionality
 *
 * Manages GPS-based zone recording sessions with real-time waypoint collection.
 */

import { ref, computed } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import type { RecordedWaypoint, RecordingState } from '@/types/recording'
import type { RecordingConfig } from '@client'

export function useZoneRecording() {
  const connectionStore = useConnectionStore()

  const sessionId = ref<string | null>(null)
  const isRecording = ref(false)
  const isPaused = ref(false)
  const waypoints = ref<RecordedWaypoint[]>([])
  const estimatedArea = ref(0)
  const estimatedPerimeter = ref(0)
  const sessionStartTime = ref(0)
  const isNearTimeout = ref(false)

  let gpsUnsubscribe: (() => void) | null = null
  let statusInterval: number | null = null
  let gpsTimeoutTimer: number | null = null
  let lastGpsUpdate = 0
  const GPS_TIMEOUT_MS = 10000 // 10 seconds
  const SESSION_TIMEOUT_MS = 3600000 // 1 hour
  const WARNING_THRESHOLD_MS = 3300000 // 55 minutes (warn 5 min before timeout)

  const sessionAge = computed(() => {
    if (!sessionStartTime.value) return 0
    return Date.now() - sessionStartTime.value
  })

  const timeUntilTimeout = computed(() => {
    if (!sessionStartTime.value) return SESSION_TIMEOUT_MS
    return Math.max(0, SESSION_TIMEOUT_MS - sessionAge.value)
  })

  const state = computed<RecordingState>(() => ({
    isRecording: isRecording.value,
    isPaused: isPaused.value,
    sessionId: sessionId.value,
    waypoints: waypoints.value,
    estimatedArea: estimatedArea.value,
    estimatedPerimeter: estimatedPerimeter.value,
    waypointCount: waypoints.value.length
  }))

  /**
   * Start a new recording session
   */
  async function startRecording(config?: RecordingConfig) {
    if (!connectionStore.client) {
      throw new Error('Not connected to device')
    }

    // Start recording session on backend
    sessionId.value = await connectionStore.client.recording.startRecording(config)
    isRecording.value = true
    isPaused.value = false
    waypoints.value = []
    estimatedArea.value = 0
    estimatedPerimeter.value = 0
    sessionStartTime.value = Date.now()
    isNearTimeout.value = false

    // Subscribe to GPS telemetry via WebSocket
    subscribeToGPS()

    // Poll status every 2 seconds
    startStatusPolling()
  }

  /**
   * Start GPS timeout watchdog
   */
  function startGpsWatchdog() {
    lastGpsUpdate = Date.now()

    gpsTimeoutTimer = window.setInterval(() => {
      if (!isRecording.value || isPaused.value) return

      // Check GPS dropout
      const timeSinceLastUpdate = Date.now() - lastGpsUpdate
      if (timeSinceLastUpdate > GPS_TIMEOUT_MS) {
        console.warn('GPS dropout detected - auto-pausing recording')
        pauseRecording().catch(error => {
          console.error('Failed to auto-pause on GPS dropout:', error)
        })
      }

      // Check session timeout warning
      const age = sessionAge.value
      if (age >= WARNING_THRESHOLD_MS && !isNearTimeout.value) {
        console.warn('Session approaching timeout (55 minutes)')
        isNearTimeout.value = true
      }
    }, 2000) // Check every 2 seconds
  }

  /**
   * Subscribe to GPS messages from WebSocket
   */
  function subscribeToGPS() {
    if (!connectionStore.client?.ws) return

    // Subscribe to GLOBAL_POSITION_INT messages (MAVLink message ID 33)
    gpsUnsubscribe = connectionStore.client.ws.on('GLOBAL_POSITION_INT', async (data: any) => {
      if (!isRecording.value || isPaused.value || !sessionId.value) return

      // Update GPS watchdog
      lastGpsUpdate = Date.now()

      const waypoint: RecordedWaypoint = {
        lat: data.lat / 1e7,  // MAVLink sends as int32 (degrees * 1e7)
        lon: data.lon / 1e7,
        accuracy: data.eph ? data.eph / 100 : undefined,  // Convert cm to meters
        timestamp: Date.now()
      }

      // Add to local array for visualization
      waypoints.value.push(waypoint)

      // Send to backend
      try {
        await connectionStore.client!.recording.addWaypoint(sessionId.value, {
          lat: waypoint.lat,
          lon: waypoint.lon,
          accuracy: waypoint.accuracy,
          timestamp: waypoint.timestamp * 1000  // Convert to microseconds
        })
      } catch (error) {
        console.error('Failed to add waypoint:', error)
      }
    })

    // Start GPS watchdog
    startGpsWatchdog()
  }

  /**
   * Start polling for recording status updates
   */
  function startStatusPolling() {
    statusInterval = window.setInterval(async () => {
      if (!sessionId.value || !connectionStore.client) return

      try {
        const status = await connectionStore.client.recording.getStatus(sessionId.value)
        estimatedArea.value = status.estimatedArea || 0
        estimatedPerimeter.value = status.estimatedPerimeter || 0
      } catch (error) {
        console.error('Failed to get recording status:', error)
      }
    }, 2000)
  }

  /**
   * Pause the recording session
   */
  async function pauseRecording() {
    if (!sessionId.value || !connectionStore.client) return
    await connectionStore.client.recording.pauseRecording(sessionId.value)
    isPaused.value = true
  }

  /**
   * Resume a paused recording session
   */
  async function resumeRecording() {
    if (!sessionId.value || !connectionStore.client) return
    await connectionStore.client.recording.resumeRecording(sessionId.value)
    isPaused.value = false
  }

  /**
   * Stop recording and get the processed result
   */
  async function stopRecording() {
    if (!sessionId.value || !connectionStore.client) return

    // Complete recording on backend
    const result = await connectionStore.client.recording.completeRecording(sessionId.value)

    // Cleanup
    cleanup()

    return result
  }

  /**
   * Cancel recording without saving
   */
  async function cancelRecording() {
    if (!sessionId.value || !connectionStore.client) return

    await connectionStore.client.recording.cancelRecording(sessionId.value)
    cleanup()
  }

  /**
   * Cleanup resources
   */
  function cleanup() {
    if (gpsUnsubscribe) {
      gpsUnsubscribe()
      gpsUnsubscribe = null
    }

    if (statusInterval) {
      clearInterval(statusInterval)
      statusInterval = null
    }

    if (gpsTimeoutTimer) {
      clearInterval(gpsTimeoutTimer)
      gpsTimeoutTimer = null
    }

    isRecording.value = false
    isPaused.value = false
    sessionId.value = null
    waypoints.value = []
    estimatedArea.value = 0
    estimatedPerimeter.value = 0
    sessionStartTime.value = 0
    isNearTimeout.value = false
    lastGpsUpdate = 0
  }

  return {
    state,
    isRecording,
    isPaused,
    waypoints,
    estimatedArea,
    estimatedPerimeter,
    sessionAge,
    timeUntilTimeout,
    isNearTimeout,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  }
}
