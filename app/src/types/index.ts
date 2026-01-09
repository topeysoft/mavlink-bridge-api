// YardRover TypeScript Type Definitions

export interface Zone {
  id: string
  name: string
  type: 'mowing' | 'exclusion' | 'charging'
  coordinates: Array<[number, number]>
  color: string
  area: number
  description?: string
  tags?: string[]
  created: string
  lastModified: string
  settings?: {
    pattern?: 'parallel' | 'spiral' | 'random'
    overlap?: number
    speed?: number
  }
}

// Import Mission type from client library (matches API spec ScheduledMission)
export type { Mission } from '../../../client/dist/index'

// Import peripheral types from client library
export type {
  Peripheral,
  PeripheralType,
  PeripheralState,
  PeripheralHealth,
  PeripheralMetadata,
  PeripheralStatus,
  PeripheralTelemetry,
  PeripheralCapability,
  PeripheralCompatibilityRule
} from '../../../client/dist/index'

export interface MAVLinkMessage {
  id: number
  timestamp: string
  type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details?: Record<string, any>
}

export interface TelemetryData {
  timestamp: string
  position: {
    lat: number
    lng: number
    alt: number
  }
  speed: number
  heading: number
  battery: number
  temperature: number
  mode: string
  armed: boolean
}

export interface SystemHealth {
  cpu: number
  memory: number
  temperature: number
  uptime: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface Activity {
  id: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  description: string
  icon?: string
}

export type ViewName = 'connect' | 'dashboard' | 'peripherals' | 'zones' | 'missions' | 'control' | 'monitoring' | 'schedule' | 'logs' | 'calibration' | 'rtcm' | 'parameters' | 'geofencing' | 'rally-points' | 'battery' | 'weather' | 'settings'

export type Theme = 'light' | 'dark'
