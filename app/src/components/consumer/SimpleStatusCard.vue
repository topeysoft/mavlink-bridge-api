<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'

interface StatusItem {
  label: string
  value: string
  icon: string
  status: 'good' | 'warning' | 'error' | 'neutral'
}

const props = defineProps<{
  batteryLevel: number
  isConnected: boolean
  currentTask?: string
}>()

const statusItems = computed<StatusItem[]>(() => [
  {
    label: 'YardRover',
    value: props.isConnected ? 'Ready' : 'Disconnected',
    icon: '✓',
    status: props.isConnected ? 'good' : 'error'
  },
  {
    label: 'Battery',
    value: `${props.batteryLevel}%`,
    icon: '🔋',
    status: props.batteryLevel > 60 ? 'good' : props.batteryLevel > 30 ? 'warning' : 'error'
  },
  {
    label: 'Current Task',
    value: props.currentTask || 'None',
    icon: '📋',
    status: props.currentTask ? 'good' : 'neutral'
  }
])

function getStatusColor(status: StatusItem['status']): string {
  switch (status) {
    case 'good':
      return 'var(--status-success)'
    case 'warning':
      return 'var(--status-warning)'
    case 'error':
      return 'var(--status-danger)'
    default:
      return 'var(--text-secondary)'
  }
}
</script>

<template>
  <Card title="Status at a Glance">
    <div class="status-grid">
      <div
        v-for="item in statusItems"
        :key="item.label"
        class="status-item"
      >
        <div class="status-icon-wrapper" :style="{ backgroundColor: getStatusColor(item.status) }">
          <span class="status-icon">{{ item.icon }}</span>
        </div>
        <div class="status-info">
          <div class="status-value">{{ item.value }}</div>
          <div class="status-label">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.status-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.status-icon {
  font-size: 28px;
  line-height: 1;
}

.status-info {
  flex: 1;
  min-width: 0;
}

.status-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.status-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
