/**
 * Router navigation guards for authentication
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useConnectionStore } from '../stores/connection'

/**
 * Check if route requires authentication
 */
export function requiresAuth(route: RouteLocationNormalized): boolean {
  // Public routes (no auth required)
  const publicRoutes = ['login', 'setup', 'connect']
  return !publicRoutes.includes(route.name as string)
}

/**
 * Authentication guard - redirects to login if not authenticated
 */
export async function authGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const authStore = useAuthStore()
  const connectionStore = useConnectionStore()

  // Public routes that don't need auth (but might need connection for login/setup)
  const publicRoutes = ['login', 'setup', 'connect']
  const isPublicRoute = publicRoutes.includes(to.name as string)

  // FIRST PRIORITY: Check connection status
  // If not connected and trying to access a protected route, redirect to connect
  if (!connectionStore.isConnected && !isPublicRoute) {
    next({ name: 'connect', query: { redirect: to.fullPath } })
    return
  }

  // Always allow access to public routes (after connection check)
  if (!requiresAuth(to)) {
    next()
    return
  }

  // From here on, we know we have a connection (for protected routes)
  // Check if we have a client instance
  if (!connectionStore.client) {
    // This shouldn't happen if isConnected is true, but safety check
    next({ name: 'connect', query: { redirect: to.fullPath } })
    return
  }

  // Check if we need to do initial setup
  if (authStore.setupStatus === null) {
    try {
      const authClient = (connectionStore.client as any).authClient
      if (authClient) {
        await authStore.checkSetupStatus(authClient)
      }
    } catch (error) {
      console.error('Failed to check setup status:', error)
    }
  }

  // Redirect to setup if needed
  if (authStore.needsSetup) {
    if (to.name !== 'setup') {
      next({ name: 'setup' })
    } else {
      next()
    }
    return
  }

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Not authenticated, redirect to login
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  // Check if token is expired
  if (authStore.timeUntilExpiry !== null && authStore.timeUntilExpiry <= 0) {
    // Token expired, logout and redirect to login
    const authClient = (connectionStore.client as any).authClient
    if (authClient) {
      authStore.logout(authClient)
    }
    next({ name: 'login', query: { redirect: to.fullPath, expired: '1' } })
    return
  }

  // All checks passed, allow navigation
  next()
}

/**
 * Connection guard - redirects authenticated users away from connection page
 */
export function connectionGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore()
  const connectionStore = useConnectionStore()

  // If already authenticated and connected, redirect to dashboard
  if (authStore.isAuthenticated && connectionStore.isConnected) {
    next({ name: 'dashboard' })
    return
  }

  // Not authenticated or not connected, allow access to connection page
  next()
}

/**
 * Setup guard - redirects to dashboard if setup is already complete or if authenticated
 */
export async function setupGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const authStore = useAuthStore()
  const connectionStore = useConnectionStore()

  // If already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }

  // Check if we have a connection
  if (!connectionStore.client) {
    next({ name: 'connect' })
    return
  }

  // Check setup status if not already checked
  if (authStore.setupStatus === null) {
    try {
      const authClient = (connectionStore.client as any).authClient
      if (authClient) {
        await authStore.checkSetupStatus(authClient)
      }
    } catch (error) {
      console.error('Failed to check setup status:', error)
      next()
      return
    }
  }

  // If setup is complete, redirect to login
  if (!authStore.needsSetup) {
    next({ name: 'login' })
    return
  }

  // Setup needed, allow access to setup page
  next()
}

/**
 * Login guard - redirects to dashboard if already authenticated
 */
export function loginGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore()
  const connectionStore = useConnectionStore()

  // If already authenticated, redirect to dashboard or redirect target
  if (authStore.isAuthenticated) {
    const redirect = to.query.redirect as string | undefined
    if (redirect) {
      next(redirect)
    } else {
      next({ name: 'dashboard' })
    }
    return
  }

  // Check if we have a connection
  if (!connectionStore.client) {
    next({ name: 'connect' })
    return
  }

  // Not authenticated, allow access to login
  next()
}

/**
 * Admin guard - requires admin role
 */
export function adminGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore()

  if (!authStore.isAdmin) {
    // Not admin, redirect to dashboard with error
    next({
      name: 'dashboard',
      query: { error: 'admin_required' },
    })
    return
  }

  next()
}

/**
 * Operator guard - requires operator or admin role
 */
export function operatorGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore()

  if (!authStore.isOperator) {
    // Not operator, redirect to dashboard with error
    next({
      name: 'dashboard',
      query: { error: 'operator_required' },
    })
    return
  }

  next()
}
