<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-card">
      <div class="error-content">
        <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <h5>Something went wrong</h5>
        <p class="error-message">
          {{ errorMessage }}
        </p>

        <div class="error-actions">
          <button class="btn btn-primary" @click="retry">
            Try Again
          </button>
          <button
            class="btn btn-secondary"
            @click="showDetails = !showDetails"
          >
            {{ showDetails ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>

        <div v-if="showDetails && errorInfo" class="error-details">
          <div class="error-detail-item">
            <strong>Component:</strong> {{ errorInfo.componentName || 'Unknown' }}
          </div>
          <div class="error-detail-item">
            <strong>Time:</strong> {{ formatTimestamp(errorInfo.timestamp) }}
          </div>
          <div class="error-detail-item">
            <strong>Error:</strong>
          </div>
          <pre class="error-stack">{{ errorInfo.error.stack || errorInfo.error.message }}</pre>
        </div>
      </div>
    </div>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useErrorBoundary } from '@/composables/useErrorBoundary'

const { hasError, errorInfo, clearError, retry: retryError } = useErrorBoundary()
const showDetails = ref(false)

const errorMessage = computed(() => {
  if (!errorInfo.value) return 'An unexpected error occurred.'
  const msg = errorInfo.value.error.message
  return msg || 'The component encountered an error and could not render.'
})

function retry() {
  showDetails.value = false
  retryError()
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.error-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.error-content {
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  color: var(--status-danger);
  margin: 0 auto 1rem;
}

h5 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 1rem 0 0.5rem;
}

.error-message {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.error-details {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1.5rem;
  text-align: left;
}

.error-detail-item {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;

  strong {
    color: var(--text-primary);
  }
}

.error-stack {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 0.5rem;
  border: 1px solid var(--border-color);
}
</style>
