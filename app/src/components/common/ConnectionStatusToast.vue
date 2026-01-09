<script setup lang="ts">
import { computed, watch } from 'vue'
import { useConnectionOrchestrator } from '@/stores/connectionOrchestrator'

const orchestrator = useConnectionOrchestrator()

const show = computed(() => {
  return orchestrator.isConnecting && ['checking', 'reconnecting', 'authenticating'].includes(orchestrator.currentState.phase)
})

const icon = computed(() => {
  switch (orchestrator.currentState.phase) {
    case 'checking': return '🔍'
    case 'reconnecting': return '🔄'
    case 'authenticating': return '🔐'
    case 'success': return '✓'
    case 'failed': return '⚠️'
    default: return '🔌'
  }
})

const statusClass = computed(() => {
  return `status-${orchestrator.currentState.phase}`
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="show" class="connection-status-toast" :class="statusClass">
      <div class="toast-content">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
        <div class="status-text">
          <span class="status-icon">{{ icon }}</span>
          <span class="status-message">{{ orchestrator.currentState.message }}</span>
        </div>
        <div v-if="orchestrator.currentState.progress" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${orchestrator.currentState.progress}%` }"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.connection-status-toast {
  position: fixed;
  bottom: var(--spacing-xl);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9000;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: var(--spacing-lg);
  min-width: 320px;
  max-width: 480px;

  &.status-success {
    border-color: $positive;
  }

  &.status-failed {
    border-color: $negative;
  }
}

.toast-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.spinner-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba($primary, 0.3);
  border-top-color: $primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.status-icon {
  font-size: 20px;
}

.status-message {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: var(--spacing-xs);
}

.progress-fill {
  height: 100%;
  background: $primary;
  transition: width 0.3s ease;
}

// Transitions
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translate(-50%, 20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

// Responsive
@media (max-width: 480px) {
  .connection-status-toast {
    left: var(--spacing-md);
    right: var(--spacing-md);
    transform: none;
    min-width: auto;
  }
}
</style>
