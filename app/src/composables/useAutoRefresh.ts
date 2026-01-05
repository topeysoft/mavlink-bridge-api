import { ref, computed, onMounted, onUnmounted } from 'vue'
import { formatDistanceToNow } from 'date-fns'

export interface AutoRefreshOptions {
  interval?: number // Refresh interval in milliseconds
  enabled?: boolean // Whether auto-refresh is enabled
  onRefresh?: () => void | Promise<void> // Callback to execute on refresh
}

export function useAutoRefresh(options: AutoRefreshOptions = {}) {
  const {
    interval = 5000, // Default 5 seconds
    enabled = true,
    onRefresh
  } = options

  const lastUpdated = ref<Date>(new Date())
  const isRefreshing = ref(false)
  const autoRefreshEnabled = ref(enabled)

  let intervalId: number | null = null
  let timestampIntervalId: number | null = null

  // Format the last updated time as "Updated Xs ago"
  const formattedLastUpdated = computed(() => {
    return `Updated ${formatDistanceToNow(lastUpdated.value, { addSuffix: true })}`
  })

  // Perform refresh
  const refresh = async () => {
    if (isRefreshing.value) return

    isRefreshing.value = true
    try {
      if (onRefresh) {
        await onRefresh()
      }
      lastUpdated.value = new Date()
    } finally {
      isRefreshing.value = false
    }
  }

  // Start auto-refresh
  const startAutoRefresh = () => {
    if (intervalId !== null) return // Already running

    intervalId = window.setInterval(async () => {
      if (autoRefreshEnabled.value) {
        await refresh()
      }
    }, interval)
  }

  // Stop auto-refresh
  const stopAutoRefresh = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    autoRefreshEnabled.value = !autoRefreshEnabled.value
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }

  // Start timestamp updates (every second for relative time)
  const startTimestampUpdates = () => {
    timestampIntervalId = window.setInterval(() => {
      // Force computed to re-evaluate by triggering reactivity
      lastUpdated.value = new Date(lastUpdated.value)
    }, 1000)
  }

  // Lifecycle hooks
  onMounted(() => {
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    }
    startTimestampUpdates()
  })

  onUnmounted(() => {
    stopAutoRefresh()
    if (timestampIntervalId !== null) {
      clearInterval(timestampIntervalId)
    }
  })

  return {
    lastUpdated,
    formattedLastUpdated,
    isRefreshing,
    autoRefreshEnabled,
    refresh,
    toggleAutoRefresh,
    startAutoRefresh,
    stopAutoRefresh
  }
}
