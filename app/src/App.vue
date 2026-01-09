<script setup lang="ts">
import { ref, provide, onMounted, computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import Sidebar from './components/common/Sidebar.vue'
import Header from './components/common/Header.vue'
import KeyboardShortcutsModal from './components/common/KeyboardShortcutsModal.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import OfflineBanner from './components/common/OfflineBanner.vue'
import OnboardingFlow from './components/consumer/OnboardingFlow.vue'
import ConfirmDialog from './components/common/ConfirmDialog.vue'
import AlertDialog from './components/common/AlertDialog.vue'
import SessionTimeout from './components/auth/SessionTimeout.vue'
import { useThemeStore } from './stores/theme'
import { useFeaturesStore } from './stores/features'
import { useConnectionStore } from './stores/connection'
import { useAuthStore } from './stores/auth'
import { useSidebar } from './composables/useSidebar'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'
import type { ConfirmOptions, AlertOptions } from './composables/useDialog'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const featuresStore = useFeaturesStore()
const connectionStore = useConnectionStore()
const authStore = useAuthStore()
const { mainContentMargin, mainContentWidth } = useSidebar()

// Determine if we should show the full app (sidebar + header + routes)
// or just standalone views (connection/setup/login)
const showFullApp = computed(() => {
  // Don't show full app if disconnected
  if (!connectionStore.isConnected) {
    return false
  }

  // Don't show full app if in setup mode (first-time setup)
  if (authStore.needsSetup) {
    return false
  }

  // Don't show full app if not authenticated
  if (!authStore.isAuthenticated) {
    return false
  }

  // Show full app if connected, setup is complete, and authenticated
  return true
})

// Keyboard shortcuts
const showShortcuts = ref(false)
const { setupGlobalShortcuts, getAllShortcuts } = useKeyboardShortcuts()

const shortcuts = getAllShortcuts()

// Toast notifications
const toastContainer = ref<InstanceType<typeof ToastContainer> | null>(null)
provide('toast', toastContainer)

// Dialog management
const showConfirmDialog = ref(false)
const showAlertDialog = ref(false)
const currentConfirmOptions = ref<ConfirmOptions>({ message: '' })
const currentAlertOptions = ref<AlertOptions>({ message: '' })
let confirmResolve: ((value: boolean) => void) | null = null
let alertResolve: (() => void) | null = null

const dialogManager = computed(() => ({
  showConfirm: (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      currentConfirmOptions.value = options
      confirmResolve = resolve
      showConfirmDialog.value = true
    })
  },
  showAlert: (options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      currentAlertOptions.value = options
      alertResolve = resolve
      showAlertDialog.value = true
    })
  }
}))

provide('dialogManager', dialogManager)

const handleConfirmResult = (confirmed: boolean) => {
  if (confirmResolve) {
    confirmResolve(confirmed)
    confirmResolve = null
  }
}

const handleAlertClose = () => {
  if (alertResolve) {
    alertResolve()
    alertResolve = null
  }
}

// Onboarding
const showOnboarding = ref(false)

onMounted(async () => {
  // Attempt to auto-reconnect to last connected device
  if (connectionStore.hasPersistedConnection()) {
    const reconnected = await connectionStore.autoReconnect()

    if (reconnected) {
      toastContainer.value?.addToast({
        message: `Reconnected to ${connectionStore.currentDeviceName}`,
        type: 'success',
        duration: 3000
      })
    } else {
      // Only show error if we had a persisted connection but failed to reconnect
      toastContainer.value?.addToast({
        message: 'Could not reconnect to your device. Please connect manually.',
        type: 'warning',
        duration: 5000
      })
    }
  }

  // Show onboarding for first-time consumer mode users
  const hasCompletedOnboarding = localStorage.getItem('yardrover_onboarding_completed')
  if (!hasCompletedOnboarding && featuresStore.userMode === 'consumer') {
    setTimeout(() => {
      showOnboarding.value = true
    }, 500)
  }

  // Listen for battery notifications
  window.addEventListener('battery-notification', handleBatteryNotification as EventListener)
})

// Battery notification handler
const handleBatteryNotification = (event: CustomEvent) => {
  const { type, message } = event.detail
  toastContainer.value?.addToast({
    message,
    type: type as 'success' | 'error' | 'warning' | 'info',
    duration: type === 'error' ? 8000 : 5000,
    dismissible: true
  })
}

