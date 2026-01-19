/**
 * Strip Renderer
 *
 * Renders filled coverage strips showing path coverage.
 * Used for mowing (green), snow clearing (blue), and cleanup (brown).
 * Creates alternating colored stripes for realistic visualization.
 */

import L from 'leaflet'
import type { PathRenderer } from './index'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

export class StripRenderer implements PathRenderer {
  private polygons: L.Polygon[] = []

  render(map: L.Map, data: PathPreviewData, config: MissionTypeConfig): void {
    this.clear()

    if (!data.strips || data.strips.length === 0) {
      return
    }

    const { even: evenColor, odd: oddColor } = config.stripColors

    for (const strip of data.strips) {
      if (strip.polygon.length < 3) {
        continue
      }

      // Convert [lng, lat] to [lat, lng] for Leaflet
      const latLngs = strip.polygon.map(([lng, lat]) => [lat, lng] as [number, number])

      // Alternate colors between passes for realistic stripe effect
      const color = strip.passIndex % 2 === 0 ? evenColor : oddColor

      const polygon = L.polygon(latLngs, {
        color,
        fillColor: color,
        fillOpacity: 0.65,
        weight: 1,
        opacity: 0.8,
        className: `coverage-strip pass-${strip.passIndex % 2}`
      }).addTo(map)

      this.polygons.push(polygon)
    }
  }

  clear(): void {
    for (const polygon of this.polygons) {
      polygon.remove()
    }
    this.polygons = []
  }
}
