/**
 * Coverage Renderer
 *
 * Renders spraying/irrigation mission paths with semi-transparent zone overlays.
 * Shows the coverage area with a subtle path line indicating the route.
 */

import L from 'leaflet'
import type { PathRenderer } from './index'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

export class CoverageRenderer implements PathRenderer {
  private polygons: L.Polygon[] = []
  private polylines: L.Polyline[] = []

  render(map: L.Map, data: PathPreviewData, config: MissionTypeConfig): void {
    this.clear()

    const coverageColor = config.primaryColor

    // Render zone coverage with semi-transparent fill
    for (const zone of data.zones) {
      if (zone.polygon.length < 3) continue

      // Convert [lng, lat] to [lat, lng] for Leaflet
      const latLngs = zone.polygon.map(([lng, lat]) => [lat, lng] as [number, number])

      // Semi-transparent coverage fill
      const polygon = L.polygon(latLngs, {
        color: coverageColor,
        fillColor: coverageColor,
        fillOpacity: 0.35,
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.8
      }).addTo(map)

      this.polygons.push(polygon)
    }

    // Add path line to show coverage route
    for (const path of data.paths) {
      if (path.waypoints.length < 2) continue

      const polyline = L.polyline(path.waypoints, {
        color: coverageColor,
        weight: 2,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map)

      this.polylines.push(polyline)
    }
  }

  clear(): void {
    for (const polygon of this.polygons) {
      polygon.remove()
    }
    for (const polyline of this.polylines) {
      polyline.remove()
    }
    this.polygons = []
    this.polylines = []
  }
}
