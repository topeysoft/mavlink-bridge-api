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
  const expiresAt = ref<number | null>(null)
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
    const fifteenMinutes = 15 * 60 * 1000
    return timeUntilExpiry.value <= fifteenMinutes
  })

  // Actions

  /**
   * Initialize auth from client
   */
  function initializeFromClient(authClient: AuthClient) {
    const state = authClient.getAuthState()
    isAuthenticated.value = state.authenticated
    accessToken.value = state.accessToken
    expiresAt.value = state.expiresAt
    role.value = state.role
    permissions.value = state.permissions

    if (state.authenticated) {
      startSessionMonitoring()
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

      // Update state
      isAuthenticated.value = true
      accessToken.value = response.access_token
      expiresAt.value = Date.now() + response.expires_in * 1000
      role.value = response.role

      // Fetch current user info
      try {
        currentUser.value = await authClient.getCurrentUser()
        permissions.value = currentUser.value.permissions
      } catch (error) {
        console.error('Failed to fetch current user:', error)
      }

      // Start session monitoring
      startSessionMonitoring()
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
  function logout(authClient: AuthClient) {
    authClient.logout()
    isAuthenticated.value = false
    accessToken.value = null
    expiresAt.value = null
    role.value = null
    permissions.value = []
    currentUser.value = null
    sessionTimeoutWarning.value = false
    loginError.value = null

    stopSessionMonitoring()
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

    // Session expired
    if (remaining <= 0) {
      sessionTimeoutWarning.value = false
      // Auto-logout will happen when next API call fails
      return
    }

    // Show warning 15 minutes before expiry
    const warningThreshold = 15 * 60 * 1000 // 15 minutes
    if (remaining <= warningThreshold && !sessionTimeoutWarning.value) {
      sessionTimeoutWarning.value = true
    }

    // Clear warning if more than 15 minutes remain
    if (remaining > warningThreshold && sessionTimeoutWarning.value) {
      sessionTimeoutWarning.value = false
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
    expiresAt,
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
    dismissSessionWarning,
    clearLoginError,
  }
})
