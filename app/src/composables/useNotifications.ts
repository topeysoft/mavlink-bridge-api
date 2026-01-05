/**
 * Composable for toast notifications
 * Provides a simple API for showing notifications throughout the app
 */

import { inject, type Ref } from 'vue'
import type ToastContainer from '@/components/common/ToastContainer.vue'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface NotificationOptions {
  type?: NotificationType
  message: string
  caption?: string
  timeout?: number
}

export function useNotifications() {
  const toastContainer = inject<Ref<InstanceType<typeof ToastContainer> | null>>('toast')

  /**
   * Show a notification
   */
  const showNotification = (options: NotificationOptions | string) => {
    const opts: NotificationOptions = typeof options === 'string'
      ? { message: options, type: 'info' }
      : options

    const message = opts.caption
      ? `${opts.message} - ${opts.caption}`
      : opts.message

    const duration = opts.timeout ?? (opts.type === 'error' ? 5000 : 3000)

    // Use toast container if available, otherwise fallback to console
    if (toastContainer?.value) {
      toastContainer.value.addToast({
        message,
        type: opts.type || 'info',
        duration,
        dismissible: true
      })
    } else {
      console.log(`[${opts.type?.toUpperCase()}] ${message}`)
    }
  }

  /**
   * Show success notification
   */
  const success = (message: string, caption?: string) => {
    showNotification({
      type: 'success',
      message,
      caption
    })
  }

  /**
   * Show error notification
   */
  const error = (message: string, caption?: string) => {
    showNotification({
      type: 'error',
      message,
      caption,
      timeout: 5000 // Errors stay longer
    })
  }

  /**
   * Show warning notification
   */
  const warning = (message: string, caption?: string) => {
    showNotification({
      type: 'warning',
      message,
      caption,
      timeout: 4000
    })
  }

  /**
   * Show info notification
   */
  const info = (message: string, caption?: string) => {
    showNotification({
      type: 'info',
      message,
      caption
    })
  }

  return {
    showNotification,
    success,
    error,
    warning,
    info
  }
}
