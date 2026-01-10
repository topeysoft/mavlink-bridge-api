/**
 * Types for zone recording functionality
 */

export type RecordingMode = 'perimeter' | 'anchor'

export interface GPSWaypoint {
  lat: number
  lon: number
  alt?: number
  accuracy?: number
  timestamp: number  // microseconds since epoch
}

export interface AnchorPoint {
  lat: number
  lon: number
  index: number       // 0-based order index
  timestamp: number   // microseconds since epoch
}

export type ShapeType = 'rectangle' | 'l_shape' | 'triangle' | 'custom'

export interface RecordingConfig {
  mode?: RecordingMode            // recording mode (default: 'perimeter')
  // Perimeter mode settings
  sampleRate?: number             // meters between samples (default: 1.0)
  minAccuracy?: number            // minimum GPS accuracy in meters (default: 3.0)
  autoClose?: boolean             // auto-close polygon (default: true)
  autoSimplify?: boolean          // simplify path (default: true)
  simplifyTolerance?: number      // Douglas-Peucker tolerance (default: 0.5)
  // Anchor mode settings
  autoSquare?: boolean            // snap near-90° angles to 90° (default: true)
  snapAngleThreshold?: number     // angle tolerance in degrees (default: 10.0)
  minAnchors?: number             // minimum anchor points (default: 3)
  maxAnchors?: number             // maximum anchor points (default: 20)
}

export type RecordingStatus = 'active' | 'paused' | 'completed' | 'failed'

export interface RecordingSession {
  sessionId: string
  status: RecordingStatus
  mode: RecordingMode
  waypointCount: number
  anchorCount?: number
  estimatedArea?: number          // square meters
  estimatedPerimeter?: number     // meters
  shapeType?: ShapeType          // detected shape (anchor mode)
}

export interface RecordingStartResponse {
  session_id: string
  status: RecordingStatus
}

export interface RecordingCompleteResult {
  sessionId: string
  zonePreview: any  // GeoJSON Feature
  waypointCount: number
  simplifiedCount: number
  area: number      // square meters
  perimeter: number // meters
}
