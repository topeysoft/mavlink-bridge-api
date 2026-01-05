// YardRover Battery Management Type Definitions

export type BatteryHealth = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
export type BatteryStatus = 'charging' | 'discharging' | 'full' | 'idle' | 'fault'
export type ChargingState = 'not-charging' | 'pre-charging' | 'fast-charging' | 'trickle-charging' | 'complete'

export interface BatterySnapshot {
  timestamp: string
  voltage: number // Volts
  current: number // Amps (positive = discharging, negative = charging)
  percent: number // 0-100
  temperature: number // Celsius
  powerDraw: number // Watts
  status: BatteryStatus
}

export interface BatteryCell {
  index: number
  voltage: number // Volts
  health: BatteryHealth
}

export interface BatteryInfo {
  // Current state
  voltage: number
  current: number
  percent: number
  temperature: number
  powerDraw: number
  status: BatteryStatus
  health: BatteryHealth

  // Battery specs
  capacity: number // Amp-hours
  designVoltage: number // Volts
  cellCount: number
  chemistry: string // 'LiPo', 'Li-ion', 'LiFePO4', etc.

  // Cell information
  cells?: BatteryCell[]

  // Charging info
  chargingState: ChargingState
  timeToEmpty?: number // minutes
  timeToFull?: number // minutes

  // Health metrics
  cycleCount: number
  capacityRemaining: number // mAh
  capacityFull: number // mAh (current full capacity, degrades over time)
  capacityDesign: number // mAh (original design capacity)
  healthPercent: number // 0-100

  // Timestamps
  lastCharged?: string
  lastUpdate: string
}

export interface BatteryEvent {
  id: string
  timestamp: string
  type: 'low-battery' | 'critical-battery' | 'charging-started' | 'charging-complete' | 'fault' | 'temperature-warning' | 'auto-return'
  severity: 'info' | 'warning' | 'critical'
  message: string
  batteryPercent: number
  voltage: number
  metadata?: Record<string, any>
}

export interface ChargeSession {
  id: string
  startTime: string
  endTime?: string
  startPercent: number
  endPercent?: number
  startVoltage: number
  endVoltage?: number
  energyAdded?: number // Wh
  duration?: number // minutes
  interrupted: boolean
}

export interface BatteryStats {
  // Current
  currentVoltage: number
  currentPercent: number
  currentHealth: BatteryHealth
  status: BatteryStatus

  // Usage
  totalCycles: number
  totalEnergyConsumed: number // Wh
  totalChargeSessions: number
  averageDischargeRate: number // Watts

  // Health
  healthPercent: number
  capacityDegradation: number // Percent lost from design capacity
  estimatedRemainingLife: number // Estimated cycles remaining

  // Predictions
  estimatedRuntime?: number // minutes at current load
  estimatedRangeKm?: number // estimated range in kilometers
}

export interface BatterySettings {
  // Thresholds
  lowBatteryPercent: number // Trigger warning
  criticalBatteryPercent: number // Trigger auto-return
  highTemperatureC: number // Temperature warning threshold
  criticalTemperatureC: number // Temperature critical threshold

  // Auto-return settings
  autoReturnEnabled: boolean
  autoReturnThreshold: number // Percent
  autoReturnDestination: 'home' | 'rally' | 'nearest-charger'

  // Charging optimization
  chargeToPercent: number // Stop charging at this percent
  maintainMinPercent: number // Don't discharge below this

  // Notifications
  notifyLowBattery: boolean
  notifyCriticalBattery: boolean
  notifyChargingComplete: boolean
  notifyTemperatureWarning: boolean
}

export interface BatteryAlert {
  id: string
  timestamp: string
  type: 'low' | 'critical' | 'temperature' | 'fault'
  message: string
  acknowledged: boolean
  acknowledgedAt?: string
}
