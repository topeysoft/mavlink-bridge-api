/**
 * Path Preview Renderers
 *
 * Modular renderer architecture for mission-type-specific map visualizations.
 * Each renderer implements the PathRenderer interface for consistent usage.
 */

import type L from 'leaflet'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

/**
 * Interface for path preview renderers
 */
export interface PathRenderer {
  /** Render the path data on the map */
  render(map: L.Map, data: PathPreviewData, config: MissionTypeConfig): void
  /** Clear all rendered elements */
  clear(): void
}

export { StripRenderer } from './StripRenderer'
export { WaypointRenderer } from './WaypointRenderer'
export { CoverageRenderer } from './CoverageRenderer'
export { LineRenderer } from './LineRenderer'
