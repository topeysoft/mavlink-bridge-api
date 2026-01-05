<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  totalZones: number
  totalArea: number
  activeZones: number
}

const props = defineProps<Props>()

const stats = computed(() => [
  { label: 'Total Zones', value: props.totalZones.toString(), icon: 'map' },
  { label: 'Total Area', value: `${props.totalArea} acres`, icon: 'grid' },
  { label: 'Active Zones', value: props.activeZones.toString(), icon: 'check' }
])
</script>

<template>
  <div class="zone-stats">
    <div v-for="stat in stats" :key="stat.label" class="stat-card">
      <svg v-if="stat.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <svg v-else-if="stat.icon === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <svg v-else-if="stat.icon === 'check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <div class="stat-content">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.zone-stats {
  @include auto-grid(200px);
  margin-bottom: var(--spacing-xl);
}

.stat-card {
  @include card;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
  }

  svg {
    width: 32px;
    height: 32px;
    stroke: var(--primary-green);
    flex-shrink: 0;
  }
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
