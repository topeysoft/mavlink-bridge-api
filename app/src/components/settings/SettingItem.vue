<script setup lang="ts">
interface Props {
  icon?: string
  label: string
  description?: string
  helpText?: string
}

defineProps<Props>()
</script>

<template>
  <div class="setting-item">
    <div class="setting-header">
      <div class="setting-info">
        <div class="setting-label">
          <span v-if="icon" class="setting-icon">{{ icon }}</span>
          {{ label }}
          <span v-if="helpText" class="help-tooltip" :title="helpText">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </span>
        </div>
        <div v-if="description" class="setting-desc">{{ description }}</div>
      </div>
      <div class="setting-control">
        <slot />
      </div>
    </div>
    <div v-if="$slots.content" class="setting-content">
      <slot name="content" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-item {
  // No extra padding - Card component handles it
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.setting-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.help-tooltip {
  display: inline-flex;
  align-items: center;
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.setting-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.setting-content {
  margin-top: var(--spacing-md);
}

@media (max-width: 640px) {
  .setting-header {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .setting-control {
    align-self: stretch;
  }
}
</style>
