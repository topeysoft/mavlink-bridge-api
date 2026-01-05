/**
 * Composable for zone drawing functionality with Leaflet.draw
 */

import { ref, computed, onUnmounted, type Ref } from 'vue'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { calculateLayerArea, calculateLayerPerimeter, getLayerType } from '@/utils/geoCalculations'
import type { Zone } from '@/stores/zones'

export interface DrawnZone {
  layer: L.Layer
  index: number
  type: string
  area: number
  perimeter: number
}

export function useZoneDrawing(map: Ref<L.Map | null>) {
  const drawnItems = ref<L.FeatureGroup | null>(null)
  const drawControl = ref<L.Control.Draw | null>(null)
  const zones = ref<DrawnZone[]>([])
  const isDrawing = ref(false)

  // Statistics
  const totalArea = computed(() => {
    return zones.value.reduce((sum, zone) => sum + zone.area, 0)
  })

  const totalPerimeter = computed(() => {
    return zones.value.reduce((sum, zone) => sum + zone.perimeter, 0)
  })

  const zoneCount = computed(() => zones.value.length)

  /**
   * Initialize drawing tools
   */
  const initializeDrawing = () => {
    if (!map.value) return

    // Create FeatureGroup for drawn items
    drawnItems.value = new L.FeatureGroup()
    map.value.addLayer(drawnItems.value)

    // Initialize Draw Control
    drawControl.value = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false, // Disabled to avoid leaflet-draw bug
          shapeOptions: {
            color: '#2C5F2D',
            fillOpacity: 0.3,
            weight: 2
          }
        },
        rectangle: {
          showArea: false, // Disabled to avoid leaflet-draw bug
          shapeOptions: {
            color: '#2C5F2D',
            fillOpacity: 0.3,
            weight: 2
          }
        },
        circle: {
          showRadius: false, // Disabled to avoid leaflet-draw bug
          shapeOptions: {
            color: '#2C5F2D',
            fillOpacity: 0.3,
            weight: 2
          }
        },
        polyline: {
          shapeOptions: {
            color: '#87CEEB',
            weight: 3
          }
        },
        marker: true,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems.value,
        remove: true
      }
    })

    map.value.addControl(drawControl.value)

    // Event handlers
    setupEventHandlers()
  }

  /**
   * Setup drawing event handlers
   */
  const setupEventHandlers = () => {
    if (!map.value || !drawnItems.value) return

    // Drawing started
    map.value.on(L.Draw.Event.DRAWSTART, () => {
      isDrawing.value = true
    })

    // Drawing stopped
    map.value.on(L.Draw.Event.DRAWSTOP, () => {
      isDrawing.value = false
    })

    // Layer created
    map.value.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer
      drawnItems.value?.addLayer(layer)
      updateZones()
    })

    // Layers edited
    map.value.on(L.Draw.Event.EDITED, () => {
      updateZones()
    })

    // Layers deleted
    map.value.on(L.Draw.Event.DELETED, () => {
      updateZones()
    })
  }

  /**
   * Update zones array from drawn items
   */
  const updateZones = () => {
    if (!drawnItems.value) return

    zones.value = []
    let index = 1

    drawnItems.value.eachLayer((layer: any) => {
      const area = calculateLayerArea(layer)
      const perimeter = calculateLayerPerimeter(layer)
      const type = getLayerType(layer)

      zones.value.push({
        layer,
        index,
        type,
        area,
        perimeter
      })

      index++
    })
  }

  /**
   * Load GeoJSON data onto the map
   */
  const loadGeoJSON = (geojson: any) => {
    if (!map.value || !drawnItems.value) return

    try {
      L.geoJSON(geojson).eachLayer((layer: any) => {
        drawnItems.value?.addLayer(layer)
      })
      updateZones()
    } catch (error) {
      console.error('Failed to load GeoJSON:', error)
    }
  }

  /**
   * Export drawn items as GeoJSON
   */
  const exportGeoJSON = () => {
    if (!drawnItems.value) return null
    return drawnItems.value.toGeoJSON()
  }

  /**
   * Clear all drawn items
   */
  const clearAll = () => {
    if (!drawnItems.value) return
    drawnItems.value.clearLayers()
    updateZones()
  }

  /**
   * Zoom to a specific zone
   */
  const zoomToZone = (index: number) => {
    if (!map.value) return

    const zone = zones.value.find(z => z.index === index)
    if (!zone) return

    const layer = zone.layer as any
    if (layer.getBounds) {
      map.value.fitBounds(layer.getBounds(), { padding: [50, 50] })
    } else if (layer.getLatLng) {
      map.value.setView(layer.getLatLng(), 17)
    }
  }

  /**
   * Cleanup
   */
  const destroy = () => {
    if (map.value && drawControl.value) {
      map.value.removeControl(drawControl.value)
      drawControl.value = null
    }

    if (map.value && drawnItems.value) {
      map.value.removeLayer(drawnItems.value)
      drawnItems.value = null
    }

    zones.value = []
  }

  // Cleanup on unmount
  onUnmounted(() => {
    destroy()
  })

  return {
    drawnItems,
    zones,
    totalArea,
    totalPerimeter,
    zoneCount,
    isDrawing,
    initializeDrawing,
    loadGeoJSON,
    exportGeoJSON,
    clearAll,
    zoomToZone,
    destroy
  }
}
