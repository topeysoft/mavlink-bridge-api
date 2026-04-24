/**
 * MapLibre GL (WebGL) implementation of MapRenderer.
 *
 * `maplibre-gl` is loaded via dynamic import so this file does not force a
 * hard dependency until 3D mode is actually used. To enable:
 *
 *   cd app && yarn add maplibre-gl
 *
 * Then the 3D monitor view will automatically start working.
 *
 * Notes:
 * - We use MapLibre's native pitch/bearing for the "3D-like" camera.
 * - Zones are rendered as fill-extrusion layers when a `heightM` is set,
 *   otherwise as flat fills. Paths use a `line` layer. The mower is a
 *   symbol rendered via a small DOM marker for simplicity.
 * - Base layer URLs are raster tiles — feel free to swap in a vector
 *   style JSON (e.g. from MapTiler / Protomaps) for higher fidelity.
 */

import { ref } from 'vue'
import type {
  BaseLayer,
  LatLng,
  MapRenderer,
  MapRendererOptions,
  MowerPose,
  ZoneFeature,
} from './MapRenderer'

// Minimal structural types — avoids requiring `maplibre-gl` types at build time.
type AnyMap = {
  on(event: string, handler: (...args: unknown[]) => void): void
  remove(): void
  resize(): void
  setCenter(lngLat: [number, number]): void
  setZoom(zoom: number): void
  setPitch(p: number): void
  setBearing(b: number): void
  addSource(id: string, src: unknown): void
  removeSource(id: string): void
  getSource(id: string): unknown
  addLayer(layer: unknown): void
  removeLayer(id: string): void
  getLayer(id: string): unknown
  setStyle(style: unknown): void
}

const RASTER_STYLES: Record<BaseLayer, { tiles: string[]; attribution: string; maxZoom: number }> = {
  streets: {
    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: '&copy; Esri',
    maxZoom: 19,
  },
  terrain: {
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
  },
  dark: {
    tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    attribution: '&copy; CARTO',
    maxZoom: 19,
  },
}

function rasterStyle(layer: BaseLayer) {
  const s = RASTER_STYLES[layer]
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: s.tiles,
        tileSize: 256,
        attribution: s.attribution,
        maxzoom: s.maxZoom,
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  }
}

const ZONE_SOURCE = 'yr-zones'
const PATH_SOURCE = 'yr-path'
const ZONE_FILL_LAYER = 'yr-zones-fill'
const ZONE_EXTRUSION_LAYER = 'yr-zones-extrusion'
const ZONE_OUTLINE_LAYER = 'yr-zones-outline'
const PATH_LAYER = 'yr-path-line'

