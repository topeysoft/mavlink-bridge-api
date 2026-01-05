import { ref, onMounted, onUnmounted } from 'vue'

export interface OfflineState {
  isOnline: boolean
  wasOffline: boolean
  offlineSince?: string
}

export function useOfflineDetection() {
  const isOnline = ref(navigator.onLine)
  const wasOffline = ref(false)
  const offlineSince = ref<string | undefined>(undefined)

  function handleOnline() {
    const wasActuallyOffline = !isOnline.value
    isOnline.value = true

    if (wasActuallyOffline && wasOffline.value) {
      // Connection restored
      wasOffline.value = false
      offlineSince.value = undefined
    }
  }

  function handleOffline() {
    isOnline.value = false
    wasOffline.value = true
    offlineSince.value = new Date().toISOString()
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return {
    isOnline,
    wasOffline,
    offlineSince
  }
}
