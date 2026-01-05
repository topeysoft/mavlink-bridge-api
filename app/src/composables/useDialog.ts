/**
 * Composable for programmatic dialog management
 * Provides promise-based API for confirm and alert dialogs
 */

import { inject, type Ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  icon?: string
}

export interface AlertOptions {
  title?: string
  message: string
  buttonText?: string
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  icon?: string
}

interface DialogManager {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>
  showAlert: (options: AlertOptions) => Promise<void>
}

export function useDialog() {
  const dialogManager = inject<Ref<DialogManager | null>>('dialogManager')

  /**
   * Show a confirmation dialog
   * Returns a promise that resolves to true if confirmed, false if cancelled
   */
  const confirm = async (
    message: string,
    title?: string,
    options?: Partial<ConfirmOptions>
  ): Promise<boolean> => {
    if (!dialogManager?.value) {
      // Fallback to native confirm if dialog manager not available
      console.warn('Dialog manager not available, falling back to native confirm')
      return window.confirm(message)
    }

    return dialogManager.value.showConfirm({
      message,
      title: title || options?.title || 'Confirm',
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      variant: options?.variant,
      icon: options?.icon
    })
  }

  /**
   * Show an alert dialog
   * Returns a promise that resolves when the dialog is closed
   */
  const alert = async (
    message: string,
    title?: string,
    options?: Partial<AlertOptions>
  ): Promise<void> => {
    if (!dialogManager?.value) {
      // Fallback to native alert if dialog manager not available
      console.warn('Dialog manager not available, falling back to native alert')
      window.alert(message)
      return
    }

    return dialogManager.value.showAlert({
      message,
      title: title || options?.title || 'Alert',
      buttonText: options?.buttonText,
      variant: options?.variant,
      icon: options?.icon
    })
  }

  return {
    confirm,
    alert
  }
}
