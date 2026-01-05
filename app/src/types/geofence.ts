// YardRover Geofence Type Definitions

export type GeofenceType = 'inclusion' | 'exclusion'
export type GeofenceShape = 'polygon' | 'circle'
export type GeofenceStatus = 'active' | 'inactive' | 'breached'

export interface GeofenceCircle {
  center: {
    lat: number
    lng: number
  }
  radius: number // meters
}

export interface GeofencePolygon {
  coordinates: Array<{ lat: number; lng: number }>
}

export interface Geofence {
  id: string
  name: string
  type: GeofenceType
  shape: GeofenceShape
  status: GeofenceStatus
  enabled: boolean

  // Shape data
  circle?: GeofenceCircle
  polygon?: GeofencePolygon

  // Metadata
  description?: string
  color: string
  created: string
  lastModified: string

  // Actions on breach
  actions?: {
    stopVehicle?: boolean
    returnToHome?: boolean
    returnToRally?: boolean
    notifyUser?: boolean
  }
}

export interface GeofenceViolation {
  id: string
  geofenceId: string
  geofenceName: string
  timestamp: string
  position: {
    lat: number
    lng: number
  }
  resolved: boolean
  resolvedAt?: string
}

export interface GeofenceStats {
  totalGeofences: number
  activeGeofences: number
  violations: number
  lastViolation?: string
}
