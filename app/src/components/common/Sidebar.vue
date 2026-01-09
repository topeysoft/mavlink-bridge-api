<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { useFeaturesStore } from '@/stores/features'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import { useSidebar } from '@/composables/useSidebar'
import { useDialog } from '@/composables/useDialog'
import type { ViewName } from '@/types'
import type { FeatureFlags } from '@/stores/features'

const { t } = useI18n()

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const featuresStore = useFeaturesStore()
const authStore = useAuthStore()
const connectionStore = useConnectionStore()
const { collapsed, mobileOpen, isMobile, toggleSidebar, closeMobileSidebar } = useSidebar()
const { confirm } = useDialog()
const toast = inject<any>('toast')

interface NavItem {
  name: ViewName
  label: string
  icon: string
  requiresFeature?: keyof FeatureFlags
}

// SVG icon components
const icons: Record<string, string> = {
  dashboard: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  extension: '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>',
  place: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>',
  assignment: '<path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>',
  control: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  monitor: '<path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>',
  calendar_month: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>',
  description: '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
  tune: '<path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>',
  calibration: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  rtcm: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><circle cx="12" cy="12" r="2"/>',
  shield: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
  flag: '<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>',
  battery: '<path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>',
  cloud: '<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>',
  wifi: '<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>',
  settings: '<path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>'
}

// Consumer-friendly labels for navigation items (now using i18n)
interface NavItemConfig extends NavItem {
  consumerHidden?: boolean // Hide from consumer sidebar (accessible via settings)
}

const allNavItems: NavItemConfig[] = [
  { name: 'dashboard', label: 'nav.dashboard', icon: 'dashboard' },
  { name: 'peripherals', label: 'nav.peripherals', icon: 'extension' },
  { name: 'zones', label: 'nav.zones', icon: 'place' },
  { name: 'missions', label: 'nav.missions', icon: 'assignment', requiresFeature: 'missionTemplates' },
  { name: 'control', label: 'nav.control', icon: 'control', requiresFeature: 'vehicleControl' },
  { name: 'monitoring', label: 'nav.monitoring', icon: 'monitor', requiresFeature: 'systemMonitoring' },
  { name: 'schedule', label: 'nav.schedule', icon: 'calendar_month', requiresFeature: 'missionScheduling' },
  { name: 'logs', label: 'nav.logs', icon: 'description', requiresFeature: 'activityLogs' },
  { name: 'calibration', label: 'nav.calibration', icon: 'calibration', consumerHidden: true },
  { name: 'rtcm', label: 'nav.rtcm', icon: 'rtcm', requiresFeature: 'rtcmClient', consumerHidden: true },
  { name: 'parameters', label: 'nav.parameters', icon: 'tune', requiresFeature: 'parameterConfiguration' },
  { name: 'battery', label: 'nav.battery', icon: 'battery', requiresFeature: 'batteryManagement' },
  { name: 'weather', label: 'nav.weather', icon: 'cloud', requiresFeature: 'weatherIntegration' },
  { name: 'settings', label: 'nav.settings', icon: 'settings' }
]

const navItems = computed(() => {
  const isConsumerMode = featuresStore.userMode === 'consumer'

  return allNavItems.filter(item => {
    // Hide consumer-hidden items in consumer mode
    if (isConsumerMode && item.consumerHidden) return false

    if (!item.requiresFeature) return true
    return featuresStore.isFeatureEnabled(item.requiresFeature)
  }).map(item => ({
    ...item,
    // Translate label using i18n (automatically switches based on mode)
    label: t(item.label)
  }))
})

function isActive(name: string): boolean {
  return route.name === name
}

function navigateTo(name: string) {
  router.push({ name })
  // Close mobile drawer after navigation
  closeMobileSidebar()
}

// Get username for display
const displayName = computed(() => {
  if (authStore.currentUser?.username) {
    return authStore.currentUser.username
  }
  return 'User'
})

