<script setup lang="ts">
interface Props {
  variant?: 'info' | 'success' | 'warning' | 'error'
  icon?: string
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info'
})

const variantColors = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444'
}

const defaultIcons = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '❌'
}

const displayIcon = props.icon || defaultIcons[props.variant]
</script>

<template>
  <div class="info-banner" :class="[`info-banner--${variant}`]">
    <div class="banner-icon-wrapper">
      <span v-if="displayIcon" class="banner-emoji">{{ displayIcon }}</span>
      <svg v-else class="banner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    </div>
    <div class="banner-content">
      <strong v-if="title" class="banner-title">{{ title }}</strong>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.info-banner {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid;

  &--info {
    background: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.3);

    .banner-svg {
      color: #3b82f6;
    }
  }

  &--success {
    background: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.3);

    .banner-svg {
      color: #10b981;
    }
  }

  &--warning {
    background: rgba(245, 158, 11, 0.05);
    border-color: rgba(245, 158, 11, 0.3);

    .banner-svg {
      color: #f59e0b;
    }
  }

  &--error {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.3);

    .banner-svg {
      color: #ef4444;
    }
  }
}

.banner-icon-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  margin-top: 2px;
}

.banner-emoji {
  font-size: 1.5rem;
  line-height: 1;
}

.banner-svg {
  width: 20px;
  height: 20px;
}

.banner-content {
  flex: 1;
  min-width: 0;

  :deep(p) {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.6;

    &:not(:last-child) {
      margin-bottom: var(--spacing-sm);
    }
  }
}

.banner-title {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}
</style>
