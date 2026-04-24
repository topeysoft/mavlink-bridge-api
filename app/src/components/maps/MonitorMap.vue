<script setup lang="ts">
/**
 * MonitorMap
 *
 * Read-only map for monitoring the mower. Renders zones, breadcrumb path, and
 * the live mower pose. Supports switching between 2D (Leaflet) and 3D (MapLibre
 * WebGL) at runtime via the `viewMode` prop.
 *
 * Intended for dashboards / live-status views. Editing flows continue to use
 * the existing `MapDrawingModal` / `useLeafletMap` composables.
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  createRenderer,
  type MapViewMode,
} from '@/composables/maps/useMapRenderer';
import type {
  BaseLayer,
  LatLng,
  MapRenderer,
  MowerPose,
  ZoneFeature,
} from '@/composables/maps/MapRenderer';

const props = withDefaults(
  defineProps<{
    viewMode?: MapViewMode;
    center?: LatLng;
    zoom?: number;
    baseLayer?: BaseLayer;
    theme?: 'light' | 'dark';
    zones?: ZoneFeature[];
    path?: LatLng[];
    mower?: MowerPose | null;
    /** 3D only */
    pitch?: number;
    bearing?: number;
  }>(),
  {
    viewMode: '2d',
    zoom: 18,
    baseLayer: 'satellite',
    theme: 'light',
    zones: () => [],
    path: () => [],
    mower: null,
    pitch: 45,
    bearing: 0,
  },
);

const emit = defineEmits<{
  (e: 'ready', renderer: MapRenderer): void;
  (e: 'error', err: unknown): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const errorMessage = ref<string | null>(null);
const isLoading = ref(true);

let renderer: MapRenderer | null = null;
let currentMode: MapViewMode | null = null;

async function buildRenderer(mode: MapViewMode) {
  if (!containerRef.value) return;
  isLoading.value = true;
  errorMessage.value = null;

  // Tear down existing
  renderer?.destroy();
  renderer = null;

  try {
    renderer = await createRenderer(mode, {
      container: containerRef.value,
      center: props.center,
      zoom: props.zoom,
      baseLayer: props.baseLayer,
      theme: props.theme,
      pitch: props.pitch,
      bearing: props.bearing,
    });
    await renderer.init();
    currentMode = mode;

    // Replay current state into the new renderer
    renderer.setZones(props.zones);
    renderer.setPath(props.path);
    renderer.setMowerPose(props.mower);

    emit('ready', renderer);
  } catch (err) {
    console.error('[MonitorMap] renderer init failed', err);
    errorMessage.value = err instanceof Error ? err.message : String(err);
    emit('error', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  buildRenderer(props.viewMode);
});

onBeforeUnmount(() => {
  renderer?.destroy();
  renderer = null;
});

watch(
  () => props.viewMode,
  (mode) => {
    if (mode !== currentMode) buildRenderer(mode);
  },
);

watch(
  () => props.zones,
  (z) => renderer?.setZones(z),
  { deep: true },
);

watch(
  () => props.path,
  (p) => renderer?.setPath(p),
  { deep: true },
);

watch(
  () => props.mower,
  (m) => renderer?.setMowerPose(m),
  { deep: true },
);

watch(
  () => props.baseLayer,
  (layer) => renderer?.setBaseLayer(layer),
);

watch(
  () => [props.pitch, props.bearing] as const,
  ([pitch, bearing]) => renderer?.setCamera?.({ pitch, bearing }),
);

function retry() {
  buildRenderer(props.viewMode);
}

defineExpose({ retry });
</script>

<template>
  <div class="monitor-map">
    <div ref="containerRef" class="monitor-map__canvas" />

    <div v-if="isLoading" class="monitor-map__overlay"> Loading map… </div>

    <div v-else-if="errorMessage" class="monitor-map__overlay error">
      <p>{{ errorMessage }}</p>
      <button class="btn btn-secondary" @click="retry">Retry</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.monitor-map {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  background: var(--bg-secondary);
}

.monitor-map__canvas {
  position: absolute;
  inset: 0;
}

.monitor-map__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm, 8px);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: var(--font-size-sm);
  pointer-events: auto;

  &.error {
    background: rgba(0, 0, 0, 0.6);
  }
}
</style>
