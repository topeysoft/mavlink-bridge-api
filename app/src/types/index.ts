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

export interface Mission {
  id: string
  name: string
  zones: string[]
  attachment: string
  schedule?: {
    type: 'once' | 'recurring'
    startTime: string
    endTime?: string
    days?: string[]
  }
  status: 'pending' | 'active' | 'completed' | 'failed' | 'postponed'
  progress?: number
  created: string
  lastRun?: string
  postponedReason?: string
  postponedUntil?: string
  weatherSafetyEnabled?: boolean
}

export interface Attachment {
  id: string
  name: string
  type: string
  status: 'available' | 'active' | 'maintenance'
  hours: number
  lastService?: string
}

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

export type ViewName = 'connect' | 'dashboard' | 'attachments' | 'zones' | 'missions' | 'control' | 'monitoring' | 'schedule' | 'logs' | 'parameters' | 'geofencing' | 'rally-points' | 'battery' | 'weather' | 'settings'

export type Theme = 'light' | 'dark'