export function createMapLibreRenderer(options: MapRendererOptions): MapRenderer {
  const isReady = ref(false)

  let map: AnyMap | null = null
  let mowerEl: HTMLDivElement | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mowerMarker: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let maplibre: any = null

  function zonesToFeatureCollection(zones: ZoneFeature[]) {
    return {
      type: 'FeatureCollection',
      features: zones.map((z) => ({
        type: 'Feature',
        id: z.id,
        properties: {
          id: z.id,
          name: z.name,
          color: z.color ?? '#2C5F2D',
          height: z.heightM ?? 0,
        },
        geometry: z.geometry,
      })),
    }
  }

  const renderer: MapRenderer = {
    kind: '3d',
    isReady,

    async init() {
      // Dynamic import so the app does not hard-require maplibre-gl until used.
      try {
        // @ts-expect-error optional peer dep resolved at runtime
        maplibre = await import('maplibre-gl')
        // CSS must also be imported once the package is installed. Consumers
        // should add `import 'maplibre-gl/dist/maplibre-gl.css'` to main.ts.
      } catch (err) {
        throw new Error(
          '[MapLibreRenderer] maplibre-gl is not installed. Run `yarn add maplibre-gl` in app/.'
        )
      }

      const container =
        typeof options.container === 'string'
          ? document.getElementById(options.container)
          : options.container
      if (!container) throw new Error('MapLibre container not found')

      const [lat, lon] = options.center ?? [40.7128, -74.006]

      map = new maplibre.Map({
        container,
        style: rasterStyle(options.baseLayer ?? (options.theme === 'dark' ? 'dark' : 'streets')),
        center: [lon, lat],
        zoom: options.zoom ?? 17,
        pitch: options.pitch ?? 45,
        bearing: options.bearing ?? 0,
        attributionControl: true,
      }) as AnyMap

      await new Promise<void>((resolve) => {
        map!.on('load', () => resolve())
      })

      // Zones source + layers
      map.addSource(ZONE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: ZONE_FILL_LAYER,
        type: 'fill',
        source: ZONE_SOURCE,
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#2C5F2D'],
          'fill-opacity': 0.25,
        },
        filter: ['==', ['coalesce', ['get', 'height'], 0], 0],
      })
      map.addLayer({
        id: ZONE_EXTRUSION_LAYER,
        type: 'fill-extrusion',
        source: ZONE_SOURCE,
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#2C5F2D'],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.5,
        },
        filter: ['>', ['coalesce', ['get', 'height'], 0], 0],
      })
      map.addLayer({
        id: ZONE_OUTLINE_LAYER,
        type: 'line',
        source: ZONE_SOURCE,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#2C5F2D'],
          'line-width': 2,
        },
      })

      // Path source + layer
      map.addSource(PATH_SOURCE, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      })
      map.addLayer({
        id: PATH_LAYER,
        type: 'line',
        source: PATH_SOURCE,
        paint: {
          'line-color': '#87CEEB',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      })

      isReady.value = true
    },

    destroy() {
      mowerMarker?.remove?.()
      mowerMarker = null
      mowerEl = null
      map?.remove()
      map = null
      isReady.value = false
    },

    setCenter(center: LatLng, zoom?: number) {
      if (!map) return
      map.setCenter([center[1], center[0]])
      if (zoom != null) map.setZoom(zoom)
    },

    setBaseLayer(layer: BaseLayer) {
      if (!map) return
      // Simplest strategy: replace the entire style. Re-adds custom sources on style load.
      map.setStyle(rasterStyle(layer))
      map.on('load', () => {
        // no-op placeholder; callers should re-setZones/setPath after switching layers.
      })
    },

    invalidateSize() {
      setTimeout(() => map?.resize(), 50)
    },

    setZones(zones: ZoneFeature[]) {
      if (!map) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = map.getSource(ZONE_SOURCE) as any
      if (src?.setData) src.setData(zonesToFeatureCollection(zones))
    },

    setPath(points: LatLng[]) {
      if (!map) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = map.getSource(PATH_SOURCE) as any
      if (!src?.setData) return
      src.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points.map(([lat, lon]) => [lon, lat]),
        },
      })
    },

    setMowerPose(pose: MowerPose | null) {
      if (!map || !maplibre) return
      if (!pose) {
        mowerMarker?.remove?.()
        mowerMarker = null
        return
      }
      if (!mowerEl) {
        mowerEl = document.createElement('div')
        mowerEl.className = 'yr-mower-marker'
        mowerEl.style.cssText = [
          'width:16px',
          'height:16px',
          'border-radius:50%',
          'background:#7CB342',
          'border:2px solid #2C5F2D',
          'box-shadow:0 0 0 4px rgba(124,179,66,0.25)',
        ].join(';')
      }
      if (!mowerMarker) {
        mowerMarker = new maplibre.Marker({ element: mowerEl, rotationAlignment: 'map' })
          .setLngLat([pose.lon, pose.lat])
          .addTo(map)
      } else {
        mowerMarker.setLngLat([pose.lon, pose.lat])
      }
      if (pose.headingDeg != null && mowerMarker.setRotation) {
        mowerMarker.setRotation(pose.headingDeg)
      }
    },

    setCamera({ pitch, bearing }: { pitch?: number; bearing?: number; followMower?: boolean } = {}) {
      if (!map) return
      if (pitch != null) map.setPitch(pitch)
      if (bearing != null) map.setBearing(bearing)
    },
  }

  return renderer
}
