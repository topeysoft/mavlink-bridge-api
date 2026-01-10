/**
 * Geographic calculation utilities for zones and coverage areas
 */

import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'

/**
 * Calculate the area of a polygon in square meters
 * @param latlngs - Array of lat/lng coordinates
 * @returns Area in square meters
 */
export function calculatePolygonArea(latlngs: L.LatLng[]): number {
  // Calculate area in square meters using Leaflet's GeometryUtil
  return L.GeometryUtil?.geodesicArea?.(latlngs) || 0
}

/**
 * Calculate the area of a circle in square meters
 * @param radius - Radius in meters
 * @returns Area in square meters
 */
export function calculateCircleArea(radius: number): number {
  return Math.PI * radius * radius
}

/**
 * Calculate the perimeter of a polygon in meters
 * @param latlngs - Array of lat/lng coordinates
 * @returns Perimeter in meters
 */
export function calculatePolygonPerimeter(latlngs: L.LatLng[]): number {
  let perimeterInMeters = 0

  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i]
    const p2 = latlngs[(i + 1) % latlngs.length]
    perimeterInMeters += p1.distanceTo(p2)
  }

  return perimeterInMeters
}

/**
 * Calculate the circumference of a circle in meters
 * @param radius - Radius in meters
 * @returns Circumference in meters
 */
export function calculateCirclePerimeter(radius: number): number {
  return 2 * Math.PI * radius
}

/**
 * Calculate area for any Leaflet layer
 * @param layer - Leaflet layer (Polygon, Rectangle, Circle, etc.)
 * @returns Area in square meters, or 0 for non-area layers
 */
export function calculateLayerArea(layer: any): number {
  if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
    const latlngs = layer.getLatLngs()[0] as L.LatLng[]
    return calculatePolygonArea(latlngs)
  } else if (layer instanceof L.Circle) {
    return calculateCircleArea(layer.getRadius())
  }
  return 0
}

/**
 * Calculate perimeter for any Leaflet layer
 * @param layer - Leaflet layer
 * @returns Perimeter in meters, or 0 for non-perimeter layers
 */
export function calculateLayerPerimeter(layer: any): number {
  if (layer instanceof L.Polygon || layer instanceof L.Rectangle || layer instanceof L.Polyline) {
    const latlngs = (layer.getLatLngs()[0] || layer.getLatLngs()) as L.LatLng[]
    return calculatePolygonPerimeter(latlngs)
  } else if (layer instanceof L.Circle) {
    return calculateCirclePerimeter(layer.getRadius())
  }
  return 0
}

/**
 * Get the layer type as a string
 * @param layer - Leaflet layer
 * @returns Layer type name
 */
export function getLayerType(layer: any): string {
  if (layer instanceof L.Marker) return 'Marker'
  if (layer instanceof L.Circle) return 'Circle'
  if (layer instanceof L.Rectangle) return 'Rectangle'
  if (layer instanceof L.Polygon) return 'Polygon'
  if (layer instanceof L.Polyline) return 'Path'
  return 'Unknown'
}
