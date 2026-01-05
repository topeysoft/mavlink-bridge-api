/**
 * Geographic calculation utilities for zones and coverage areas
 */

import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'

/**
 * Calculate the area of a polygon in acres
 * @param latlngs - Array of lat/lng coordinates
 * @returns Area in acres
 */
export function calculatePolygonArea(latlngs: L.LatLng[]): number {
  // Calculate area in square meters using Leaflet's GeometryUtil
  const areaInSquareMeters = L.GeometryUtil?.geodesicArea?.(latlngs) || 0

  // Convert square meters to acres (1 acre = 4046.86 square meters)
  return areaInSquareMeters * 0.000247105
}

/**
 * Calculate the area of a circle in acres
 * @param radius - Radius in meters
 * @returns Area in acres
 */
export function calculateCircleArea(radius: number): number {
  const areaInSquareMeters = Math.PI * radius * radius
  return areaInSquareMeters * 0.000247105
}

/**
 * Calculate the perimeter of a polygon in feet
 * @param latlngs - Array of lat/lng coordinates
 * @returns Perimeter in feet
 */
export function calculatePolygonPerimeter(latlngs: L.LatLng[]): number {
  let perimeterInMeters = 0

  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i]
    const p2 = latlngs[(i + 1) % latlngs.length]
    perimeterInMeters += p1.distanceTo(p2)
  }

  // Convert meters to feet (1 meter = 3.28084 feet)
  return perimeterInMeters * 3.28084
}

/**
 * Calculate the circumference of a circle in feet
 * @param radius - Radius in meters
 * @returns Circumference in feet
 */
export function calculateCirclePerimeter(radius: number): number {
  const circumferenceInMeters = 2 * Math.PI * radius
  return circumferenceInMeters * 3.28084
}

/**
 * Calculate area for any Leaflet layer
 * @param layer - Leaflet layer (Polygon, Rectangle, Circle, etc.)
 * @returns Area in acres, or 0 for non-area layers
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
 * @returns Perimeter in feet, or 0 for non-perimeter layers
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
 * Format area value for display
 * @param acres - Area in acres
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted string with units
 */
export function formatArea(acres: number, decimals: number = 3): string {
  return `${acres.toFixed(decimals)} acres`
}

/**
 * Format perimeter value for display
 * @param feet - Perimeter in feet
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string with units
 */
export function formatPerimeter(feet: number, decimals: number = 0): string {
  return `${feet.toFixed(decimals)} ft`
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
