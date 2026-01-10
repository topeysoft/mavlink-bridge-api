import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  AuthClient,
  LoginResponse,
  CurrentUser,
  SetupStatus,
  CompleteSetupRequest,
  Role,
  Permission
} from '../../../client/dist/index'

export const useAuthStore = defineStore('auth', () => {
  // State
  const isAuthenticated = ref(false)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const expiresAt = ref<number | null>(null)
  const refreshExpiresAt = ref<number | null>(null)
  const role = ref<Role | null>(null)
  const permissions = ref<Permission[]>([])
  const currentUser = ref<CurrentUser | null>(null)
  const setupStatus = ref<SetupStatus | null>(null)
  const isCheckingSetup = ref(false)
  const isLoggingIn = ref(false)
  const loginError = ref<string | null>(null)
  const sessionTimeoutWarning = ref(false)

  // Timer refs
  let sessionCheckInterval: number | null = null
  let sessionWarningTimeout: number | null = null
  let autoRefreshTimeout: number | null = null

  // Computed
  const needsSetup = computed(() => {
    return setupStatus.value?.in_setup_mode ?? false
  })

  const isAdmin = computed(() => {
    return role.value === 'admin'
  })

  const isOperator = computed(() => {
    return role.value === 'operator' || role.value === 'admin'
  })

  const timeUntilExpiry = computed(() => {
    if (!expiresAt.value) return null
    const remaining = expiresAt.value - Date.now()
    return remaining > 0 ? remaining : 0
  })

  const willExpireSoon = computed(() => {
    if (!timeUntilExpiry.value) return false
    // Warn when less than 2 minutes remaining (access token is 15 min)
    const twoMinutes = 2 * 60 * 1000
    return timeUntilExpiry.value <= twoMinutes
  })

  // Actions

  /**
   * Initialize auth from client
   */
  async function initializeFromClient(authClient: AuthClient) {
    const state = authClient.getAuthState()
    console.log('[Auth] initializeFromClient called:', {
      authenticated: state.authenticated,
      hasAccessToken: !!state.accessToken,
      hasRefreshToken: !!state.refreshToken,
      expiresAt: state.expiresAt ? new Date(state.expiresAt).toISOString() : null,
    })

    isAuthenticated.value = state.authenticated
    accessToken.value = state.accessToken
    refreshToken.value = state.refreshToken
    expiresAt.value = state.expiresAt
    refreshExpiresAt.value = state.refreshExpiresAt
    role.value = state.role
    permissions.value = state.permissions

    if (state.authenticated) {
      // Fetch current user info to restore full auth state
      try {
        currentUser.value = await authClient.getCurrentUser()
        permissions.value = currentUser.value.permissions
        console.log('[Auth] Current user fetched during initialization:', currentUser.value.subject_name)
      } catch (error) {
        console.error('[Auth] Failed to fetch current user during initialization:', error)
        // If user fetch fails (e.g., token expired), clear auth state
        if (error && typeof error === 'object' && 'status' in error) {
          const httpError = error as { status: number }
          if (httpError.status === 401) {
            console.log('[Auth] Token invalid/expired, clearing auth state')
            isAuthenticated.value = false
            accessToken.value = null
            refreshToken.value = null
            expiresAt.value = null
            refreshExpiresAt.value = null
            role.value = null
            permissions.value = []
            currentUser.value = null
            authClient.logout()
            return
          }
        }
      }

      startSessionMonitoring()
      startAutoRefresh(authClient)
    }
  }

  /**
   * Check setup status
   */
  async function checkSetupStatus(authClient: AuthClient): Promise<SetupStatus> {
    isCheckingSetup.value = true
    try {
      const status = await authClient.getSetupStatus()
      setupStatus.value = status
      return status
    } finally {
      isCheckingSetup.value = false
    }
  }

  /**
   * Complete setup
   */
  async function completeSetup(
    authClient: AuthClient,
    request: CompleteSetupRequest
  ): Promise<string> {
    const response = await authClient.completeSetup(request)
    setupStatus.value = {
      setup_completed: true,
      has_admin_key: true,
      device_name: response.device_name,
      in_setup_mode: false,
    }
    return response.api_key
  }

  /**
   * Login with API key
   */
  async function login(authClient: AuthClient, apiKey: string): Promise<void> {
    isLoggingIn.value = true
    loginError.value = null

    try {
      const response: LoginResponse = await authClient.login(apiKey)

      // Update state with both tokens
      isAuthenticated.value = true
      accessToken.value = response.access_token
      refreshToken.value = response.refresh_token
      expiresAt.value = Date.now() + response.expires_in * 1000
      refreshExpiresAt.value = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      role.value = response.role

      // Fetch current user info
      try {
        currentUser.value = await authClient.getCurrentUser()
        permissions.value = currentUser.value.permissions
      } catch (error) {
        console.error('Failed to fetch current user:', error)
      }

      // Start session monitoring and auto-refresh
      startSessionMonitoring()
      startAutoRefresh(authClient)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      loginError.value = errorMessage
      throw error
    } finally {
      isLoggingIn.value = false
    }
  }

  /**
   * Logout
   */
  async function logout(authClient: AuthClient) {
    await authClient.logout()
    isAuthenticated.value = false
    accessToken.value = null
    refreshToken.value = null
    expiresAt.value = null
    refreshExpiresAt.value = null
    role.value = null
    permissions.value = []
    currentUser.value = null
    sessionTimeoutWarning.value = false
    loginError.value = null
    setupStatus.value = null // Clear setup status to avoid stale state

    stopSessionMonitoring()
    stopAutoRefresh()
  }

  /**
   * Refresh current user info
   */
  async function refreshUser(authClient: AuthClient): Promise<void> {
    if (!isAuthenticated.value) return

    try {
      currentUser.value = await authClient.getCurrentUser()
      permissions.value = currentUser.value.permissions
      role.value = currentUser.value.role
    } catch (error) {
      console.error('Failed to refresh user:', error)
      // If refresh fails with 401, logout
      if (error && typeof error === 'object' && 'status' in error) {
        const httpError = error as { status: number }
        if (httpError.status === 401) {
          logout(authClient)
        }
      }
    }
  }

  /**
   * Check if user has a specific permission
   */
  function hasPermission(permission: Permission): boolean {
    return permissions.value.includes(permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  function hasAnyPermission(requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(p => permissions.value.includes(p))
  }

  /**
   * Check if user has all of the specified permissions
   */
  function hasAllPermissions(requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(p => permissions.value.includes(p))
  }

  /**
   * Start monitoring session expiry
   */
  function startSessionMonitoring() {
    stopSessionMonitoring()

    // Check every minute
    sessionCheckInterval = window.setInterval(() => {
      checkSessionExpiry()
    }, 60 * 1000)

    // Initial check
    checkSessionExpiry()
  }

  /**
   * Stop monitoring session expiry
   */
  function stopSessionMonitoring() {
    if (sessionCheckInterval !== null) {
      clearInterval(sessionCheckInterval)
      sessionCheckInterval = null
    }
    if (sessionWarningTimeout !== null) {
      clearTimeout(sessionWarningTimeout)
      sessionWarningTimeout = null
    }
  }

  /**
   * Check if session is about to expire
   */
  function checkSessionExpiry() {
    if (!expiresAt.value) return

    const now = Date.now()
    const remaining = expiresAt.value - now

    // Session expired (but might have refresh token)
    if (remaining <= 0) {
      sessionTimeoutWarning.value = false
      // Token refresh will happen automatically on next API call
      return
    }

    // Show warning 2 minutes before expiry (access token is 15 min)
    const warningThreshold = 2 * 60 * 1000 // 2 minutes
    if (remaining <= warningThreshold && !sessionTimeoutWarning.value) {
      sessionTimeoutWarning.value = true
    }

    // Clear warning if more than 2 minutes remain
    if (remaining > warningThreshold && sessionTimeoutWarning.value) {
      sessionTimeoutWarning.value = false
    }
  }

  /**
   * Start auto-refresh of access token
   */
  function startAutoRefresh(authClient: AuthClient) {
    // Always stop any existing timeout first
    stopAutoRefresh()

    if (!expiresAt.value || !refreshToken.value) {
      console.warn('[Auth] Cannot start auto-refresh: missing expiry or refresh token')
      return
    }

    // Schedule refresh 5 minutes before access token expires (better buffer)
    const refreshBeforeExpiry = 5 * 60 * 1000 // 5 minutes
    const timeUntilExpiry = expiresAt.value - Date.now()
    const refreshDelay = timeUntilExpiry - refreshBeforeExpiry

    console.log(
      `[Auth] Token expiry check: expiresAt=${new Date(expiresAt.value).toISOString()}, ` +
      `timeUntilExpiry=${Math.round(timeUntilExpiry / 1000)}s, ` +
      `refreshDelay=${Math.round(refreshDelay / 1000)}s`
    )

    // If token expires very soon (< 1 minute), refresh immediately
    if (timeUntilExpiry < 60 * 1000) {
      console.log('[Auth] Token expires in < 1 minute, refreshing immediately...')
      ;(async () => {
        try {
          await authClient.refreshAccessToken()

          // Update state with new access token
          const state = authClient.getAuthState()
          accessToken.value = state.accessToken
          expiresAt.value = state.expiresAt

          console.log(
            '[Auth] Access token refreshed immediately. ' +
            `New expiry: ${state.expiresAt ? new Date(state.expiresAt).toISOString() : 'null'}`
          )

          // Schedule next refresh with new expiry
          startAutoRefresh(authClient)
        } catch (error) {
          console.error('[Auth] Failed to refresh token immediately:', error)
        }
      })()
      return
    }

    // If delay is negative or very small, schedule for 30 seconds from now
    // This handles cases where token is already past the refresh point
    const actualDelay = Math.max(refreshDelay, 30 * 1000)

    if (refreshDelay < 0) {
      console.log(
        `[Auth] Token already past refresh point (${Math.round(-refreshDelay / 1000)}s ago), ` +
        'scheduling refresh in 30s'
      )
    } else {
      console.log(`[Auth] Scheduling token refresh in ${Math.round(actualDelay / 1000)}s`)
    }

    autoRefreshTimeout = window.setTimeout(async () => {
      try {
        console.log('[Auth] Auto-refresh timer triggered, refreshing access token...')
        await authClient.refreshAccessToken()

        // Update state with new access token
        const state = authClient.getAuthState()
        accessToken.value = state.accessToken
        expiresAt.value = state.expiresAt

        console.log(
          '[Auth] Access token refreshed successfully. ' +
          `New expiry: ${state.expiresAt ? new Date(state.expiresAt).toISOString() : 'null'}`
        )

        // Schedule next refresh
        startAutoRefresh(authClient)
      } catch (error) {
        console.error('[Auth] Failed to auto-refresh token:', error)
        // If refresh fails, user will be logged out on next API call
      }
    }, actualDelay)
  }

  /**
   * Stop auto-refresh
   */
  function stopAutoRefresh() {
    if (autoRefreshTimeout !== null) {
      clearTimeout(autoRefreshTimeout)
      autoRefreshTimeout = null
    }
  }

  /**
   * Manually refresh the access token
   */
  async function manualRefreshToken(authClient: AuthClient): Promise<void> {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    try {
      console.log('[Auth] Manual token refresh requested')
      await authClient.refreshAccessToken()

      // Update state with new access token
      const state = authClient.getAuthState()
      accessToken.value = state.accessToken
      expiresAt.value = state.expiresAt

      console.log(
        '[Auth] Manual refresh successful. ' +
        `New expiry: ${state.expiresAt ? new Date(state.expiresAt).toISOString() : 'null'}`
      )

      // Clear any warning and restart auto-refresh cycle
      sessionTimeoutWarning.value = false
      startAutoRefresh(authClient)
    } catch (error) {
      console.error('[Auth] Manual token refresh failed:', error)
      throw error
    }
  }

  /**
   * Dismiss session timeout warning
   */
  function dismissSessionWarning() {
    sessionTimeoutWarning.value = false
  }

  /**
   * Clear login error
   */
  function clearLoginError() {
    loginError.value = null
  }

  return {
    // State
    isAuthenticated,
    accessToken,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
    role,
    permissions,
    currentUser,
    setupStatus,
    isCheckingSetup,
    isLoggingIn,
    loginError,
    sessionTimeoutWarning,

    // Computed
    needsSetup,
    isAdmin,
    isOperator,
    timeUntilExpiry,
    willExpireSoon,

    // Actions
    initializeFromClient,
    checkSetupStatus,
    completeSetup,
    login,
    logout,
    refreshUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    manualRefreshToken,
    dismissSessionWarning,
    clearLoginError,
  }
})
