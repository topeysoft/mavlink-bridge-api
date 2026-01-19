/**
 * Waypoint Renderer
 *
 * Renders patrol/security mission paths with dotted lines and waypoint markers.
 * Shows route as a dashed path with circle markers at regular intervals.
 */

import L from 'leaflet'
import type { PathRenderer } from './index'
import type { PathPreviewData } from '@/composables/useMissionPathGeneration'
import type { MissionTypeConfig } from '@/config/missionTypeConfig'

export class WaypointRenderer implements PathRenderer {
  private polylines: L.Polyline[] = []
  private markers: L.CircleMarker[] = []

  render(map: L.Map, data: PathPreviewData, config: MissionTypeConfig): void {
    this.clear()

    const pathColor = config.primaryColor

    for (const path of data.paths) {
      if (path.waypoints.length < 2) continue

      // Dotted path line
      const polyline = L.polyline(path.waypoints, {
        color: pathColor,
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map)

      this.polylines.push(polyline)

      // Waypoint markers at intervals
      // Show markers at start, end, and at regular intervals in between
      const waypointCount = path.waypoints.length
      const maxMarkers = 12
      const interval = Math.max(1, Math.floor(waypointCount / maxMarkers))

      path.waypoints.forEach((wp, idx) => {
        const isStart = idx === 0
        const isEnd = idx === waypointCount - 1
        const isInterval = idx % interval === 0

        if (isStart || isEnd || isInterval) {
          // Start marker is green, end marker is red, others are blue
          let fillColor = pathColor
          let radius = 6

          if (isStart) {
            fillColor = '#27ae60' // Green
            radius = 8
          } else if (isEnd) {
            fillColor = '#e74c3c' // Red
            radius = 8
          }

          const marker = L.circleMarker(wp, {
            radius,
            fillColor,
            fillOpacity: 0.9,
            weight: 2,
            color: 'white',
            opacity: 1
          }).addTo(map)

          this.markers.push(marker)
        }
      })
    }
  }

  clear(): void {
    for (const polyline of this.polylines) {
      polyline.remove()
    }
    for (const marker of this.markers) {
      marker.remove()
    }
    this.polylines = []
    this.markers = []
  }
}
