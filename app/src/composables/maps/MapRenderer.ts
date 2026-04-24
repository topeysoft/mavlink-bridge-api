/**
 * Abstract map renderer contract.
 *
 * Allows multiple backends (Leaflet 2D, MapLibre GL WebGL) to be used
 * interchangeably for monitoring views. Editing flows currently still
 * use Leaflet directly via `useLeafletMap` / `useZoneDrawing`.
 */

import type { Ref } from 'vue'

export type LatLng = [number, number] // [lat, lon]

export type BaseLayer = 'streets' | 'satellite' | 'terrain' | 'dark'

export interface MapRendererOptions {
    container: HTMLElement | string
    center?: LatLng
    zoom?: number
    baseLayer?: BaseLayer
    theme?: 'light' | 'dark'
    /** 3D camera pitch in degrees (ignored by 2D renderers). */
    pitch?: number
    /** Map bearing in degrees (ignored by 2D renderers). */
    bearing?: number
}

export interface MowerPose {
    lat: number
    lon: number
    headingDeg?: number
    altitudeM?: number
}

export interface ZoneFeature {
    id: string
    name: string
    type: string
    color?: string
    /** GeoJSON geometry (Polygon / MultiPolygon / LineString / Point). */
    geometry: unknown
    /** Optional extrusion height for 3D renderers (meters). */
    heightM?: number
}

export interface MapRenderer {
    readonly kind: '2d' | '3d'
    readonly isReady: Ref<boolean>

    init (): Promise<void>
    destroy (): void

    setCenter (center: LatLng, zoom?: number): void
    setBaseLayer (layer: BaseLayer): void
    invalidateSize (): void

    /** Replace the full set of zones shown. */
    setZones (zones: ZoneFeature[]): void

    /** Replace the path/breadcrumb trail the mower has traveled. */
    setPath (points: LatLng[]): void

    /** Update the current mower pose marker. */
    setMowerPose (pose: MowerPose | null): void

    /** 3D-only: set camera pitch/bearing. No-op on 2D renderers. */
    setCamera?(opts: { pitch?: number; bearing?: number; followMower?: boolean }): void
}
