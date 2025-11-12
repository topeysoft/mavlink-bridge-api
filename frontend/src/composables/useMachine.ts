import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMachineStore } from '@/stores/machine'
import { useNotificationsStore } from '@/stores/notifications'
import type { MachineStatus } from '@/stores/types'

export interface StartOptions {
  mode?: 'mowing' | 'snow' | 'leaf' | 'towing' | 'patrol' | 'manual'
  zones?: string[]
  parameters?: Record<string, any>
}

export interface MachineOperationResult {
  success: boolean
  error?: Error | string
  data?: any
}

export function useMachine(machineId?: string) {
  const machineStore = useMachineStore()
  const notificationsStore = useNotificationsStore()
  
  const {
    activeMachine,
    machineList,
    isOperational,
    batteryPercentage,
    isLowBattery,
    isCriticalBattery,
    currentMode,
    machineErrors,
    hasCriticalErrors,
    isRunning,
    isPaused,
    canStart,
    canStop,
    isLoading,
    hasError,
    currentTask,
    taskProgress
  } = storeToRefs(machineStore)
  
  const selectedMachineId = ref<string | null>(machineId || null)
  const operationInProgress = ref(false)
  const lastError = ref<Error | null>(null)
  
  // Computed properties
  const targetMachine = computed(() => {
    if (selectedMachineId.value) {
      return machineStore.machines.get(selectedMachineId.value) || null
    }
    return activeMachine.value
  })
  
  const batteryStatus = computed(() => {
    const machine = targetMachine.value
    if (!machine) return { level: 0, status: 'unknown' as const }
    
    const level = machine.batteryLevel
    let status: 'critical' | 'low' | 'normal' | 'good' | 'excellent' = 'normal'
    
    if (level <= 5) status = 'critical'
    else if (level <= 20) status = 'low'
    else if (level <= 50) status = 'normal'
    else if (level <= 80) status = 'good'
    else status = 'excellent'
    
    return { level, status }
  })
  
  const machineHealth = computed(() => {
    const machine = targetMachine.value
    if (!machine) return { healthy: false, score: 0, issues: [] }
    
    const issues = []
    let score = 100
    
    // Check battery
    if (machine.batteryLevel <= 5) {
      issues.push('Critical battery level')
      score -= 50
    } else if (machine.batteryLevel <= 20) {
      issues.push('Low battery level')
      score -= 20
    }
    
    // Check errors
    const criticalErrors = machine.errors.filter(e => !e.resolved && e.severity === 'critical')
    const highErrors = machine.errors.filter(e => !e.resolved && e.severity === 'high')
    const mediumErrors = machine.errors.filter(e => !e.resolved && e.severity === 'medium')
    
    score -= criticalErrors.length * 30
    score -= highErrors.length * 15
    score -= mediumErrors.length * 10
    
    if (criticalErrors.length > 0) {
      issues.push(`${criticalErrors.length} critical error(s)`)
    }
    if (highErrors.length > 0) {
      issues.push(`${highErrors.length} high severity error(s)`)
    }
    
    // Check temperature
    if (machine.temperature > 80) {
      issues.push('High temperature')
      score -= 15
    }
    
    // Check last seen
    const lastSeenTime = new Date(machine.lastSeen).getTime()
    const now = Date.now()
    const minutesSinceLastSeen = (now - lastSeenTime) / (1000 * 60)
    
    if (minutesSinceLastSeen > 5) {
      issues.push('Lost communication')
      score -= 25
    }
    
    return {
      healthy: score >= 70,
      score: Math.max(0, score),
      issues
    }
  })
  
  const canOperate = computed(() => {
    const machine = targetMachine.value
    if (!machine) return false
    
    return machine.batteryLevel > 5 && 
           !hasCriticalErrors.value && 
           machine.status !== 'error' && 
           machine.status !== 'maintenance'
  })
  
  // Machine operation methods
  async function start(options: StartOptions = {}): Promise<MachineOperationResult> {
    if (!canOperate.value) {
      const error = 'Machine cannot be started due to safety conditions'
      return { success: false, error }
    }
    
    operationInProgress.value = true
    lastError.value = null
    
    try {
      const parameters = {
        mode: options.mode || 'manual',
        zones: options.zones || [],
        ...options.parameters
      }
      
      await machineStore.startMachine(selectedMachineId.value || undefined, parameters)
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Machine Started',
        message: `${targetMachine.value?.name || 'Machine'} has been started successfully`,
        timestamp: new Date().toISOString()
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      
      notificationsStore.addNotification({
        type: 'error',
        title: 'Start Failed',
        message: (error as Error).message || 'Failed to start machine',
        timestamp: new Date().toISOString()
      })
      
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function stop(): Promise<MachineOperationResult> {
    operationInProgress.value = true
    lastError.value = null
    
    try {
      await machineStore.stopMachine(selectedMachineId.value || undefined)
      
      notificationsStore.addNotification({
        type: 'info',
        title: 'Machine Stopped',
        message: `${targetMachine.value?.name || 'Machine'} has been stopped`,
        timestamp: new Date().toISOString()
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function pause(): Promise<MachineOperationResult> {
    operationInProgress.value = true
    lastError.value = null
    
    try {
      await machineStore.pauseMachine(selectedMachineId.value || undefined)
      
      notificationsStore.addNotification({
        type: 'info',
        title: 'Machine Paused',
        message: `${targetMachine.value?.name || 'Machine'} has been paused`,
        timestamp: new Date().toISOString()
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function resume(): Promise<MachineOperationResult> {
    operationInProgress.value = true
    lastError.value = null
    
    try {
      await machineStore.resumeMachine(selectedMachineId.value || undefined)
      
      notificationsStore.addNotification({
        type: 'success',
        title: 'Machine Resumed',
        message: `${targetMachine.value?.name || 'Machine'} has been resumed`,
        timestamp: new Date().toISOString()
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function emergencyStop(): Promise<MachineOperationResult> {
    operationInProgress.value = true
    lastError.value = null
    
    try {
      await machineStore.emergencyStop(selectedMachineId.value || undefined)
      
      notificationsStore.addNotification({
        type: 'warning',
        title: 'Emergency Stop',
        message: `${targetMachine.value?.name || 'Machine'} has been emergency stopped`,
        timestamp: new Date().toISOString(),
        persistent: true
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function returnHome(): Promise<MachineOperationResult> {
    operationInProgress.value = true
    lastError.value = null
    
    try {
      await machineStore.returnHome(selectedMachineId.value || undefined)
      
      notificationsStore.addNotification({
        type: 'info',
        title: 'Return Home',
        message: `${targetMachine.value?.name || 'Machine'} is returning home`,
        timestamp: new Date().toISOString()
      })
      
      return { success: true }
    } catch (error) {
      lastError.value = error as Error
      return { success: false, error }
    } finally {
      operationInProgress.value = false
    }
  }
  
  async function setMode(mode: StartOptions['mode']): Promise<MachineOperationResult> {
    if (!mode) return { success: false, error: 'Mode is required' }
    
    // If machine is running, we need to restart with new mode
    if (isRunning.value) {
      return await start({ mode })
    }
    
    return { success: true }
  }
  
  async function acknowledgeError(errorId: string): Promise<MachineOperationResult> {
    try {
      await machineStore.acknowledgeError(errorId)
      return { success: true }
    } catch (error) {
      return { success: false, error }
    }
  }
  
  function selectMachine(machineId: string) {
    selectedMachineId.value = machineId
    machineStore.setActiveMachine(machineId)
  }
  
  function clearMachineSelection() {
    selectedMachineId.value = null
  }
  
  // Auto-stop on critical conditions
  const criticalBatteryWatcher = watch(
    () => targetMachine.value?.batteryLevel,
    (newBattery) => {
      if (newBattery !== undefined && newBattery <= 3 && isRunning.value) {
        notificationsStore.addNotification({
          type: 'error',
          title: 'Critical Battery',
          message: 'Machine stopped due to critical battery level',
          timestamp: new Date().toISOString(),
          persistent: true
        })
        
        emergencyStop()
      }
    }
  )
  
  // Watch for critical errors and stop if needed
  const criticalErrorWatcher = watch(
    hasCriticalErrors,
    (hasCritical) => {
      if (hasCritical && isRunning.value) {
        notificationsStore.addNotification({
          type: 'error',
          title: 'Critical Error',
          message: 'Machine stopped due to critical error',
          timestamp: new Date().toISOString(),
          persistent: true
        })
        
        emergencyStop()
      }
    }
  )
  
  // Cleanup watchers
  onUnmounted(() => {
    criticalBatteryWatcher()
    criticalErrorWatcher()
  })
  
  // Initialize
  onMounted(() => {
    if (selectedMachineId.value) {
      machineStore.setActiveMachine(selectedMachineId.value)
    }
  })
  
  return {
    // State
    targetMachine,
    selectedMachineId: computed(() => selectedMachineId.value),
    operationInProgress: computed(() => operationInProgress.value),
    lastError: computed(() => lastError.value),
    
    // Store state (reactive)
    activeMachine,
    machineList,
    isOperational,
    batteryPercentage,
    isLowBattery,
    isCriticalBattery,
    currentMode,
    machineErrors,
    hasCriticalErrors,
    isRunning,
    isPaused,
    canStart,
    canStop,
    isLoading,
    hasError,
    currentTask,
    taskProgress,
    
    // Computed properties
    batteryStatus,
    machineHealth,
    canOperate,
    
    // Methods
    start,
    stop,
    pause,
    resume,
    emergencyStop,
    returnHome,
    setMode,
    acknowledgeError,
    selectMachine,
    clearMachineSelection,
    
    // Store methods
    fetchStatus: () => machineStore.fetchMachineStatus(selectedMachineId.value || undefined),
    fetchCurrentTask: () => machineStore.fetchCurrentTask(selectedMachineId.value || undefined),
    getLocationHistory: (hours?: number) => machineStore.getLocationHistory(selectedMachineId.value || undefined, hours),
    clearError: machineStore.clearError
  }
}