/**
 * Line Renderer
 *
 * Renders simple polyline paths for monitoring and utility missions.
 * Shows a clean path line without coverage visualization.
 */

import L from 'leaflet'
import type { PathRenderer } from './index'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

export class LineRenderer implements PathRenderer {
  private polylines: L.Polyline[] = []

  render(map: L.Map, data: PathPreviewData, config: MissionTypeConfig): void {
    this.clear()

    const pathColor = config.primaryColor

    for (const path of data.paths) {
      if (path.waypoints.length < 2) continue

      const polyline = L.polyline(path.waypoints, {
        color: pathColor,
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map)

      this.polylines.push(polyline)
    }
  }

  clear(): void {
    for (const polyline of this.polylines) {
      polyline.remove()
    }
    this.polylines = []
  }
}
