<script setup lang="ts">
import { ref } from 'vue'

interface Alert {
  id: number
  type: 'warning' | 'error' | 'info'
  icon: string
  title: string
  message: string
}

const alerts = ref<Alert[]>([
  {
    id: 1,
    type: 'warning',
    icon: '⚠️',
    title: 'Low Battery Warning',
    message: 'Battery level at 15%. Mission will be paused if it drops below 10%.'
  }
])

const dismissAlert = (id: number) => {
  alerts.value = alerts.value.filter(alert => alert.id !== id)
}
</script>

<template>
  <div v-if="alerts.length > 0" class="alerts-panel">
    <div v-for="alert in alerts" :key="alert.id" class="alert" :class="`alert-${alert.type}`">
      <div class="alert-icon">{{ alert.icon }}</div>
      <div class="alert-content">
        <div class="alert-title">{{ alert.title }}</div>
        <div class="alert-message">{{ alert.message }}</div>
      </div>
      <button class="alert-dismiss" @click="dismissAlert(alert.id)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.alerts-panel {
  margin-bottom: var(--spacing-lg);
}

.alert {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-sm);
  border-left: 4px solid;
}

.alert-warning {
  background: rgba(237, 137, 54, 0.1);
  border-color: var(--status-warning);
  color: var(--status-warning);
}

.alert-error {
  background: rgba(245, 101, 101, 0.1);
  border-color: var(--status-error);
  color: var(--status-error);
}

.alert-info {
  background: rgba(66, 153, 225, 0.1);
  border-color: var(--status-info);
  color: var(--status-info);
}

.alert-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  color: var(--text-primary);
}

.alert-title {
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.alert-message {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.alert-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: var(--spacing-xs);
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius);
  transition: all 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-primary);
  }
}
</style>
