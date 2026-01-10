<script setup lang="ts">
import { computed, type Component } from 'vue'

interface Props {
  /** Icon component from lucide-vue-next */
  icon: Component
  /** Icon size in pixels (default: 24) */
  size?: number
  /** Stroke width (default: 2) */
  strokeWidth?: number
  /** Custom color (defaults to currentColor) */
  color?: string
  /** Additional CSS class */
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  strokeWidth: 2,
  color: 'currentColor'
})

const iconClass = computed(() => {
  return ['base-icon', props.class].filter(Boolean).join(' ')
})
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :color="color"
    :class="iconClass"
    aria-hidden="true"
  />
</template>

<style scoped lang="scss">
.base-icon {
  display: inline-block;
  flex-shrink: 0;
  transition: all 0.2s ease;
}
</style>
