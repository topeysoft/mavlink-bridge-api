<script setup lang="ts">
/**
 * Small segmented toggle for switching between 2D and 3D monitor views.
 * Kept decoupled from any store so it can be reused in different layouts.
 */
import { computed } from 'vue';
import type { MapViewMode } from '@/composables/maps/useMapRenderer';

const props = defineProps<{
  modelValue: MapViewMode;
  /** Hide the 3D option (e.g. when the feature flag is off). */
  allow3D?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MapViewMode): void;
}>();

const show3D = computed(() => props.allow3D !== false);

function select(mode: MapViewMode) {
  if (mode === props.modelValue) return;
  emit('update:modelValue', mode);
}
</script>

<template>
  <div class="view-mode-toggle" role="tablist" aria-label="Map view mode">
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === '2d'"
      :class="['seg', { active: modelValue === '2d' }]"
      @click="select('2d')"
    >
      2D
    </button>
    <button
      v-if="show3D"
      type="button"
      role="tab"
      :aria-selected="modelValue === '3d'"
      :class="['seg', { active: modelValue === '3d' }]"
      @click="select('3d')"
    >
      3D
    </button>
  </div>
</template>

<style scoped lang="scss">
.view-mode-toggle {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius, 6px);
  overflow: hidden;
  background: var(--bg-secondary);

  .seg {
    appearance: none;
    border: none;
    background: transparent;
    padding: 6px 12px;
    font-size: var(--font-size-sm, 13px);
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;

    & + .seg {
      border-left: 1px solid var(--border-color);
    }

    &:hover {
      color: var(--text-primary);
    }

    &.active {
      background: var(--primary-green, #2c5f2d);
      color: #fff;
    }
  }
}
</style>
