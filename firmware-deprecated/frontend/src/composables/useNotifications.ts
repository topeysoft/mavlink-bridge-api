import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'
import type { Notification, NotificationAction } from '@/stores/types'

export interface NotificationPreferences {
  sound: {
    enabled: boolean
    volume: number // 0-1
    sounds: {
      info: string
      success: string
      warning: string
      error: string
    }
  }
  visual: {
    position: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center'
    duration: {
      info: number
      success: number
      warning: number
      error: number
    }
    maxVisible: number
    animations: boolean
    showIcons: boolean
    showActions: boolean
  }
  behavior: {
    autoMarkReadOnView: boolean
    autoCloseOnAction: boolean
    pauseOnHover: boolean
    groupSimilar: boolean
    showBadge: boolean
    persistOnPageReload: boolean
  }
  filters: {
    types: Array<Notification['type']>
    minSeverity: 'low' | 'medium' | 'high' | 'critical'
    keywords: string[]
    machines: string[]
  }
}

export interface ToastNotification extends Notification {
  visible?: boolean
  autoClose?: boolean
  timeoutId?: number
  remainingTime?: number
}

export function useNotifications() {
  const store = useNotificationsStore()
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    recentNotifications,
    notificationsByType,
    errorNotifications,
    warningNotifications,
    infoNotifications,
    successNotifications,
    persistentNotifications
  } = storeToRefs(store)
  
  // Local state
  const toastNotifications = ref<ToastNotification[]>([])
  const soundEnabled = ref(true)
  const volume = ref(0.5)
  const audioContext = ref<AudioContext | null>(null)
  const notificationSounds = ref<Map<string, AudioBuffer>>(new Map())
  
  // Preferences
  const preferences = ref<NotificationPreferences>({
    sound: {
      enabled: true,
      volume: 0.5,
      sounds: {
        info: '/sounds/notification-info.mp3',
        success: '/sounds/notification-success.mp3',
        warning: '/sounds/notification-warning.mp3',
        error: '/sounds/notification-error.mp3'
      }
    },
    visual: {
      position: 'top-right',
      duration: {
        info: 4000,
        success: 3000,
        warning: 6000,
        error: 0 // Don't auto-close errors
      },
      maxVisible: 5,
      animations: true,
      showIcons: true,
      showActions: true
    },
    behavior: {
      autoMarkReadOnView: true,
      autoCloseOnAction: true,
      pauseOnHover: true,
      groupSimilar: true,
      showBadge: true,
      persistOnPageReload: true
    },
    filters: {
      types: ['info', 'success', 'warning', 'error'],
      minSeverity: 'low',
      keywords: [],
      machines: []
    }
  })
  
  // Computed properties
  const filteredNotifications = computed(() => {
    let filtered = notifications.value
    
    // Filter by types
    if (preferences.value.filters.types.length > 0) {
      filtered = filtered.filter(n => preferences.value.filters.types.includes(n.type))
    }
    
    // Filter by keywords
    if (preferences.value.filters.keywords.length > 0) {
      filtered = filtered.filter(n => {
        const text = `${n.title} ${n.message}`.toLowerCase()
        return preferences.value.filters.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
      })
    }
    
    return filtered
  })
  
  const visibleToasts = computed(() => {
    return toastNotifications.value
      .filter(n => n.visible)
      .slice(0, preferences.value.visual.maxVisible)
  })
  
  const hasUnreadCritical = computed(() => {
    return unreadNotifications.value.some(n => 
      n.type === 'error' || (n.type === 'warning' && n.persistent)
    )
  })
  
  const notificationStats = computed(() => {
    const now = new Date()
    const today = new Date(now.setHours(0, 0, 0, 0))
    const thisWeek = new Date(now.setDate(now.getDate() - 7))
    
    const todayNotifications = notifications.value.filter(n => 
      new Date(n.timestamp) >= today
    )
    
    const weekNotifications = notifications.value.filter(n => 
      new Date(n.timestamp) >= thisWeek
    )
    
    return {
      total: notifications.value.length,
      unread: unreadCount.value,
      today: todayNotifications.length,
      thisWeek: weekNotifications.length,
      byType: {
        error: errorNotifications.value.length,
        warning: warningNotifications.value.length,
        info: infoNotifications.value.length,
        success: successNotifications.value.length
      }
    }
  })
  
  // Notification creation methods with toast integration
  async function notify(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    const newNotification = store.addNotification(notification)
    
    // Show as toast if enabled
    if (shouldShowAsToast(newNotification)) {
      await showToast(newNotification)
    }
    
    // Play sound if enabled
    if (preferences.value.sound.enabled) {
      await playNotificationSound(newNotification.type)
    }
    
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      showBrowserNotification(newNotification)
    }
    
    return newNotification
  }
  
  async function success(title: string, message: string, options: Partial<Notification> = {}): Promise<Notification> {
    return notify({
      type: 'success',
      title,
      message,
      persistent: false,
      ...options
    })
  }
  
  async function info(title: string, message: string, options: Partial<Notification> = {}): Promise<Notification> {
    return notify({
      type: 'info',
      title,
      message,
      persistent: false,
      ...options
    })
  }
  
  async function warning(title: string, message: string, options: Partial<Notification> = {}): Promise<Notification> {
    return notify({
      type: 'warning',
      title,
      message,
      persistent: options.persistent ?? false,
      ...options
    })
  }
  
  async function error(title: string, message: string, options: Partial<Notification> = {}): Promise<Notification> {
    return notify({
      type: 'error',
      title,
      message,
      persistent: options.persistent ?? true,
      ...options
    })
  }
  
  // Toast notification methods
  async function showToast(notification: Notification): Promise<void> {
    const toastNotification: ToastNotification = {
      ...notification,
      visible: true,
      autoClose: preferences.value.visual.duration[notification.type] > 0,
      remainingTime: preferences.value.visual.duration[notification.type]
    }
    
    toastNotifications.value.unshift(toastNotification)
    
    // Auto-close if duration is set
    if (toastNotification.autoClose && toastNotification.remainingTime) {
      toastNotification.timeoutId = window.setTimeout(() => {
        hideToast(toastNotification.id)
      }, toastNotification.remainingTime)
    }
    
    // Auto-mark as read if preference is enabled
    if (preferences.value.behavior.autoMarkReadOnView) {
      setTimeout(() => {
        store.markAsRead(notification.id)
      }, 1000) // Mark as read after 1 second of visibility
    }
  }
  
  function hideToast(notificationId: string): void {
    const toast = toastNotifications.value.find(t => t.id === notificationId)
    if (toast) {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId)
      }
      
      toast.visible = false
      
      // Remove from array after animation
      setTimeout(() => {
        const index = toastNotifications.value.findIndex(t => t.id === notificationId)
        if (index > -1) {
          toastNotifications.value.splice(index, 1)
        }
      }, 300) // Match animation duration
    }
  }
  
  function pauseToast(notificationId: string): void {
    const toast = toastNotifications.value.find(t => t.id === notificationId)
    if (toast && toast.timeoutId) {
      clearTimeout(toast.timeoutId)
      toast.timeoutId = undefined
    }
  }
  
  function resumeToast(notificationId: string): void {
    const toast = toastNotifications.value.find(t => t.id === notificationId)
    if (toast && toast.autoClose && toast.remainingTime) {
      toast.timeoutId = window.setTimeout(() => {
        hideToast(toast.id)
      }, toast.remainingTime)
    }
  }
  
  function clearAllToasts(): void {
    toastNotifications.value.forEach(toast => {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId)
      }
    })
    toastNotifications.value = []
  }
  
  // Sound methods
  async function initAudioContext(): Promise<void> {
    if (!audioContext.value && 'AudioContext' in window) {
      audioContext.value = new AudioContext()
      
      // Load notification sounds
      const soundPromises = Object.entries(preferences.value.sound.sounds).map(
        async ([type, url]) => {
          try {
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContext.value!.decodeAudioData(arrayBuffer)
            notificationSounds.value.set(type, audioBuffer)
          } catch (error) {
            console.warn(`Failed to load notification sound for ${type}:`, error)
          }
        }
      )
      
      await Promise.all(soundPromises)
    }
  }
  
  async function playNotificationSound(type: Notification['type']): Promise<void> {
    if (!preferences.value.sound.enabled || !audioContext.value) return
    
    const audioBuffer = notificationSounds.value.get(type)
    if (!audioBuffer) return
    
    try {
      const source = audioContext.value.createBufferSource()
      const gainNode = audioContext.value.createGain()
      
      source.buffer = audioBuffer
      gainNode.gain.value = preferences.value.sound.volume
      
      source.connect(gainNode)
      gainNode.connect(audioContext.value.destination)
      
      source.start()
    } catch (error) {
      console.warn('Failed to play notification sound:', error)
    }
  }
  
  // Browser notification methods
  async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied'
    }
    
    if (Notification.permission === 'default') {
      return await Notification.requestPermission()
    }
    
    return Notification.permission
  }
  
  function showBrowserNotification(notification: Notification): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    
    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: getNotificationIcon(notification.type),
      tag: notification.id,
      requireInteraction: notification.persistent,
      data: notification
    })
    
    browserNotification.onclick = () => {
      window.focus()
      store.markAsRead(notification.id)
      browserNotification.close()
    }
    
    // Auto-close after duration
    if (!notification.persistent) {
      const duration = preferences.value.visual.duration[notification.type]
      if (duration > 0) {
        setTimeout(() => {
          browserNotification.close()
        }, duration)
      }
    }
  }
  
  // Action handling
  async function handleAction(notificationId: string, actionId: string): Promise<void> {
    const notification = notifications.value.find(n => n.id === notificationId)
    if (!notification) return
    
    // Execute store action
    store.executeAction(notificationId, actionId)
    
    // Hide toast if auto-close on action is enabled
    if (preferences.value.behavior.autoCloseOnAction) {
      hideToast(notificationId)
    }
    
    // Emit custom event for external handling
    const event = new CustomEvent('notification-action', {
      detail: { notification, actionId }
    })
    window.dispatchEvent(event)
  }
  
  // Utility methods
  function shouldShowAsToast(notification: Notification): boolean {
    return preferences.value.filters.types.includes(notification.type) &&
           !notification.persistent // Don't show persistent notifications as toasts
  }
  
  function getNotificationIcon(type: Notification['type']): string {
    const icons = {
      info: '/icons/notification-info.png',
      success: '/icons/notification-success.png',
      warning: '/icons/notification-warning.png',
      error: '/icons/notification-error.png'
    }
    return icons[type] || icons.info
  }
  
  function getNotificationEmoji(type: Notification['type']): string {
    const emojis = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }
    return emojis[type] || emojis.info
  }
  
  function formatRelativeTime(timestamp: string): string {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }
  
  function exportNotifications(format: 'json' | 'csv' = 'json'): void {
    const data = notifications.value.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read,
      persistent: n.persistent
    }))
    
    let content: string
    let filename: string
    let mimeType: string
    
    if (format === 'json') {
      content = JSON.stringify(data, null, 2)
      filename = `notifications-${Date.now()}.json`
      mimeType = 'application/json'
    } else {
      const headers = ['ID', 'Type', 'Title', 'Message', 'Timestamp', 'Read', 'Persistent']
      const rows = data.map(n => [
        n.id, n.type, n.title, n.message, n.timestamp, n.read, n.persistent
      ])
      
      content = [headers, ...rows].map(row => row.join(',')).join('\n')
      filename = `notifications-${Date.now()}.csv`
      mimeType = 'text/csv'
    }
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Preferences management
  function updatePreferences(updates: Partial<NotificationPreferences>): void {
    preferences.value = { ...preferences.value, ...updates }
    
    // Save to localStorage
    try {
      localStorage.setItem('yardrover_notification_preferences', JSON.stringify(preferences.value))
    } catch (error) {
      console.warn('Failed to save notification preferences:', error)
    }
  }
  
  function resetPreferences(): void {
    preferences.value = {
      sound: {
        enabled: true,
        volume: 0.5,
        sounds: {
          info: '/sounds/notification-info.mp3',
          success: '/sounds/notification-success.mp3',
          warning: '/sounds/notification-warning.mp3',
          error: '/sounds/notification-error.mp3'
        }
      },
      visual: {
        position: 'top-right',
        duration: {
          info: 4000,
          success: 3000,
          warning: 6000,
          error: 0
        },
        maxVisible: 5,
        animations: true,
        showIcons: true,
        showActions: true
      },
      behavior: {
        autoMarkReadOnView: true,
        autoCloseOnAction: true,
        pauseOnHover: true,
        groupSimilar: true,
        showBadge: true,
        persistOnPageReload: true
      },
      filters: {
        types: ['info', 'success', 'warning', 'error'],
        minSeverity: 'low',
        keywords: [],
        machines: []
      }
    }
    
    updatePreferences(preferences.value)
  }
  
  // Load preferences from localStorage
  function loadPreferences(): void {
    try {
      const saved = localStorage.getItem('yardrover_notification_preferences')
      if (saved) {
        const parsed = JSON.parse(saved)
        preferences.value = { ...preferences.value, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load notification preferences:', error)
    }
  }
  
  // Watch for preference changes
  watch(() => preferences.value.sound.enabled, (enabled) => {
    if (enabled && !audioContext.value) {
      initAudioContext()
    }
  })
  
  // Lifecycle
  onMounted(() => {
    loadPreferences()
    
    if (preferences.value.sound.enabled) {
      initAudioContext()
    }
    
    // Request notification permission
    if (preferences.value.behavior.showBadge) {
      requestNotificationPermission()
    }
  })
  
  onUnmounted(() => {
    // Clean up timers
    clearAllToasts()
    
    // Close audio context
    if (audioContext.value) {
      audioContext.value.close()
    }
  })
  
  return {
    // State
    notifications,
    unreadNotifications,
    unreadCount,
    recentNotifications,
    notificationsByType,
    filteredNotifications,
    toastNotifications: computed(() => toastNotifications.value),
    visibleToasts,
    preferences: computed(() => preferences.value),
    
    // Computed
    hasUnreadCritical,
    notificationStats,
    
    // Notification methods
    notify,
    success,
    info,
    warning,
    error,
    
    // Store methods
    markAsRead: store.markAsRead,
    markAsUnread: store.markAsUnread,
    markAllAsRead: store.markAllAsRead,
    remove: store.removeNotification,
    clearAll: store.clearAll,
    clearRead: store.clearRead,
    clearType: store.clearType,
    clearOlderThan: store.clearOlderThan,
    
    // Toast methods
    showToast,
    hideToast,
    pauseToast,
    resumeToast,
    clearAllToasts,
    
    // Action handling
    handleAction,
    
    // Sound methods
    playNotificationSound,
    
    // Browser notifications
    requestNotificationPermission,
    
    // Utility methods
    getNotificationEmoji,
    getNotificationIcon,
    formatRelativeTime,
    exportNotifications,
    
    // Preferences
    updatePreferences,
    resetPreferences,
    
    // Store convenience methods
    machineError: store.machineError,
    taskCompleted: store.taskCompleted,
    taskFailed: store.taskFailed,
    batteryLow: store.batteryLow,
    maintenanceReminder: store.maintenanceReminder,
    weatherAlert: store.weatherAlert,
    securityAlert: store.securityAlert
  }
}