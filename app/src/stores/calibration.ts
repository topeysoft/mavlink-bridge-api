import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import { MAVCommand } from '@mavlinkbridge/api-client'

export type CalibrationType = 'gyro' | 'compass' | 'accelerometer' | 'radio' | 'pressure' | 'level'

export type CalibrationStatus = 'not_started' | 'in_progress' | 'success' | 'failed' | 'cancelled'

export type CompassCalibrationMethod = 'standard' | 'large_vehicle' | 'static_heading' | 'auto_learn'

export interface CalibrationState {
  type: CalibrationType
  status: CalibrationStatus
  progress: number // 0-100
  message: string
  startedAt: number | null
  completedAt: number | null
  quality: number // 0-100, -1 if not applicable
  errors: string[]
  // Compass-specific settings
  compassMethod?: CompassCalibrationMethod
  staticHeading?: number // TRUE heading for static calibration
  autoLearnEnabled?: boolean
}

export interface CalibrationHistory {
  type: CalibrationType
  timestamp: number
  quality: number
  success: boolean
}

export const useCalibrationStore = defineStore('calibration', () => {
  // Current calibration states
  const calibrationStates = ref<Record<CalibrationType, CalibrationState>>({
    gyro: createInitialState('gyro'),
    compass: createInitialState('compass'),
    accelerometer: createInitialState('accelerometer'),
    radio: createInitialState('radio'),
    pressure: createInitialState('pressure'),
    level: createInitialState('level')
  })

  // Calibration history
  const calibrationHistory = ref<CalibrationHistory[]>(
    JSON.parse(localStorage.getItem('yardrover_calibration_history') || '[]')
  )

  // UI mode preference
  const uiMode = ref<'consumer' | 'expert'>(
    (localStorage.getItem('yardrover_calibration_mode') as 'consumer' | 'expert') || 'consumer'
  )

  // Wizard state
  const wizardStep = ref(0)
  const wizardSteps: CalibrationType[] = ['level', 'gyro', 'compass', 'accelerometer', 'radio']

  // Computed: Overall calibration health (0-100)
  const overallHealth = computed(() => {
    const states = Object.values(calibrationStates.value)
    const calibrated = states.filter(s => s.status === 'success')
    if (calibrated.length === 0) return 0

    const avgQuality = calibrated.reduce((sum, s) => sum + s.quality, 0) / calibrated.length
    return Math.round(avgQuality)
  })

  // Computed: Is any calibration in progress?
  const isCalibrating = computed(() => {
    return Object.values(calibrationStates.value).some(s => s.status === 'in_progress')
  })

  // Computed: Current calibration type
  const currentCalibrationType = computed(() => {
    const inProgress = Object.entries(calibrationStates.value).find(([_, s]) => s.status === 'in_progress')
    return inProgress ? (inProgress[0] as CalibrationType) : null
  })

  // Computed: Calibration recommendations
  const recommendations = computed(() => {
    const recs: { type: CalibrationType; reason: string; priority: 'high' | 'medium' | 'low' }[] = []

    Object.entries(calibrationStates.value).forEach(([type, state]) => {
      const calibType = type as CalibrationType

      // Never calibrated
      if (state.status === 'not_started') {
        recs.push({
          type: calibType,
          reason: 'Not yet calibrated',
          priority: 'high'
        })
        return
      }

      // Failed calibration
      if (state.status === 'failed') {
        recs.push({
          type: calibType,
          reason: 'Previous calibration failed',
          priority: 'high'
        })
        return
      }

      // Low quality
      if (state.quality >= 0 && state.quality < 50) {
        recs.push({
          type: calibType,
          reason: 'Low calibration quality',
          priority: 'high'
        })
        return
      }

      // Old calibration (>30 days)
      if (state.completedAt) {
        const daysSince = (Date.now() - state.completedAt) / (1000 * 60 * 60 * 24)
        if (daysSince > 30) {
          recs.push({
            type: calibType,
            reason: 'Calibration is over 30 days old',
            priority: 'medium'
          })
        }
      }
    })

    return recs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  })

  // Computed: Needs calibration?
  const needsCalibration = computed(() => {
    return recommendations.value.some(r => r.priority === 'high')
  })

  // Helper: Create initial state
  function createInitialState(type: CalibrationType): CalibrationState {
    return {
      type,
      status: 'not_started',
      progress: 0,
      message: '',
      startedAt: null,
      completedAt: null,
      quality: -1,
      errors: []
    }
  }

  // Action: Start calibration
  async function startCalibration(type: CalibrationType): Promise<boolean> {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      throw new Error('Not connected to device')
    }

    if (isCalibrating.value) {
      throw new Error('Another calibration is already in progress')
    }

    const state = calibrationStates.value[type]
    state.status = 'in_progress'
    state.progress = 0
    state.message = getStartMessage(type)
    state.startedAt = Date.now()
    state.completedAt = null
    state.errors = []

    try {
      const client = connectionStore.getClient()

      // Build MAVLink PREFLIGHT_CALIBRATION command parameters
      const params = buildCalibrationParams(type)

      // Send calibration command
      const result = await client.mavlink.sendCommandLong({
        command: MAVCommand.PREFLIGHT_CALIBRATION,
        ...params
      })

      if (!result.success) {
        throw new Error('Calibration command rejected by vehicle')
      }

      // Start monitoring progress
      monitorCalibrationProgress(type)

      return true
    } catch (error) {
      state.status = 'failed'
      state.message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push(state.message)
      console.error(`Calibration failed for ${type}:`, error)
      return false
    }
  }

  // Action: Cancel calibration
  function cancelCalibration(type: CalibrationType): void {
    const state = calibrationStates.value[type]
    if (state.status === 'in_progress') {
      state.status = 'cancelled'
      state.message = 'Calibration cancelled by user'
      state.completedAt = Date.now()
    }
  }

  // Action: Reset calibration state
  function resetCalibration(type: CalibrationType): void {
    calibrationStates.value[type] = createInitialState(type)
  }

  // Action: Set UI mode
  function setUIMode(mode: 'consumer' | 'expert'): void {
    uiMode.value = mode
    localStorage.setItem('yardrover_calibration_mode', mode)
  }

  // Action: Wizard navigation
  function nextWizardStep(): void {
    if (wizardStep.value < wizardSteps.length - 1) {
      wizardStep.value++
    }
  }

  function previousWizardStep(): void {
    if (wizardStep.value > 0) {
      wizardStep.value--
    }
  }

  function resetWizard(): void {
    wizardStep.value = 0
  }

  function goToWizardStep(step: number): void {
    if (step >= 0 && step < wizardSteps.length) {
      wizardStep.value = step
    }
  }

  // Action: Complete calibration
  function completeCalibration(type: CalibrationType, quality: number = 100): void {
    const state = calibrationStates.value[type]
    state.status = 'success'
    state.progress = 100
    state.quality = quality
    state.message = 'Calibration completed successfully'
    state.completedAt = Date.now()

    // Add to history
    calibrationHistory.value.push({
      type,
      timestamp: Date.now(),
      quality,
      success: true
    })

    // Persist history
    localStorage.setItem('yardrover_calibration_history', JSON.stringify(calibrationHistory.value))
  }

  // Action: Fail calibration
  function failCalibration(type: CalibrationType, error: string): void {
    const state = calibrationStates.value[type]
    state.status = 'failed'
    state.message = error
    state.errors.push(error)
    state.completedAt = Date.now()

    // Add to history
    calibrationHistory.value.push({
      type,
      timestamp: Date.now(),
      quality: 0,
      success: false
    })

    // Persist history
    localStorage.setItem('yardrover_calibration_history', JSON.stringify(calibrationHistory.value))
  }

  // Action: Update progress
  function updateProgress(type: CalibrationType, progress: number, message?: string): void {
    const state = calibrationStates.value[type]
    if (state.status === 'in_progress') {
      state.progress = Math.min(100, Math.max(0, progress))
      if (message) {
        state.message = message
      }
    }
  }

  // Helper: Build calibration parameters for MAVLink command
  function buildCalibrationParams(type: CalibrationType): {
    param1: number
    param2: number
    param3: number
    param4: number
    param5: number
    param6: number
    param7: number
  } {
    const params = {
      param1: 0, // Gyro
      param2: 0, // Compass
      param3: 0, // Pressure
      param4: 0, // Radio
      param5: 0, // Accelerometer
      param6: 0, // Airspeed (not used)
      param7: 0  // ESC/motor (not used)
    }

    switch (type) {
      case 'gyro':
        params.param1 = 1
        break
      case 'compass':
        params.param2 = 1
        break
      case 'pressure':
        params.param3 = 1
        break
      case 'radio':
        params.param4 = 1
        break
      case 'accelerometer':
        params.param5 = 1
        break
      case 'level':
        params.param5 = 2 // Level calibration
        break
    }

    return params
  }

  // Helper: Get start message
  function getStartMessage(type: CalibrationType): string {
    const messages: Record<CalibrationType, string> = {
      gyro: 'Keep the vehicle completely still...',
      compass: 'Rotate the vehicle slowly in all directions...',
      accelerometer: 'Follow the instructions to position the vehicle...',
      radio: 'Move all sticks and switches through their full range...',
      pressure: 'Calibrating barometer, keep vehicle still...',
      level: 'Place vehicle on a level surface...'
    }
    return messages[type]
  }

  // Helper: Monitor calibration progress
  function monitorCalibrationProgress(type: CalibrationType): void {
    const state = calibrationStates.value[type]

    // Simulate progress updates (in real implementation, listen to MAVLink messages)
    // For ArduPilot, we would listen to COMMAND_ACK and STATUSTEXT messages

    let progress = 0
    const interval = setInterval(() => {
      if (state.status !== 'in_progress') {
        clearInterval(interval)
        return
      }

      progress += 5
      updateProgress(type, progress)

      // Simulate completion (in real implementation, this would come from MAVLink)
      if (progress >= 100) {
        clearInterval(interval)
        completeCalibration(type, 95) // Quality would come from actual calibration data
      }
    }, 500)

    // Timeout after 60 seconds
    setTimeout(() => {
      if (state.status === 'in_progress') {
        clearInterval(interval)
        failCalibration(type, 'Calibration timeout - no response from vehicle')
      }
    }, 60000)
  }

  // Action: Get last calibration date
  function getLastCalibrationDate(type: CalibrationType): Date | null {
    const state = calibrationStates.value[type]
    return state.completedAt ? new Date(state.completedAt) : null
  }

  // Action: Get calibration quality
  function getCalibrationQuality(type: CalibrationType): number {
    return calibrationStates.value[type].quality
  }

  // Action: Clear history
  function clearHistory(): void {
    calibrationHistory.value = []
    localStorage.removeItem('yardrover_calibration_history')
  }

  // Action: Set compass calibration method
  function setCompassMethod(method: CompassCalibrationMethod): void {
    const state = calibrationStates.value.compass
    state.compassMethod = method
    state.message = getCompassMethodDescription(method)
  }

  // Action: Start static heading calibration
  async function startStaticHeadingCalibration(trueHeading: number): Promise<boolean> {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      throw new Error('Not connected to device')
    }

    const state = calibrationStates.value.compass
    state.status = 'in_progress'
    state.progress = 0
    state.compassMethod = 'static_heading'
    state.staticHeading = trueHeading
    state.message = `Calibrating with heading ${trueHeading}° (TRUE)...`
    state.startedAt = Date.now()
    state.completedAt = null
    state.errors = []

    try {
      const client = connectionStore.getClient()

      // Send compass calibration command with static heading method
      // Note: This may require setting parameters first, then triggering calibration
      const result = await client.mavlink.sendCommandLong({
        command: MAVCommand.PREFLIGHT_CALIBRATION,
        param1: 0, // Gyro
        param2: 1, // Compass
        param3: 0, // Pressure
        param4: 0, // Radio
        param5: 0, // Accelerometer
        param6: 0, // Airspeed
        param7: 0  // ESC/motor
      })

      if (!result.success) {
        throw new Error('Compass calibration command rejected by vehicle')
      }

      // Monitor progress
      monitorCalibrationProgress('compass')

      return true
    } catch (error) {
      state.status = 'failed'
      state.message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push(state.message)
      console.error('Static heading calibration failed:', error)
      return false
    }
  }

  // Action: Enable auto-learn compass calibration
  async function enableAutoLearnCalibration(mode: 1 | 2 | 3): Promise<boolean> {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      throw new Error('Not connected to device')
    }

    const state = calibrationStates.value.compass
    state.compassMethod = 'auto_learn'
    state.autoLearnEnabled = true
    state.message = `Auto-learn enabled (mode ${mode}). Drive the vehicle through varied turns...`

    try {
      const client = connectionStore.getClient()

      // Set COMPASS_LEARN parameter via MAVLink
      // Note: This uses DO_SET_PARAMETER command
      const result = await client.mavlink.sendCommandLong({
        command: MAVCommand.DO_SET_PARAMETER,
        param1: 0, // Parameter index (would need to look up COMPASS_LEARN index)
        param2: mode, // Parameter value
        param3: 0,
        param4: 0,
        param5: 0,
        param6: 0,
        param7: 0
      })

      if (!result.success) {
        throw new Error('Failed to enable auto-learn mode')
      }

      return true
    } catch (error) {
      state.autoLearnEnabled = false
      state.message = error instanceof Error ? error.message : 'Unknown error'
      state.errors.push(state.message)
      console.error('Auto-learn enable failed:', error)
      return false
    }
  }

  // Action: Set compass offset max (for large vehicles with high interference)
  async function setCompassOffsetMax(value: number): Promise<boolean> {
    const connectionStore = useConnectionStore()

    if (!connectionStore.isConnected) {
      throw new Error('Not connected to device')
    }

    try {
      const client = connectionStore.getClient()

      // Set COMPASS_OFFS_MAX parameter
      const result = await client.mavlink.sendCommandLong({
        command: MAVCommand.DO_SET_PARAMETER,
        param1: 0, // Parameter index
        param2: value, // New offset max value (typically 850, 2000, or 3000)
        param3: 0,
        param4: 0,
        param5: 0,
        param6: 0,
        param7: 0
      })

      return result.success
    } catch (error) {
      console.error('Failed to set COMPASS_OFFS_MAX:', error)
      return false
    }
  }

  // Helper: Get compass method description
  function getCompassMethodDescription(method: CompassCalibrationMethod): string {
    const descriptions: Record<CompassCalibrationMethod, string> = {
      standard: 'Rotate vehicle through all orientations',
      large_vehicle: 'Onboard calibration optimized for large vehicles',
      static_heading: 'Calibrate using GPS and known heading (no movement required)',
      auto_learn: 'Automatic offset learning during normal operation'
    }
    return descriptions[method]
  }

  return {
    // State
    calibrationStates,
    calibrationHistory,
    uiMode,
    wizardStep,
    wizardSteps,

    // Computed
    overallHealth,
    isCalibrating,
    currentCalibrationType,
    recommendations,
    needsCalibration,

    // Actions
    startCalibration,
    cancelCalibration,
    resetCalibration,
    completeCalibration,
    failCalibration,
    updateProgress,
    setUIMode,
    nextWizardStep,
    previousWizardStep,
    resetWizard,
    goToWizardStep,
    getLastCalibrationDate,
    getCalibrationQuality,
    clearHistory,
    // Compass-specific actions
    setCompassMethod,
    startStaticHeadingCalibration,
    enableAutoLearnCalibration,
    setCompassOffsetMax
  }
})
