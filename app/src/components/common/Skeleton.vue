<script setup lang="ts">
interface Props {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string
  height?: string
  lines?: number
  animate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  width: '100%',
  height: '1rem',
  lines: 1,
  animate: true
})
</script>

<template>
  <div class="skeleton-wrapper">
    <div
      v-for="n in lines"
      :key="n"
      class="skeleton"
      :class="[
        `skeleton-${variant}`,
        { 'skeleton-animate': animate }
      ]"
      :style="{
        width: lines > 1 && n === lines ? '80%' : width,
        height: variant === 'text' ? height : variant === 'circular' ? width : height
      }"
      aria-busy="true"
      aria-live="polite"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--border-color) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.skeleton-animate {
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-text {
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-xs);

  &:last-child {
    margin-bottom: 0;
  }
}

.skeleton-circular {
  border-radius: 50%;
}

.skeleton-rectangular {
  border-radius: var(--radius-md);
}

.skeleton-card {
  border-radius: var(--radius-lg);
  min-height: 200px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
