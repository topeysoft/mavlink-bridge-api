<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  dismissible: true
})

const emit = defineEmits<{
  dismiss: []
}>()

const iconPath = computed(() => {
  switch (props.type) {
    case 'success':
      return '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
    case 'error':
      return '<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>'
    case 'warning':
      return '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'
    case 'info':
    default:
      return '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>'
  }
})

const handleDismiss = () => {
  emit('dismiss')
}
</script>

<template>
  <div class="toast" :class="`toast-${type}`" role="alert" aria-live="polite">
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" v-html="iconPath" aria-hidden="true"></svg>
    </div>
    <div class="toast-message">{{ message }}</div>
    <button
      v-if="dismissible"
      class="toast-dismiss"
      @click="handleDismiss"
      aria-label="Dismiss notification"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border-left: 4px solid;
  min-width: 300px;
  max-width: 500px;
  animation: slideIn 0.3s ease-out;

  @media (max-width: 768px) {
    min-width: 280px;
    max-width: calc(100vw - 2rem);
  }
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 100%;
    height: 100%;
  }
}

.toast-message {
  flex: 1;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.toast-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: var(--spacing-xs);
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}

.toast-success {
  border-left-color: var(--status-success);

  .toast-icon {
    color: var(--status-success);
  }
}

.toast-error {
  border-left-color: var(--status-danger);

  .toast-icon {
    color: var(--status-danger);
  }
}

.toast-warning {
  border-left-color: var(--status-warning);

  .toast-icon {
    color: var(--status-warning);
  }
}

.toast-info {
  border-left-color: var(--status-info);

  .toast-icon {
    color: var(--status-info);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