// Logout handler
async function handleLogout() {
  const confirmed = await confirm(
    'You will be logged out and redirected to the login page.',
    'Logout?',
    {
      confirmText: 'Logout',
      cancelText: 'Cancel',
      variant: 'warning',
      icon: '👋'
    }
  )

  if (confirmed) {
    try {
      // Get authClient from existing connection
      const authClient = (connectionStore.client as any)?.authClient

      if (authClient) {
        // Proper logout through auth store (async - revokes refresh token on server)
        await authStore.logout(authClient)
      } else {
        console.warn('No authClient available, clearing local state only')
        // Note: This shouldn't happen in normal flow, but handle it gracefully
        // We still need to clear the state even if we can't notify the backend
        authStore.isAuthenticated = false
        authStore.accessToken = null
        authStore.refreshToken = null
        authStore.expiresAt = null
        authStore.refreshExpiresAt = null
        authStore.role = null
        authStore.permissions = []
        authStore.currentUser = null
        authStore.sessionTimeoutWarning = false
        authStore.loginError = null
        authStore.setupStatus = null // Clear setup status
      }

      // Clear persisted connection to prevent auto-reconnect from restoring auth
      localStorage.removeItem('yardrover_current_connection')

      // Redirect to login (use replace to prevent back button issues)
      await router.replace({ name: 'login' })

      // Show success notification after redirect
      toast?.value?.addToast({
        message: 'Logged out successfully',
        type: 'success',
        duration: 3000,
        dismissible: true
      })
    } catch (error) {
      console.error('Logout error:', error)
      toast?.value?.addToast({
        message: 'Error during logout',
        type: 'error',
        duration: 5000,
        dismissible: true
      })
    }
  }
}
</script>

<template>
  <!-- Mobile overlay backdrop -->
  <Transition name="overlay">
    <div
      v-if="isMobile && mobileOpen"
      class="sidebar-overlay"
      @click="closeMobileSidebar"
      aria-hidden="true"
    ></div>
  </Transition>

  <!-- Sidebar -->
  <nav class="sidebar" :class="{ collapsed, 'mobile-open': mobileOpen, 'is-mobile': isMobile }">
    <div class="sidebar-header">
      <div class="logo">
        <svg viewBox="0 0 40 40" class="logo-icon">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M20 8 L20 32 M12 20 L28 20" stroke="currentColor" stroke-width="2"/>
          <circle cx="20" cy="20" r="3" fill="currentColor"/>
        </svg>
        <span class="logo-text">YardRover</span>
      </div>
      <button class="sidebar-toggle" @click="toggleSidebar" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </div>

    <ul class="nav-menu" role="navigation" aria-label="Main navigation">
      <li
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: isActive(item.name) }"
        role="button"
        tabindex="0"
        :aria-label="`Navigate to ${item.label}`"
        :aria-current="isActive(item.name) ? 'page' : undefined"
        @click="navigateTo(item.name)"
        @keydown.enter="navigateTo(item.name)"
        @keydown.space.prevent="navigateTo(item.name)"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor" v-html="icons[item.icon]" aria-hidden="true"></svg>
        <span class="nav-text">{{ item.label }}</span>
      </li>
    </ul>

    <div class="sidebar-footer">
      <!-- User Info -->
      <div class="user-info" v-if="!collapsed">
        <svg class="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span class="user-name">{{ displayName }}</span>
      </div>

      <!-- Theme Toggle -->
      <button class="footer-btn theme-toggle" @click="themeStore.toggleTheme" :aria-label="`Switch to ${themeStore.theme === 'light' ? 'dark' : 'light'} mode`">
        <svg v-if="themeStore.theme === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <span class="nav-text">{{ themeStore.theme === 'light' ? 'Dark' : 'Light' }} Mode</span>
      </button>

      <!-- Logout Button -->
      <button class="footer-btn logout-btn" @click="handleLogout" aria-label="Logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        <span class="nav-text">Logout</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: var(--sidebar-width);
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 1000;
}

.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  height: var(--header-height);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--primary-green);
}

.logo-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.logo-text {
  font-size: var(--font-size-xl);
  font-weight: 700;
  white-space: nowrap;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.sidebar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.sidebar-toggle svg {
  width: 20px;
  height: 20px;
}

.sidebar-toggle:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-menu {
  flex: 1;
  list-style: none;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  cursor: pointer;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 0.2s;
  user-select: none;
}

.nav-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.nav-text {
  white-space: nowrap;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .nav-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--primary-green);
  color: white;
}

.sidebar-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.user-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-green);
  flex-shrink: 0;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.footer-btn svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.footer-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.logout-btn:hover {
  background: var(--status-danger);
  color: white;
}

// Mobile overlay
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  backdrop-filter: blur(2px);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

// Mobile styles
@include mobile {
  .sidebar.is-mobile {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 1001;
    box-shadow: var(--shadow-lg);

    &.mobile-open {
      transform: translateX(0);
    }
  }

  .sidebar-toggle {
    display: none; // Hide collapse button on mobile
  }
}

// Desktop - hide overlay
@include desktop {
  .sidebar-overlay {
    display: none;
  }
}
</style>
