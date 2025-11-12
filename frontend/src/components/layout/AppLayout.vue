<template>
  <q-layout view="lHh LpR lFf">
    <!-- Header -->
    <q-header elevated class="bg-primary text-white" :class="{ 'q-header--dark': isDark }">
      <q-toolbar>
        <!-- Menu toggle for mobile -->
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          class="q-mr-sm"
          @click="toggleSidebar"
        />

        <!-- Logo and title -->
        <q-toolbar-title class="row items-center no-wrap">
          <q-avatar size="32px" class="q-mr-sm">
            <q-icon name="grass" size="24px" />
          </q-avatar>
          <span class="text-weight-medium">YardRover</span>
          <q-badge v-if="isDevelopment" color="orange" class="q-ml-sm" text-color="white">
            DEV
          </q-badge>
        </q-toolbar-title>

        <!-- Connection status indicator -->
        <ConnectionStatus class="q-mr-md" />

        <!-- Notifications -->
        <NotificationButton class="q-mr-sm" />

        <!-- User menu -->
        <UserMenu />
      </q-toolbar>
    </q-header>

    <!-- Left Sidebar -->
    <q-drawer
      v-model="sidebarOpen"
      show-if-above
      :mini="sidebarMini"
      :mini-to-overlay="miniToOverlay"
      :width="260"
      :breakpoint="1024"
      bordered
      class="bg-grey-1"
      :class="{ 'bg-grey-9': isDark }"
    >
      <MainSidebar :mini="sidebarMini" @toggle-mini="toggleSidebarMini" />
    </q-drawer>

    <!-- Main content area -->
    <q-page-container>
      <router-view v-slot="{ Component, route }">
        <transition :name="getTransitionName(route)" mode="out-in" appear>
          <component :is="Component" :key="route.path" class="page-content" />
        </transition>
      </router-view>

      <!-- Loading overlay -->
      <q-inner-loading
        :showing="isGlobalLoading"
        color="primary"
        label="Loading..."
        label-class="text-primary"
        label-style="font-size: 1.1em"
      />
    </q-page-container>

    <!-- Footer (optional, can be hidden) -->
    <q-footer v-if="showFooter" elevated class="bg-grey-8 text-white">
      <AppFooter />
    </q-footer>

    <!-- Global dialogs and modals -->
    <GlobalDialogs />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import { useUIStore, useStoreComputeds, useAuthStore } from '@/stores'
import { useRealTime } from '@/stores/composables/useRealTime'

// Components
import MainSidebar from './MainSidebar.vue'
import ConnectionStatus from './ConnectionStatus.vue'
import NotificationButton from './NotificationButton.vue'
import UserMenu from './UserMenu.vue'
import AppFooter from './AppFooter.vue'
import GlobalDialogs from './GlobalDialogs.vue'

// Composables
const $q = useQuasar()
const route = useRoute()
const ui = useUIStore()
const auth = useAuthStore()
const { isAnyLoading } = useStoreComputeds()
const realtime = useRealTime()

// Computed properties
const sidebarOpen = computed({
  get: () => ui.isSidebarOpen,
  set: (value: boolean) => ui.setSidebarOpen(value)
})

const sidebarMini = computed({
  get: () => ui.isSidebarMini,
  set: (value: boolean) => ui.setSidebarMini(value)
})

const isDark = computed(() => ui.currentTheme === 'dark')
const isGlobalLoading = computed(() => isAnyLoading.value)
const isDevelopment = computed(() => import.meta.env.DEV)
const showFooter = computed(() => route.meta?.showFooter !== false)

// Responsive behavior
const miniToOverlay = computed(() => $q.screen.lt.lg)

// Methods
const toggleSidebar = () => {
  ui.toggleSidebar()
}

const toggleSidebarMini = () => {
  ui.toggleSidebarMini()
}

const getTransitionName = (currentRoute: any) => {
  // Different transitions for different route types
  if (currentRoute.meta?.transition) {
    return currentRoute.meta.transition
  }

  // Default transitions based on route depth
  const depth = currentRoute.path.split('/').length
  if (depth <= 2) {
    return 'slide-fade'
  }
  return 'fade'
}

// Responsive layout management
const handleResize = () => {
  const breakpoint = $q.screen.name
  ui.setResponsiveLayout(breakpoint as any)
}

// Keyboard shortcuts
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  ui.handleKeyboardShortcut(event)
}

// Theme initialization
const initializeTheme = () => {
  ui.initializeTheme()
}

// WebSocket connection
const initializeRealTime = () => {
  if (auth.isAuthenticated) {
    // Connect to WebSocket for real-time updates
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
    realtime.connect(wsUrl)

    // Configure auto-reconnect
    realtime.configureReconnect(5, 5000)
  }
}

// Lifecycle
onMounted(() => {
  // Initialize theme
  initializeTheme()

  // Set up responsive handling
  window.addEventListener('resize', handleResize)
  handleResize()

  // Set up keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts)

  // Initialize real-time connection
  initializeRealTime()

  // Set initial page title
  ui.setPageTitle('Dashboard')
})

onUnmounted(() => {
  // Cleanup event listeners
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('keydown', handleKeyboardShortcuts)

  // Disconnect WebSocket
  realtime.disconnect()
})

// Watch for authentication changes
const unwatchAuth = auth.$subscribe((mutation, state) => {
  if (state.isAuthenticated && !realtime.isConnected) {
    initializeRealTime()
  } else if (!state.isAuthenticated && realtime.isConnected) {
    realtime.disconnect()
  }
})

// Cleanup subscription
onUnmounted(() => {
  unwatchAuth()
})
</script>

<style lang="scss" scoped>
.q-layout {
  min-height: 100vh;
}

.q-header--dark {
  background: linear-gradient(135deg, var(--q-primary) 0%, var(--q-secondary) 100%);
}

.page-content {
  min-height: calc(100vh - 50px);
  padding: 16px;
}

// Page transitions
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Responsive adjustments
.q-toolbar {
  @media (max-width: 599px) {
    padding: 0 8px;
    min-height: 48px;
  }
}

// Dark theme adjustments
.body--dark {
  .page-content {
    background-color: var(--q-dark-page);
    color: var(--q-dark);
  }
}

// Loading overlay customization
:deep(.q-inner-loading) {
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.7);

  .body--dark & {
    background-color: rgba(0, 0, 0, 0.7);
  }
}

// Accessibility improvements
.q-btn[aria-label] {
  &:focus {
    outline: 2px solid var(--q-primary);
    outline-offset: 2px;
  }
}
</style>
