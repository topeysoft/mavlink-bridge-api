import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppConfigState {
  deviceUrl: string
  theme: 'auto' | 'light' | 'dark'
  language: string
  notifications: {
    enabled: boolean
    sound: boolean
    vibration: boolean
  }
  connection: {
    autoConnect: boolean
    reconnectAttempts: number
    reconnectDelay: number
  }
}

export const useAppConfigStore = defineStore('app-config', () => {
  // State
  const deviceUrl = ref(import.meta.env.VITE_DEFAULT_DEVICE_URL || 'http://192.168.4.1')
  const theme = ref<'auto' | 'light' | 'dark'>('auto')
  const language = ref('en-US')
  const notifications = ref({
    enabled: true,
    sound: true,
    vibration: true
  })
  const connection = ref({
    autoConnect: true,
    reconnectAttempts: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_ATTEMPTS) || 5,
    reconnectDelay: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_DELAY) || 1000
  })

  // Getters (computed)
  const isDeviceDiscoveryEnabled = computed((): boolean => {
    return import.meta.env.VITE_DEVICE_DISCOVERY_ENABLED === 'true'
  })

  const isDarkMode = computed((): boolean => {
    if (theme.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  // Actions
  function setDeviceUrl(url: string) {
    deviceUrl.value = url
  }

  function setTheme(newTheme: 'auto' | 'light' | 'dark') {
    theme.value = newTheme
  }

  function toggleTheme() {
    switch (theme.value) {
      case 'light':
        theme.value = 'dark'
        break
      case 'dark':
        theme.value = 'auto'
        break
      case 'auto':
        theme.value = 'light'
        break
    }
  }

  function setLanguage(newLanguage: string) {
    language.value = newLanguage
  }

  function updateNotificationSettings(settings: Partial<AppConfigState['notifications']>) {
    notifications.value = { ...notifications.value, ...settings }
  }

  function updateConnectionSettings(settings: Partial<AppConfigState['connection']>) {
    connection.value = { ...connection.value, ...settings }
  }

  function resetToDefaults() {
    deviceUrl.value = import.meta.env.VITE_DEFAULT_DEVICE_URL || 'http://192.168.4.1'
    theme.value = 'auto'
    language.value = 'en-US'
    notifications.value = {
      enabled: true,
      sound: true,
      vibration: true
    }
    connection.value = {
      autoConnect: true,
      reconnectAttempts: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_ATTEMPTS) || 5,
      reconnectDelay: parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECT_DELAY) || 1000
    }
  }

  return {
    // State
    deviceUrl,
    theme,
    language,
    notifications,
    connection,
    
    // Getters
    isDeviceDiscoveryEnabled,
    isDarkMode,
    
    // Actions
    setDeviceUrl,
    setTheme,
    toggleTheme,
    setLanguage,
    updateNotificationSettings,
    updateConnectionSettings,
    resetToDefaults
  }
}, {
  persist: true
})