// YardRover Rally Point Type Definitions

export type RallyPointPriority = 'primary' | 'secondary' | 'tertiary'
export type RallyPointStatus = 'active' | 'inactive' | 'in-use'

export interface RallyPoint {
  id: string
  name: string
  position: {
    lat: number
    lng: number
    alt: number // altitude in meters
  }
  priority: RallyPointPriority
  status: RallyPointStatus
  enabled: boolean

  // Rally point configuration
  config: {
    landImmediately: boolean // Land at rally point vs. loiter
    loiterRadius?: number // Radius in meters for loiter pattern
    loiterAltitude?: number // Altitude for loitering
    approachAltitude?: number // Altitude for approach
  }

  // Metadata
  description?: string
  color: string
  created: string
  lastModified: string
  lastUsed?: string

  // Usage statistics
  stats?: {
    timesUsed: number
    lastReturnReason?: string
  }
}

export interface RallyPointUsage {
  id: string
  rallyPointId: string
  rallyPointName: string
  timestamp: string
  reason: 'manual' | 'low-battery' | 'geofence-breach' | 'emergency' | 'failsafe'
  vehiclePosition: {
    lat: number
    lng: number
    alt: number
  }
  completed: boolean
  completedAt?: string
}

export interface RallyPointStats {
  totalRallyPoints: number
  activeRallyPoints: number
  primaryRallyPoint?: RallyPoint
  totalUsages: number
  lastUsage?: string
}

export interface ReturnToRallyOptions {
  rallyPointId?: string // Specific rally point, or null for auto-select
  reason: 'manual' | 'low-battery' | 'geofence-breach' | 'emergency' | 'failsafe'
  landImmediately?: boolean
}
