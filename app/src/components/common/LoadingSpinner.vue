<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'small' | 'medium' | 'large'
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  color: 'var(--primary)'
})

const spinnerSize = computed(() => {
  switch (props.size) {
    case 'small':
      return '16px'
    case 'large':
      return '48px'
    default:
      return '24px'
  }
})

const borderWidth = computed(() => {
  switch (props.size) {
    case 'small':
      return '2px'
    case 'large':
      return '4px'
    default:
      return '3px'
  }
})
</script>

<template>
  <div
    class="loading-spinner"
    :style="{
      width: spinnerSize,
      height: spinnerSize,
      borderWidth: borderWidth,
      borderTopColor: color
    }"
  ></div>
</template>

<style scoped>
.loading-spinner {
  border-style: solid;
  border-color: var(--bg-tertiary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
