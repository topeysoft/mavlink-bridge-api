<script setup lang="ts">
import Card from '@/components/common/Card.vue'

const quickActions = [
  { label: 'Start Mission', icon: '▶️', color: 'var(--primary-green)' },
  { label: 'System Check', icon: '✓', color: 'var(--status-info)' },
  { label: 'Set Home', icon: '🏠', color: 'var(--status-warning)' },
  { label: 'Return Home', icon: '↩️', color: 'var(--status-success)' }
]

const handleAction = (action: string) => {
  console.log(`Action: ${action}`)
}
</script>

<template>
  <Card title="Quick Actions">
    <div class="quick-actions-grid">
      <button
        v-for="action in quickActions"
        :key="action.label"
        class="quick-action-btn"
        :style="{ borderColor: action.color }"
        @click="handleAction(action.label)"
      >
        <span class="action-icon">{{ action.icon }}</span>
        <span>{{ action.label }}</span>
      </button>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacing-md);
}

.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border: 2px solid;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;

  .action-icon {
    font-size: 24px;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}
</style>
