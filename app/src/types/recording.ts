/**
 * Frontend types for zone recording
 */

export type RecordingMode = 'perimeter' | 'anchor'

export interface RecordedWaypoint {
  lat: number
  lon: number
  accuracy?: number
  timestamp: number
}

export interface AnchorPoint {
  lat: number
  lon: number
  index: number
  timestamp: number
}

export type ShapeType = 'rectangle' | 'l_shape' | 'triangle' | 'custom'

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  sessionId: string | null
  mode: RecordingMode
  waypoints: RecordedWaypoint[]
  anchors: AnchorPoint[]
  estimatedArea: number
  estimatedPerimeter: number
  waypointCount: number
  anchorCount: number
  shapeType?: ShapeType
}
