import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import { useDialog } from './useDialog'
import { useRouter } from 'vue-router'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000 // Check every 30 seconds

export function useSessionTimeout() {
  const authStore = useAuthStore()
  const connectionStore = useConnectionStore()
  const dialog = useDialog()
  const router = useRouter()

  const warningShown = ref(false)
  const checkInterval = ref<ReturnType<typeof setInterval> | null>(null)

  function getTimeUntilExpiry(): number | null {
    const authClient = (connectionStore.client as any)?.authClient
    if (!authClient) return null

    return authClient.getTimeUntilExpiry()
  }

  async function checkSessionStatus() {
    if (!authStore.isAuthenticated) return

    const timeRemaining = getTimeUntilExpiry()
    if (timeRemaining === null) return

    // Show warning at 5 minutes
    if (timeRemaining <= FIVE_MINUTES_MS && timeRemaining > ONE_MINUTE_MS && !warningShown.value) {
      warningShown.value = true
      const minutes = Math.ceil(timeRemaining / ONE_MINUTE_MS)

      await dialog.alert(
        `Your session will expire in ${minutes} minute${minutes > 1 ? 's' : ''}. You'll need to log in again.`,
        'Session Expiring Soon',
        { variant: 'warning', icon: '⏰' }
      )
    }

    // Session expired
    if (timeRemaining <= 0) {
      await dialog.alert(
        'Your session has expired. Please log in again to continue.',
        'Session Expired',
        { variant: 'warning', icon: '🔒' }
      )

      authStore.logout()
      router.push('/login')
    }
  }

  function startMonitoring() {
    // Check immediately
    checkSessionStatus()

    // Then check every 30 seconds
    checkInterval.value = setInterval(checkSessionStatus, CHECK_INTERVAL_MS)
  }

  function stopMonitoring() {
    if (checkInterval.value) {
      clearInterval(checkInterval.value)
      checkInterval.value = null
    }
    warningShown.value = false
  }

  onMounted(() => {
    if (authStore.isAuthenticated) {
      startMonitoring()
    }
  })

  onUnmounted(() => {
    stopMonitoring()
  })

  return {
    startMonitoring,
    stopMonitoring,
    checkSessionStatus,
  }
}
