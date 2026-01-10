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
import { getIcon, type IconName } from '@/utils/iconMap'
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
  icon: IconName
  requiresFeature?: keyof FeatureFlags
}

// Consumer-friendly labels for navigation items (now using i18n)
interface NavItemConfig extends NavItem {
  consumerHidden?: boolean // Hide from consumer sidebar (accessible via settings)
}

const allNavItems: NavItemConfig[] = [
  { name: 'dashboard', label: 'nav.dashboard', icon: 'dashboard' },
  { name: 'peripherals', label: 'nav.peripherals', icon: 'peripherals' },
  { name: 'zones', label: 'nav.zones', icon: 'zones' },
  { name: 'missions', label: 'nav.missions', icon: 'missions', requiresFeature: 'missionTemplates' },
  { name: 'control', label: 'nav.control', icon: 'control', requiresFeature: 'vehicleControl' },
  { name: 'monitoring', label: 'nav.monitoring', icon: 'monitoring', requiresFeature: 'systemMonitoring' },
  { name: 'schedule', label: 'nav.schedule', icon: 'schedule', requiresFeature: 'missionScheduling' },
  { name: 'logs', label: 'nav.logs', icon: 'logs', requiresFeature: 'activityLogs' },
  { name: 'calibration', label: 'nav.calibration', icon: 'calibration', consumerHidden: true },
  { name: 'rtcm', label: 'nav.rtcm', icon: 'rtcm', requiresFeature: 'rtcmClient', consumerHidden: true },
  { name: 'parameters', label: 'nav.parameters', icon: 'parameters', requiresFeature: 'parameterConfiguration' },
  { name: 'battery', label: 'nav.battery', icon: 'battery', requiresFeature: 'batteryManagement' },
  { name: 'weather', label: 'nav.weather', icon: 'weather', requiresFeature: 'weatherIntegration' },
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
        <component :is="getIcon('menu')" :size="20" :stroke-width="2" />
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
        <component :is="getIcon(item.icon)" class="nav-icon" :size="24" :stroke-width="2" aria-hidden="true" />
        <span class="nav-text">{{ item.label }}</span>
      </li>
    </ul>

    <div class="sidebar-footer">
      <!-- User Info -->
      <div class="user-info" v-if="!collapsed">
        <component :is="getIcon('user')" class="user-icon" :size="20" :stroke-width="2" />
        <span class="user-name">{{ displayName }}</span>
      </div>

      <!-- Theme Toggle -->
      <button class="footer-btn theme-toggle" @click="themeStore.toggleTheme" :aria-label="`Switch to ${themeStore.theme === 'light' ? 'dark' : 'light'} mode`">
        <component :is="getIcon(themeStore.theme === 'light' ? 'moon' : 'sun')" :size="20" :stroke-width="2" />
        <span class="nav-text">{{ themeStore.theme === 'light' ? 'Dark' : 'Light' }} Mode</span>
      </button>

      <!-- Logout Button -->
      <button class="footer-btn logout-btn" @click="handleLogout" aria-label="Logout">
        <component :is="getIcon('logout')" :size="20" :stroke-width="2" />
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
