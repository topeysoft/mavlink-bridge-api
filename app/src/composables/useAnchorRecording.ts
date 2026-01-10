/**
 * Composable for anchor-based zone recording
 *
 * Manages anchor points for creating zones by marking corners/key points.
 */

import { ref, computed } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import type { AnchorPoint, RecordingState, ShapeType } from '@/types/recording'
import type { RecordingConfig } from '@client'

export function useAnchorRecording() {
  const connectionStore = useConnectionStore()

  const sessionId = ref<string | null>(null)
  const isRecording = ref(false)
  const isPaused = ref(false)
  const anchors = ref<AnchorPoint[]>([])
  const estimatedArea = ref(0)
  const estimatedPerimeter = ref(0)
  const shapeType = ref<ShapeType | undefined>(undefined)

  let statusInterval: number | null = null

  const state = computed<RecordingState>(() => ({
    isRecording: isRecording.value,
    isPaused: isPaused.value,
    sessionId: sessionId.value,
    mode: 'anchor',
    waypoints: [],
    anchors: anchors.value,
    estimatedArea: estimatedArea.value,
    estimatedPerimeter: estimatedPerimeter.value,
    waypointCount: 0,
    anchorCount: anchors.value.length,
    shapeType: shapeType.value
  }))

  /**
   * Start a new anchor recording session
   */
  async function startRecording(config?: Partial<RecordingConfig>) {
    if (!connectionStore.client) {
      throw new Error('Not connected to device')
    }

    // Start anchor recording session on backend
    const anchorConfig: RecordingConfig = {
      mode: 'anchor',
      autoSquare: config?.autoSquare ?? true,
      snapAngleThreshold: config?.snapAngleThreshold ?? 10.0,
      minAnchors: config?.minAnchors ?? 3,
      maxAnchors: config?.maxAnchors ?? 20,
      ...config
    }

    sessionId.value = await connectionStore.client.recording.startRecording(anchorConfig)
    isRecording.value = true
    isPaused.value = false
    anchors.value = []
    estimatedArea.value = 0
    estimatedPerimeter.value = 0
    shapeType.value = undefined

    // Poll status every 2 seconds
    startStatusPolling()
  }

  /**
   * Add an anchor point at the specified coordinates
   */
  async function addAnchor(lat: number, lon: number) {
    if (!sessionId.value || !connectionStore.client) return

    const anchor: AnchorPoint = {
      lat,
      lon,
      index: anchors.value.length,
      timestamp: Date.now() * 1000 // Convert to microseconds
    }

    try {
      await connectionStore.client.recording.addAnchor(sessionId.value, anchor)
      // Add to local array for visualization
      anchors.value.push(anchor)
    } catch (error) {
      console.error('Failed to add anchor:', error)
      throw error
    }
  }

  /**
   * Update an existing anchor's position
   */
  async function updateAnchor(index: number, lat: number, lon: number) {
    if (!sessionId.value || !connectionStore.client) return

    try {
      await connectionStore.client.recording.updateAnchor(sessionId.value, index, lat, lon)
      // Update local array
      if (anchors.value[index]) {
        anchors.value[index].lat = lat
        anchors.value[index].lon = lon
        anchors.value[index].timestamp = Date.now() * 1000
      }
    } catch (error) {
      console.error('Failed to update anchor:', error)
      throw error
    }
  }

  /**
   * Remove an anchor point
   */
  async function removeAnchor(index: number) {
    if (!sessionId.value || !connectionStore.client) return

    try {
      await connectionStore.client.recording.removeAnchor(sessionId.value, index)
      // Remove from local array
      anchors.value.splice(index, 1)
      // Re-index remaining anchors
      anchors.value.forEach((anchor, i) => {
        anchor.index = i
      })
    } catch (error) {
      console.error('Failed to remove anchor:', error)
      throw error
    }
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
        shapeType.value = status.shapeType
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
    if (statusInterval) {
      clearInterval(statusInterval)
      statusInterval = null
    }

    isRecording.value = false
    isPaused.value = false
    sessionId.value = null
    anchors.value = []
    estimatedArea.value = 0
    estimatedPerimeter.value = 0
    shapeType.value = undefined
  }

  return {
    state,
    isRecording,
    isPaused,
    anchors,
    estimatedArea,
    estimatedPerimeter,
    shapeType,
    startRecording,
    addAnchor,
    updateAnchor,
    removeAnchor,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  }
}
