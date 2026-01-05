<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: string
  iconPosition?: 'left' | 'right'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  iconPosition: 'left'
})
</script>

<template>
  <button
    class="btn"
    :class="[
      `btn-${variant}`,
      `btn-${size}`,
      { 'btn-loading': loading, 'btn-full-width': fullWidth }
    ]"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-busy="loading"
  >
    <span v-if="loading" class="spinner" aria-hidden="true"></span>
    <template v-else>
      <slot name="icon-left" v-if="iconPosition === 'left'">
        <svg v-if="icon" class="btn-icon" viewBox="0 0 24 24" fill="currentColor" v-html="icon" aria-hidden="true"></svg>
      </slot>
      <span class="btn-content"><slot /></span>
      <slot name="icon-right" v-if="iconPosition === 'right'">
        <svg v-if="icon" class="btn-icon" viewBox="0 0 24 24" fill="currentColor" v-html="icon" aria-hidden="true"></svg>
      </slot>
    </template>
  </button>
</template>

<style scoped lang="scss">
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:not(:disabled):hover {
    background: var(--primary-green-dark);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);

  &:not(:disabled):hover {
    background: var(--border-color);
  }
}

.btn-danger {
  background: var(--status-error);
  color: white;

  &:not(:disabled):hover {
    opacity: 0.9;
  }
}

.btn-success {
  background: var(--status-success);
  color: white;

  &:not(:disabled):hover {
    opacity: 0.9;
  }
}

.btn-outline {
  background: transparent;
  border: 2px solid var(--primary-green);
  color: var(--primary-green);

  &:not(:disabled):hover {
    background: var(--primary-green);
    color: white;
  }
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
}

.btn-lg {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-lg);
}

.btn-full-width {
  width: 100%;
}

.btn-loading {
  position: relative;

  .btn-content {
    visibility: hidden;
  }
}

.btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.btn-content {
  display: inline-flex;
  align-items: center;
}

.spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
