/**
 * Leaflet-based implementation of MapRenderer.
 *
 * Thin adapter over the Leaflet primitives used elsewhere in the app.
 * Intended for monitor views that want to swap between 2D and 3D at runtime.
 */

import { ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
    BaseLayer,
    LatLng,
    MapRenderer,
    MapRendererOptions,
    MowerPose,
    ZoneFeature,
} from './MapRenderer'

const LAYER_URLS: Record<BaseLayer, { url: string; attribution: string; maxZoom: number }> = {
    streets: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri',
        maxZoom: 19,
    },
    terrain: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenTopoMap',
        maxZoom: 17,
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attribution: '&copy; CARTO',
        maxZoom: 19,
    },
}

export function createLeafletRenderer (options: MapRendererOptions): MapRenderer {
    const isReady = ref(false)

    let map: L.Map | null = null
    let tileLayer: L.TileLayer | null = null
    let zonesGroup: L.FeatureGroup | null = null
    let pathLine: L.Polyline | null = null
    let mowerMarker: L.CircleMarker | null = null

    function applyBaseLayer (layer: BaseLayer) {
        if (!map) return
        if (tileLayer) map.removeLayer(tileLayer)
        const cfg = LAYER_URLS[layer]
        tileLayer = L.tileLayer(cfg.url, {
            attribution: cfg.attribution,
            maxZoom: cfg.maxZoom,
        }).addTo(map)
    }

    const renderer: MapRenderer = {
        kind: '2d',
        isReady,

        async init () {
            const el =
                typeof options.container === 'string'
                    ? document.getElementById(options.container)
                    : options.container
            if (!el) throw new Error('Leaflet container not found')

            map = L.map(el, { zoomControl: true }).setView(
                options.center ?? [40.7128, -74.006],
                options.zoom ?? 17
            )

            applyBaseLayer(
                options.baseLayer ?? (options.theme === 'dark' ? 'dark' : 'streets')
            )

            zonesGroup = L.featureGroup().addTo(map)
            pathLine = L.polyline([], {
                color: '#87CEEB',
                weight: 3,
                opacity: 0.85,
            }).addTo(map)

            isReady.value = true
        },

        destroy () {
            mowerMarker?.remove()
            pathLine?.remove()
            zonesGroup?.clearLayers()
            map?.remove()
            map = null
            tileLayer = null
            zonesGroup = null
            pathLine = null
            mowerMarker = null
            isReady.value = false
        },

        setCenter (center: LatLng, zoom?: number) {
            map?.setView(center, zoom ?? map.getZoom())
        },

        setBaseLayer (layer: BaseLayer) {
            applyBaseLayer(layer)
        },

        invalidateSize () {
            setTimeout(() => map?.invalidateSize(), 50)
        },

        setZones (zones: ZoneFeature[]) {
            if (!map || !zonesGroup) return
            zonesGroup.clearLayers()
            for (const z of zones) {
                try {
                    L.geoJSON(z.geometry as GeoJSON.GeoJsonObject, {
                        style: {
                            color: z.color ?? '#2C5F2D',
                            fillOpacity: 0.25,
                            weight: 2,
                        },
                    }).eachLayer((layer) => zonesGroup!.addLayer(layer))
                } catch (err) {
                    console.warn('[LeafletRenderer] failed to render zone', z.id, err)
                }
            }
        },

        setPath (points: LatLng[]) {
            pathLine?.setLatLngs(points)
        },

        setMowerPose (pose: MowerPose | null) {
            if (!map) return
            if (!pose) {
                mowerMarker?.remove()
                mowerMarker = null
                return
            }
            if (!mowerMarker) {
                mowerMarker = L.circleMarker([pose.lat, pose.lon], {
                    radius: 8,
                    color: '#2C5F2D',
                    fillColor: '#7CB342',
                    fillOpacity: 0.9,
                    weight: 2,
                }).addTo(map)
            } else {
                mowerMarker.setLatLng([pose.lat, pose.lon])
            }
        },
    }

    return renderer
}
