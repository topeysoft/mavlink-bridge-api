<template>
  <Teleport to="body">
    <div v-if="showWarning" class="session-timeout-overlay">
      <div class="session-timeout-dialog">
        <div class="dialog-icon">⏰</div>
        <h2>Session Expiring Soon</h2>
        <p class="warning-message">
          Your session will expire in
          <strong>{{ formattedTimeRemaining }}</strong
          >.
        </p>
        <p class="info-message">
          You'll be automatically logged out when your session expires. Save any work and
          log in again to continue.
        </p>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="dismiss">I Understand</button>
          <button class="btn-primary" @click="goToLogin">Go to Login</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// State
const timeRemaining = ref(0)
let updateInterval: number | null = null

// Computed
const showWarning = computed(() => authStore.sessionTimeoutWarning)

const formattedTimeRemaining = computed(() => {
  const totalSeconds = Math.max(0, Math.floor(timeRemaining.value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${
      seconds !== 1 ? 's' : ''
    }`
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`
})

// Actions
function dismiss() {
  authStore.dismissSessionWarning()
}

function goToLogin() {
  authStore.dismissSessionWarning()
  router.push('/login')
}

function updateTimeRemaining() {
  const remaining = authStore.timeUntilExpiry
  timeRemaining.value = remaining !== null ? remaining : 0
}

// Watch for warning state changes
watch(
  () => authStore.sessionTimeoutWarning,
  (newValue) => {
    if (newValue) {
      // Start updating time remaining
      updateTimeRemaining()
      updateInterval = window.setInterval(updateTimeRemaining, 1000)
    } else {
      // Stop updating
      if (updateInterval !== null) {
        clearInterval(updateInterval)
        updateInterval = null
      }
    }
  },
  { immediate: true }
)

// Cleanup
onUnmounted(() => {
  if (updateInterval !== null) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use 'sass:color';

.session-timeout-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  animation: fadeIn 0.2s ease-out;
}

.session-timeout-dialog {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
  text-align: center;

  .dialog-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: pulse 2s ease-in-out infinite;
  }

  h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1rem;
  }

  .warning-message {
    font-size: 1.125rem;
    color: var(--text-primary);
    margin: 0 0 1rem;
    line-height: 1.6;

    strong {
      color: var(--status-warning);
      font-weight: 700;
    }
  }

  .info-message {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin: 0 0 2rem;
    line-height: 1.6;
  }

  .dialog-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;

    button {
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 120px;

      &.btn-primary {
        background: $primary;
        color: white;

        &:hover {
          background: color.adjust($primary, $lightness: -10%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba($primary, 0.3);
        }

        &:active {
          transform: translateY(0);
        }
      }

      &.btn-secondary {
        background: #f5f5f5;
        color: var(--text-primary);
        border: 1px solid #ddd;

        &:hover {
          background: #e8e8e8;
        }

        &:active {
          background: #ddd;
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

// Responsive
@media (max-width: 640px) {
  .session-timeout-dialog {
    padding: 1.5rem;

    .dialog-icon {
      font-size: 3rem;
    }

    h2 {
      font-size: 1.5rem;
    }

    .dialog-actions {
      flex-direction: column;

      button {
        width: 100%;
      }
    }
  }
}
</style>
