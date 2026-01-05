import { ref, onErrorCaptured, type ComponentPublicInstance } from 'vue'
import { useNotifications } from './useNotifications'

export interface ErrorInfo {
  error: Error
  timestamp: string
  componentName?: string
  retryable: boolean
}

export function useErrorBoundary() {
  const { error: showErrorNotification } = useNotifications()
  const hasError = ref(false)
  const errorInfo = ref<ErrorInfo | null>(null)

  onErrorCaptured((error: Error, instance: ComponentPublicInstance | null, info: string) => {
    console.error('[Error Boundary] Caught error:', error)
    console.error('[Error Boundary] Component:', instance?.$options?.name || 'Unknown')
    console.error('[Error Boundary] Info:', info)

    hasError.value = true
    errorInfo.value = {
      error,
      timestamp: new Date().toISOString(),
      componentName: instance?.$options?.name,
      retryable: true
    }

    // Show user-friendly notification
    showErrorNotification(
      'Component Error',
      error.message || 'Please try again.'
    )

    // Log to monitoring service in production
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service (e.g., Sentry)
      logErrorToService(errorInfo.value)
    }

    // Prevent error from propagating
    return false
  })

  function clearError() {
    hasError.value = false
    errorInfo.value = null
  }

  function retry() {
    clearError()
    // Component will re-render
  }

  return {
    hasError,
    errorInfo,
    clearError,
    retry
  }
}

// Stub for error logging service
function logErrorToService(error: ErrorInfo) {
  // In production, send to error tracking service
  console.log('[Error Service] Would send to monitoring:', error)
}
