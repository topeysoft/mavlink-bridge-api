<script setup lang="ts">
interface Props {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  showPercentage: true,
  color: 'var(--primary-green)',
  size: 'md'
})

const percentage = Math.min(100, Math.max(0, (props.value / props.max) * 100))
</script>

<template>
  <div class="progress-container">
    <div v-if="label || showPercentage" class="progress-header">
      <span v-if="label" class="progress-label">{{ label }}</span>
      <span v-if="showPercentage" class="progress-percentage">{{ Math.round(percentage) }}%</span>
    </div>
    <div class="progress-bar" :class="`progress-${size}`">
      <div
        class="progress-fill"
        :style="{ width: `${percentage}%`, backgroundColor: color }"
      ></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.progress-container {
  margin-bottom: var(--spacing-md);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.progress-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.progress-percentage {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 600;
}

.progress-bar {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.progress-sm {
  height: 4px;
}

.progress-md {
  height: 8px;
}

.progress-lg {
  height: 12px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: var(--border-radius);
}
</style>