// Setup global shortcuts
setupGlobalShortcuts({
  showShortcuts: () => {
    showShortcuts.value = true
  },
  toggleTheme: () => {
    themeStore.toggleTheme()
  },
  emergencyStop: () => {
    handleEmergencyStop()
  }
})

// Emergency stop handler
const handleEmergencyStop = async () => {
  const confirmed = await dialogManager.value.showConfirm({
    title: '⚠️ EMERGENCY STOP',
    message: 'Are you sure you want to trigger an emergency stop? This will immediately halt all operations.',
    variant: 'danger',
    confirmText: 'Emergency Stop',
    cancelText: 'Cancel',
    icon: '⚠️'
  })

  if (confirmed) {
    toastContainer.value?.addToast({
      message: 'Emergency stop activated. All operations have been halted.',
      type: 'error',
      duration: 0,
      dismissible: true
    })
    // TODO: Add actual emergency stop logic here
  }
}
</script>

<template>
  <div class="app-container">
    <!-- Offline Detection Banner -->
    <OfflineBanner />

    <!-- Full App Layout (only when connected, setup complete, and authenticated) -->
    <template v-if="showFullApp">
      <Sidebar />
      <main class="main-content" :style="{ marginLeft: mainContentMargin, width: mainContentWidth }">
        <Header />
        <div class="view-container">
          <ErrorBoundary>
            <RouterView v-slot="{ Component, route }">
              <Transition name="page">
                <component :is="Component" :key="route.path" />
              </Transition>
            </RouterView>
          </ErrorBoundary>
        </div>
      </main>
    </template>

    <!-- Standalone Views (connection, setup, login) -->
    <div v-else class="standalone-container">
      <ErrorBoundary>
        <RouterView />
      </ErrorBoundary>
    </div>

    <!-- Keyboard Shortcuts Modal -->
    <KeyboardShortcutsModal
      v-model="showShortcuts"
      :shortcuts="shortcuts"
    />

    <!-- Consumer Onboarding -->
    <OnboardingFlow
      v-model="showOnboarding"
      @complete="showOnboarding = false"
    />

    <!-- Toast Notifications -->
    <ToastContainer ref="toastContainer" />

    <!-- Session Timeout Warning -->
    <SessionTimeout />

    <!-- Dialogs -->
    <ConfirmDialog
      v-model="showConfirmDialog"
      :title="currentConfirmOptions.title"
      :message="currentConfirmOptions.message"
      :confirmText="currentConfirmOptions.confirmText"
      :cancelText="currentConfirmOptions.cancelText"
      :variant="currentConfirmOptions.variant"
      :icon="currentConfirmOptions.icon"
      @confirm="handleConfirmResult(true)"
      @cancel="handleConfirmResult(false)"
    />
    <AlertDialog
      v-model="showAlertDialog"
      :title="currentAlertOptions.title"
      :message="currentAlertOptions.message"
      :buttonText="currentAlertOptions.buttonText"
      :variant="currentAlertOptions.variant"
      :icon="currentAlertOptions.icon"
      @close="handleAlertClose"
    />
  </div>
</template>

<style lang="scss">
@use './assets/styles/variables';

// Import Leaflet CSS globally
@import 'leaflet/dist/leaflet.css';
@import 'leaflet-draw/dist/leaflet.draw.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  background: var(--bg-secondary);
  line-height: 1.5;
  overflow-x: hidden;
  transition: background-color var(--transition-slow), color var(--transition-slow);
}

input,
select,
textarea,
option {
  color: var(--text-primary);
}

input::placeholder,
textarea::placeholder {
  color: var(--text-light);
  opacity: 1;
}

select option {
  background: var(--bg-primary);
  color: var(--text-primary);
}

// Focus visible styles for accessibility
*:focus-visible {
  outline: 3px solid var(--primary-green);
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible,
.btn:focus-visible {
  outline: 3px solid var(--primary-green);
  outline-offset: 2px;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--primary-green);
  outline-offset: 0;
  border-color: var(--primary-green);
}

// Global button styles
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-green-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-secondary);
    border-color: var(--text-secondary);
  }
}

.btn-danger {
  background: var(--status-danger);
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.app-container {
  min-height: 100vh;
}

.main-content {
  transition: margin-left 0.3s ease, width 0.3s ease;
  min-height: 100vh;
}

.view-container {
  position: relative;
  min-height: calc(100vh - var(--header-height));
}

// Page transitions
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-enter-active {
  transition-delay: 0.15s;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.page-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.standalone-container {
  min-height: 100vh;
  width: 100vw;
}
</style>
