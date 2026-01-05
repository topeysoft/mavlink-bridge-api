import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  BatteryInfo,
  BatterySnapshot,
  BatteryEvent,
  ChargeSession,
  BatteryStats,
  BatterySettings,
  BatteryHealth,
  BatteryStatus,
  BatteryAlert
} from '@/types/battery'

export const useBatteryStore = defineStore('battery', () => {
  // State
  const batteryInfo = ref<BatteryInfo>({
    voltage: 0,
    current: 0,
    percent: 0,
    temperature: 25,
    powerDraw: 0,
    status: 'idle',
    health: 'good',
    capacity: 10, // 10 Ah default
    designVoltage: 24, // 24V default
    cellCount: 6,
    chemistry: 'LiPo',
    chargingState: 'not-charging',
    cycleCount: 0,
    capacityRemaining: 10000,
    capacityFull: 10000,
    capacityDesign: 10000,
    healthPercent: 100,
    lastUpdate: new Date().toISOString()
  })

  const history = ref<BatterySnapshot[]>([])
  const events = ref<BatteryEvent[]>([])
  const chargeSessions = ref<ChargeSession[]>([])
  const alerts = ref<BatteryAlert[]>([])

  const settings = ref<BatterySettings>({
    lowBatteryPercent: 30,
    criticalBatteryPercent: 15,
    highTemperatureC: 45,
    criticalTemperatureC: 60,
    autoReturnEnabled: true,
    autoReturnThreshold: 20,
    autoReturnDestination: 'rally',
    chargeToPercent: 100,
    maintainMinPercent: 10,
    notifyLowBattery: true,
    notifyCriticalBattery: true,
    notifyChargingComplete: true,
    notifyTemperatureWarning: true
  })

  const isMonitoring = ref(false)
  const activeChargeSession = ref<ChargeSession | null>(null)

  // Load from localStorage
  const loadFromStorage = () => {
    const storedSettings = localStorage.getItem('yardrover_battery_settings')
    if (storedSettings) {
      try {
        settings.value = JSON.parse(storedSettings)
      } catch (error) {
        console.error('Failed to load battery settings:', error)
      }
    }

    const storedHistory = localStorage.getItem('yardrover_battery_history')
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory)
        // Keep only last 1000 entries
        history.value = parsed.slice(-1000)
      } catch (error) {
        console.error('Failed to load battery history:', error)
      }
    }

    const storedEvents = localStorage.getItem('yardrover_battery_events')
    if (storedEvents) {
      try {
        const parsed = JSON.parse(storedEvents)
        events.value = parsed.slice(-500)
      } catch (error) {
        console.error('Failed to load battery events:', error)
      }
    }

    const storedSessions = localStorage.getItem('yardrover_charge_sessions')
    if (storedSessions) {
      try {
        chargeSessions.value = JSON.parse(storedSessions)
      } catch (error) {
        console.error('Failed to load charge sessions:', error)
      }
    }
  }

  // Save to localStorage
  const saveSettings = () => {
    localStorage.setItem('yardrover_battery_settings', JSON.stringify(settings.value))
  }

  const saveHistory = () => {
    localStorage.setItem('yardrover_battery_history', JSON.stringify(history.value.slice(-1000)))
  }

  const saveEvents = () => {
    localStorage.setItem('yardrover_battery_events', JSON.stringify(events.value.slice(-500)))
  }

  const saveSessions = () => {
    localStorage.setItem('yardrover_charge_sessions', JSON.stringify(chargeSessions.value))
  }

  // Computed
  const batteryHealth = computed<BatteryHealth>(() => {
    if (batteryInfo.value.healthPercent >= 90) return 'excellent'
    if (batteryInfo.value.healthPercent >= 75) return 'good'
    if (batteryInfo.value.healthPercent >= 50) return 'fair'
    if (batteryInfo.value.healthPercent >= 25) return 'poor'
    return 'critical'
  })

  const isLowBattery = computed(() =>
    batteryInfo.value.percent <= settings.value.lowBatteryPercent &&
    batteryInfo.value.percent > settings.value.criticalBatteryPercent
  )

  const isCriticalBattery = computed(() =>
    batteryInfo.value.percent <= settings.value.criticalBatteryPercent
  )

  const isHighTemperature = computed(() =>
    batteryInfo.value.temperature >= settings.value.highTemperatureC &&
    batteryInfo.value.temperature < settings.value.criticalTemperatureC
  )

  const isCriticalTemperature = computed(() =>
    batteryInfo.value.temperature >= settings.value.criticalTemperatureC
  )

  const stats = computed<BatteryStats>(() => {
    const totalEnergy = history.value.reduce((sum, snap) => sum + snap.powerDraw, 0) / 60 // Wh
    const avgDischargeRate = history.value.length > 0
      ? history.value.reduce((sum, snap) => sum + (snap.current > 0 ? snap.powerDraw : 0), 0) / history.value.length
      : 0

    const estimatedRuntime = batteryInfo.value.powerDraw > 0
      ? (batteryInfo.value.capacityRemaining / 1000) / (batteryInfo.value.current > 0 ? batteryInfo.value.current : 1) * 60
      : undefined

    return {
      currentVoltage: batteryInfo.value.voltage,
      currentPercent: batteryInfo.value.percent,
      currentHealth: batteryHealth.value,
      status: batteryInfo.value.status,
      totalCycles: batteryInfo.value.cycleCount,
      totalEnergyConsumed: totalEnergy,
      totalChargeSessions: chargeSessions.value.length,
      averageDischargeRate: avgDischargeRate,
      healthPercent: batteryInfo.value.healthPercent,
      capacityDegradation: ((batteryInfo.value.capacityDesign - batteryInfo.value.capacityFull) / batteryInfo.value.capacityDesign) * 100,
      estimatedRemainingLife: Math.max(0, 500 - batteryInfo.value.cycleCount),
      estimatedRuntime
    }
  })

  const recentEvents = computed(() => events.value.slice(-10).reverse())
  const unacknowledgedAlerts = computed(() => alerts.value.filter(a => !a.acknowledged))

  // Actions
  function updateBatteryState(
    voltage: number,
    current: number,
    percent: number,
    temperature: number
  ) {
    const previousPercent = batteryInfo.value.percent
    const previousStatus = batteryInfo.value.status

    batteryInfo.value.voltage = voltage
    batteryInfo.value.current = current
    batteryInfo.value.percent = Math.max(0, Math.min(100, percent))
    batteryInfo.value.temperature = temperature
    batteryInfo.value.powerDraw = voltage * Math.abs(current)
    batteryInfo.value.lastUpdate = new Date().toISOString()

    // Determine status
    if (current < -0.1) {
      batteryInfo.value.status = 'charging'
      batteryInfo.value.chargingState = percent >= 99 ? 'complete' : 'fast-charging'
    } else if (current > 0.1) {
      batteryInfo.value.status = 'discharging'
      batteryInfo.value.chargingState = 'not-charging'
    } else if (percent >= 99) {
      batteryInfo.value.status = 'full'
      batteryInfo.value.chargingState = 'not-charging'
    } else {
      batteryInfo.value.status = 'idle'
      batteryInfo.value.chargingState = 'not-charging'
    }

    // Update health
    batteryInfo.value.health = batteryHealth.value
    batteryInfo.value.capacityRemaining = (percent / 100) * batteryInfo.value.capacityFull

    // Record snapshot if monitoring
    if (isMonitoring.value) {
      recordSnapshot()
    }

    // Check for state changes and trigger events
    checkBatteryConditions(previousPercent, previousStatus)
  }

  function recordSnapshot() {
    const snapshot: BatterySnapshot = {
      timestamp: new Date().toISOString(),
      voltage: batteryInfo.value.voltage,
      current: batteryInfo.value.current,
      percent: batteryInfo.value.percent,
      temperature: batteryInfo.value.temperature,
      powerDraw: batteryInfo.value.powerDraw,
      status: batteryInfo.value.status
    }

    history.value.push(snapshot)

    // Keep only last 1000 entries
    if (history.value.length > 1000) {
      history.value = history.value.slice(-1000)
    }

    saveHistory()
  }

  function checkBatteryConditions(previousPercent: number, previousStatus: BatteryStatus) {
    // Low battery warning
    if (isLowBattery.value && previousPercent > settings.value.lowBatteryPercent) {
      recordEvent('low-battery', 'warning', `Battery low: ${batteryInfo.value.percent}%`)
      if (settings.value.notifyLowBattery) {
        createAlert('low', `Battery at ${batteryInfo.value.percent.toFixed(0)}%`)
        // Dispatch browser notification event
        window.dispatchEvent(new CustomEvent('battery-notification', {
          detail: {
            type: 'warning',
            message: `Battery Low: ${batteryInfo.value.percent.toFixed(0)}%`,
            severity: 'low'
          }
        }))
      }
    }

    // Critical battery
    if (isCriticalBattery.value && previousPercent > settings.value.criticalBatteryPercent) {
      recordEvent('critical-battery', 'critical', `Critical battery: ${batteryInfo.value.percent}%`)
      if (settings.value.notifyCriticalBattery) {
        createAlert('critical', `Critical battery: ${batteryInfo.value.percent.toFixed(0)}%`)
        // Dispatch browser notification event
        window.dispatchEvent(new CustomEvent('battery-notification', {
          detail: {
            type: 'error',
            message: `CRITICAL: Battery at ${batteryInfo.value.percent.toFixed(0)}%`,
            severity: 'critical'
          }
        }))
      }

      // Trigger auto-return if enabled
      if (settings.value.autoReturnEnabled && batteryInfo.value.percent <= settings.value.autoReturnThreshold) {
        triggerAutoReturn()
      }
    }

    // Temperature warnings
    if (isHighTemperature.value && batteryInfo.value.temperature >= settings.value.highTemperatureC && (batteryInfo.value.temperature - 1) < settings.value.highTemperatureC) {
      recordEvent('temperature-warning', 'warning', `High temperature: ${batteryInfo.value.temperature}°C`)
      if (settings.value.notifyTemperatureWarning) {
        createAlert('temperature', `Battery temperature high: ${batteryInfo.value.temperature.toFixed(1)}°C`)
        window.dispatchEvent(new CustomEvent('battery-notification', {
          detail: {
            type: 'warning',
            message: `High Battery Temperature: ${batteryInfo.value.temperature.toFixed(1)}°C`,
            severity: 'high-temp'
          }
        }))
      }
    }

    if (isCriticalTemperature.value && batteryInfo.value.temperature >= settings.value.criticalTemperatureC && (batteryInfo.value.temperature - 1) < settings.value.criticalTemperatureC) {
      recordEvent('temperature-warning', 'critical', `Critical temperature: ${batteryInfo.value.temperature}°C`)
      createAlert('temperature', `CRITICAL: Battery temperature: ${batteryInfo.value.temperature.toFixed(1)}°C`)
      window.dispatchEvent(new CustomEvent('battery-notification', {
        detail: {
          type: 'error',
          message: `CRITICAL: Battery Temperature ${batteryInfo.value.temperature.toFixed(1)}°C`,
          severity: 'critical-temp'
        }
      }))
    }

    // Charging state changes
    if (batteryInfo.value.status === 'charging' && previousStatus !== 'charging') {
      startChargeSession()
      recordEvent('charging-started', 'info', 'Charging started')
    }

    if (batteryInfo.value.status === 'full' && previousStatus === 'charging') {
      endChargeSession(false)
      recordEvent('charging-complete', 'info', 'Charging complete')
      if (settings.value.notifyChargingComplete) {
        createAlert('low', 'Charging complete')
        window.dispatchEvent(new CustomEvent('battery-notification', {
          detail: {
            type: 'success',
            message: 'Battery charging complete',
            severity: 'info'
          }
        }))
      }
    }

    if (batteryInfo.value.status !== 'charging' && previousStatus === 'charging' && batteryInfo.value.status !== 'full') {
      endChargeSession(true)
    }
  }

  function recordEvent(
    type: BatteryEvent['type'],
    severity: BatteryEvent['severity'],
    message: string,
    metadata?: Record<string, any>
  ) {
    const event: BatteryEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      batteryPercent: batteryInfo.value.percent,
      voltage: batteryInfo.value.voltage,
      metadata
    }

    events.value.push(event)
    saveEvents()
  }

  function createAlert(type: BatteryAlert['type'], message: string) {
    const alert: BatteryAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      acknowledged: false
    }

    alerts.value.push(alert)
  }

  function acknowledgeAlert(id: string) {
    const alert = alerts.value.find(a => a.id === id)
    if (alert) {
      alert.acknowledged = true
      alert.acknowledgedAt = new Date().toISOString()
    }
  }

  function clearAcknowledgedAlerts() {
    alerts.value = alerts.value.filter(a => !a.acknowledged)
  }

  function triggerAutoReturn() {
    recordEvent('auto-return', 'critical', 'Auto-return triggered due to low battery')

    // Dispatch event for auto-return (handled by rally store or vehicle store)
    window.dispatchEvent(new CustomEvent('battery-auto-return', {
      detail: {
        reason: 'low-battery',
        batteryPercent: batteryInfo.value.percent,
        destination: settings.value.autoReturnDestination
      }
    }))
  }

  function startChargeSession() {
    activeChargeSession.value = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      startPercent: batteryInfo.value.percent,
      startVoltage: batteryInfo.value.voltage,
      interrupted: false
    }
  }

  function endChargeSession(interrupted: boolean) {
    if (!activeChargeSession.value) return

    const duration = (new Date().getTime() - new Date(activeChargeSession.value.startTime).getTime()) / 1000 / 60

    activeChargeSession.value.endTime = new Date().toISOString()
    activeChargeSession.value.endPercent = batteryInfo.value.percent
    activeChargeSession.value.endVoltage = batteryInfo.value.voltage
    activeChargeSession.value.duration = duration
    activeChargeSession.value.interrupted = interrupted

    // Calculate energy added (rough estimate)
    const percentGained = batteryInfo.value.percent - activeChargeSession.value.startPercent
    const energyAdded = (percentGained / 100) * batteryInfo.value.capacity * batteryInfo.value.designVoltage

    activeChargeSession.value.energyAdded = energyAdded

    chargeSessions.value.push(activeChargeSession.value)
    saveSessions()

    activeChargeSession.value = null

    // Increment cycle count if charged significantly
    if (percentGained > 80) {
      batteryInfo.value.cycleCount++
    }
  }

  function updateSettings(updates: Partial<BatterySettings>) {
    settings.value = { ...settings.value, ...updates }
    saveSettings()
  }

  function startMonitoring() {
    isMonitoring.value = true
  }

  function stopMonitoring() {
    isMonitoring.value = false
  }

  function clearHistory() {
    history.value = []
    saveHistory()
  }

  function clearEvents() {
    events.value = []
    saveEvents()
  }

  function exportData(): string {
    return JSON.stringify({
      batteryInfo: batteryInfo.value,
      settings: settings.value,
      history: history.value,
      events: events.value,
      chargeSessions: chargeSessions.value
    }, null, 2)
  }

  // Initialize
  loadFromStorage()

  return {
    // State
    batteryInfo,
    history,
    events,
    chargeSessions,
    alerts,
    settings,
    isMonitoring,
    activeChargeSession,

    // Computed
    batteryHealth,
    isLowBattery,
    isCriticalBattery,
    isHighTemperature,
    isCriticalTemperature,
    stats,
    recentEvents,
    unacknowledgedAlerts,

    // Actions
    updateBatteryState,
    recordSnapshot,
    recordEvent,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    updateSettings,
    startMonitoring,
    stopMonitoring,
    clearHistory,
    clearEvents,
    exportData
  }
})
