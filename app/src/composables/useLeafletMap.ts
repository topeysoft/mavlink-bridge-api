/**
 * Composable for Leaflet map management
 */

import { ref, onUnmounted, type Ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapOptions {
  center?: [number, number]
  zoom?: number
  theme?: 'light' | 'dark'
}

export function useLeafletMap(containerId: string, options: MapOptions = {}) {
  const map: Ref<L.Map | null> = ref(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)

  const defaultCenter: [number, number] = options.center || [40.7128, -74.006]
  const defaultZoom = options.zoom || 15

  /**
   * Initialize the Leaflet map
   */
  const initializeMap = (centerOverride?: [number, number]) => {
    if (isInitialized.value || !document.getElementById(containerId)) {
      return
    }

    isLoading.value = true

    try {
      // Use override center if provided, otherwise use default
      const initialCenter = centerOverride || defaultCenter

      // Create map instance
      map.value = L.map(containerId, {
        zoomControl: true,
        attributionControl: true
      }).setView(initialCenter, defaultZoom)

      // Add tile layer based on theme
      const tileLayer = options.theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

      L.tileLayer(tileLayer, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map.value)

      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize map:', error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update map theme
   */
  const updateTheme = (theme: 'light' | 'dark') => {
    if (!map.value) return

    // Remove existing tile layers
    map.value.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.value?.removeLayer(layer)
      }
    })

    // Add new tile layer with theme
    const tileLayer = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

    L.tileLayer(tileLayer, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map.value)
  }

  /**
   * Set map view to specific coordinates
   */
  const setView = (center: [number, number], zoom?: number) => {
    if (!map.value) return
    map.value.setView(center, zoom || map.value.getZoom())
  }

  /**
   * Fit map bounds to specific bounds
   */
  const fitBounds = (bounds: L.LatLngBounds, options?: L.FitBoundsOptions) => {
    if (!map.value) return
    map.value.fitBounds(bounds, options)
  }

  /**
   * Invalidate map size (call after container resize)
   */
  const invalidateSize = () => {
    if (!map.value) return
    setTimeout(() => {
      map.value?.invalidateSize()
    }, 100)
  }

  /**
   * Add a marker to the map
   */
  const addMarker = (latlng: [number, number], options?: L.MarkerOptions) => {
    if (!map.value) return null
    return L.marker(latlng, options).addTo(map.value)
  }

  /**
   * Add a polygon to the map
   */
  const addPolygon = (latlngs: L.LatLngExpression[], options?: L.PolylineOptions) => {
    if (!map.value) return null
    return L.polygon(latlngs, options).addTo(map.value)
  }

  /**
   * Add a circle to the map
   */
  const addCircle = (latlng: [number, number], radius: number, options?: L.CircleMarkerOptions) => {
    if (!map.value) return null
    return L.circle(latlng, { radius, ...options }).addTo(map.value)
  }

  /**
   * Remove a layer from the map
   */
  const removeLayer = (layer: L.Layer) => {
    if (!map.value) return
    map.value.removeLayer(layer)
  }

  /**
   * Clean up map instance
   */
  const destroy = () => {
    if (map.value) {
      map.value.remove()
      map.value = null
      isInitialized.value = false
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    destroy()
  })

  return {
    map,
    isInitialized,
    isLoading,
    initializeMap,
    updateTheme,
    setView,
    fitBounds,
    invalidateSize,
    addMarker,
    addPolygon,
    addCircle,
    removeLayer,
    destroy
  }
}
