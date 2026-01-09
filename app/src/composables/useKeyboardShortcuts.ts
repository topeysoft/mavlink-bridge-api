/**
 * Global keyboard shortcuts composable
 */

import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts() {
  const router = useRouter()
  const shortcuts: KeyboardShortcut[] = []

  /**
   * Register a keyboard shortcut
   */
  const registerShortcut = (shortcut: KeyboardShortcut) => {
    shortcuts.push(shortcut)
  }

  /**
   * Check if an input element is focused
   */
  const isInputFocused = (): boolean => {
    const activeElement = document.activeElement
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      (activeElement as HTMLElement)?.isContentEditable
    )
  }

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (isInputFocused() && event.key !== 'Escape' && event.key !== '?') {
      return
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey

      if (
        event.key === shortcut.key &&
        ctrlMatch &&
        altMatch &&
        shiftMatch
      ) {
        event.preventDefault()
        shortcut.action()
        break
      }
    }
  }

  /**
   * Setup global shortcuts
   */
  const setupGlobalShortcuts = (callbacks: {
    showShortcuts?: () => void
    toggleTheme?: () => void
    emergencyStop?: () => void
  }) => {
    // ? - Show keyboard shortcuts
    if (callbacks.showShortcuts) {
      registerShortcut({
        key: '?',
        description: 'Show keyboard shortcuts',
        action: callbacks.showShortcuts
      })
    }

    // Ctrl/Cmd + D - Toggle dark mode
    if (callbacks.toggleTheme) {
      registerShortcut({
        key: 'd',
        ctrl: true,
        description: 'Toggle dark mode',
        action: callbacks.toggleTheme
      })
    }

    // Ctrl/Cmd + E - Emergency stop
    if (callbacks.emergencyStop) {
      registerShortcut({
        key: 'e',
        ctrl: true,
        description: 'Emergency stop',
        action: callbacks.emergencyStop
      })
    }

    // Number keys 1-6 for navigation
    const routes = [
      { key: '1', name: 'dashboard', description: 'Go to Dashboard' },
      { key: '2', name: 'peripherals', description: 'Go to Peripherals' },
      { key: '3', name: 'zones', description: 'Go to Zones' },
      { key: '4', name: 'missions', description: 'Go to Missions' },
      { key: '5', name: 'monitoring', description: 'Go to Monitoring' },
      { key: '6', name: 'schedule', description: 'Go to Schedule' }
    ]

    routes.forEach(route => {
      registerShortcut({
        key: route.key,
        description: route.description,
        action: () => router.push({ name: route.name })
      })
    })
  }

  /**
   * Get all registered shortcuts
   */
  const getAllShortcuts = () => {
    return shortcuts.map(s => ({
      keys: [
        s.ctrl && 'Ctrl',
        s.meta && 'Cmd',
        s.alt && 'Alt',
        s.shift && 'Shift',
        s.key.toUpperCase()
      ].filter(Boolean).join(' + '),
      description: s.description
    }))
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    registerShortcut,
    setupGlobalShortcuts,
    getAllShortcuts
  }
}
