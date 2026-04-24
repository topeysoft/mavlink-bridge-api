<script setup lang="ts">
/**
 * LiveMapCard
 *
 * Drop-in card that wires the shared MonitorMap component to live stores:
 *   - Zones from `useZonesStore`
 *   - Mower pose from `useGpsStore`
 *   - User-toggleable 2D (Leaflet) / 3D (MapLibre WebGL) view mode
 *
 * 3D mode is gated by the `mapView3D` feature flag.
 */
import { computed, ref, watch } from 'vue';
import Card from '@/components/common/Card.vue';
import MonitorMap from '@/components/maps/MonitorMap.vue';
import MapViewModeToggle from '@/components/maps/MapViewModeToggle.vue';
import { useFeaturesStore } from '@/stores/features';
import { useZonesStore } from '@/stores/zones';
import { useGpsStore } from '@/stores/gps';
import { useThemeStore } from '@/stores/theme';
import type {
  LatLng,
  MowerPose,
  ZoneFeature,
  BaseLayer,
} from '@/composables/maps/MapRenderer';
import type { MapViewMode } from '@/composables/maps/useMapRenderer';

const features = useFeaturesStore();
const zonesStore = useZonesStore();
const gpsStore = useGpsStore();
const themeStore = useThemeStore();

const allow3D = computed(() => features.isFeatureEnabled('mapView3D'));
const viewMode = ref<MapViewMode>('2d');
const baseLayer = ref<BaseLayer>('satellite');

// Build a breadcrumb trail from incoming mower positions.
const trail = ref<LatLng[]>([]);
const TRAIL_MAX = 500;

watch(
  () => [gpsStore.gpsInfo.latitude, gpsStore.gpsInfo.longitude] as const,
  ([lat, lon]) => {
    if (lat == null || lon == null) return;
    const last = trail.value[trail.value.length - 1];
    if (last && last[0] === lat && last[1] === lon) return;
    trail.value.push([lat, lon]);
    if (trail.value.length > TRAIL_MAX) trail.value.shift();
  },
  { immediate: true },
);

const mower = computed<MowerPose | null>(() => {
  const g = gpsStore.gpsInfo;
  if (g.latitude == null || g.longitude == null) return null;
  return {
    lat: g.latitude,
    lon: g.longitude,
    headingDeg: g.heading,
    altitudeM: g.altitude,
  };
});

const center = computed<LatLng>(() => {
  if (mower.value) return [mower.value.lat, mower.value.lon];
  const last = trail.value[trail.value.length - 1];
  if (last) return last;
  return [40.7128, -74.006];
});

// Convert Zone[] (coordinates polygon) -> ZoneFeature[] (GeoJSON).
const zoneFeatures = computed<ZoneFeature[]>(() => {
  return zonesStore.zones.map((z) => {
    const ring = z.coordinates.map(([lat, lon]) => [lon, lat]) as [
      number,
      number,
    ][];
    // Ensure ring is closed
    if (
      ring.length > 0 &&
      (ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push(ring[0]);
    }
    return {
      id: z.id,
      name: z.name,
      type: z.type,
      color: z.color,
      heightM: viewMode.value === '3d' ? 1.2 : 0,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  });
});

const baseLayerOptions: { value: BaseLayer; label: string }[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'streets', label: 'Streets' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'dark', label: 'Dark' },
];
</script>

<template>
  <Card>
    <template #header>
      <div class="live-map-header">
        <div>
          <div class="card-title">Live Map</div>
          <div class="card-subtitle">
            {{ viewMode === '3d' ? '3D WebGL view' : '2D overhead view' }}
            · {{ zoneFeatures.length }} zones
          </div>
        </div>
        <div class="live-map-controls">
          <select
            v-model="baseLayer"
            class="base-layer-select"
            aria-label="Base layer"
          >
            <option
              v-for="opt in baseLayerOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <MapViewModeToggle v-model="viewMode" :allow3D="allow3D" />
        </div>
      </div>
    </template>

    <div class="live-map-body">
      <MonitorMap
        :view-mode="viewMode"
        :center="center"
        :zoom="18"
        :base-layer="baseLayer"
        :theme="themeStore.theme"
        :zones="zoneFeatures"
        :path="trail"
        :mower="mower"
        :pitch="viewMode === '3d' ? 50 : 0"
      />
    </div>
  </Card>
</template>

<style scoped lang="scss">
.live-map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);

  .card-title {
    font-size: var(--font-size-lg, 16px);
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-subtitle {
    font-size: var(--font-size-sm, 13px);
    color: var(--text-secondary);
    margin-top: 2px;
  }
}

.live-map-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.base-layer-select {
  appearance: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius, 6px);
  padding: 6px 10px;
  font-size: var(--font-size-sm, 13px);
  cursor: pointer;
}

.live-map-body {
  height: 520px;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}
</style>
