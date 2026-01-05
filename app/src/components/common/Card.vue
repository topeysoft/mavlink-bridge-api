<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  noPadding?: boolean
  lastUpdated?: string
  autoRefresh?: boolean
}

defineProps<Props>()
defineEmits<{
  refresh: []
}>()
</script>

<template>
  <div class="card">
    <div v-if="title || subtitle || $slots.header || lastUpdated" class="card-header">
      <div class="card-header-content">
        <slot name="header">
          <div v-if="title" class="card-title">{{ title }}</div>
          <div v-if="subtitle" class="card-subtitle">{{ subtitle }}</div>
        </slot>
      </div>
      <div v-if="lastUpdated || $slots.actions" class="card-header-actions">
        <slot name="actions" />
        <span v-if="lastUpdated" class="last-updated" :class="{ 'auto-refresh': autoRefresh }">
          {{ lastUpdated }}
        </span>
      </div>
    </div>
    <div class="card-body" :class="{ 'no-padding': noPadding }">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.card {
  @include card;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  .card-header-content {
    flex: 1;
  }

  .card-header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .card-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .card-subtitle {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .last-updated {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    white-space: nowrap;

    &.auto-refresh {
      color: var(--status-success);
      position: relative;

      &::before {
        content: '●';
        margin-right: 4px;
        animation: pulse 2s ease-in-out infinite;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.card-body {
  padding: var(--spacing-lg);

  &.no-padding {
    padding: 0;
  }
}

.card-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
</style>
