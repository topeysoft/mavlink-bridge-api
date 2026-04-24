/**
 * Factory that returns a MapRenderer for the requested view mode.
 *
 * Call site example:
 *
 *   const renderer = await createRenderer(mode === '3d' ? '3d' : '2d', {
 *     container: containerEl.value!,
 *     center: [lat, lon],
 *     zoom: 18,
 *   })
 *   await renderer.init()
 */

import type { MapRenderer, MapRendererOptions } from './MapRenderer'
import { createLeafletRenderer } from './useLeafletRenderer'

export type MapViewMode = '2d' | '3d'

export async function createRenderer(
  mode: MapViewMode,
  options: MapRendererOptions
): Promise<MapRenderer> {
  if (mode === '3d') {
    // Lazy import keeps maplibre-gl out of the main bundle until 3D is used.
    const { createMapLibreRenderer } = await import('./useMapLibreRenderer')
    return createMapLibreRenderer(options)
  }
  return createLeafletRenderer(options)
}
