import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useWebSocketStore } from '@/stores/websocket'
import type { WebSocketEvent } from '@/stores/types'

export interface RealtimeOptions {
  autoConnect?: boolean
  subscriptions?: {
    machine?: string
    yard?: string
  }
  reconnectConfig?: {
    maxAttempts: number
    interval: number
  }
}

export interface RealtimeEventData {
  [eventType: string]: any
}

export function useRealtime(events: string[] = [], options: RealtimeOptions = {}) {
  const wsStore = useWebSocketStore()
  const { isConnected, isConnecting, connectionStatus, recentEvents } = storeToRefs(wsStore)
  
  const data = ref<RealtimeEventData>({})
  const eventHistory = ref<Map<string, WebSocketEvent[]>>(new Map())
  const unsubscribeFunctions = ref<(() => void)[]>([])
  const lastEventTimestamp = ref<Record<string, string>>({})
  
  // Connection state
  const connectionError = ref<string | null>(null)
  const connectionRetries = ref(0)
  const isInitialized = ref(false)
  
  // Computed properties
  const hasRecentData = computed(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return Object.values(lastEventTimestamp.value).some(timestamp => 
      new Date(timestamp).getTime() > fiveMinutesAgo
    )
  })
  
  const connectionStats = computed(() => wsStore.getConnectionStats())
  
  const filteredRecentEvents = computed(() => {
    return recentEvents.value.filter(event => 
      events.length === 0 || events.includes(event.type)
    )
  })
  
  const dataAge = computed(() => {
    const ages: Record<string, number> = {}
    Object.entries(lastEventTimestamp.value).forEach(([eventType, timestamp]) => {
      ages[eventType] = Date.now() - new Date(timestamp).getTime()
    })
    return ages
  })
  
  // Event handlers
  function handleEvent(eventType: string, eventData: any) {
    // Update data
    data.value[eventType] = eventData
    lastEventTimestamp.value[eventType] = new Date().toISOString()
    
    // Update event history
    if (!eventHistory.value.has(eventType)) {
      eventHistory.value.set(eventType, [])
    }
    
    const history = eventHistory.value.get(eventType)!
    history.unshift({
      id: `${eventType}_${Date.now()}`,
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString()
    })
    
    // Keep only last 50 events per type
    if (history.length > 50) {
      history.splice(50)
    }
  }
  
  function handleConnectionError(error: any) {
    connectionError.value = error.message || 'Connection error occurred'
    connectionRetries.value++
  }
  
  function handleConnectionSuccess() {
    connectionError.value = null
    connectionRetries.value = 0
  }
  
  // Connection management
  async function connect(url?: string, protocols?: string[]) {
    if (isConnected.value || isConnecting.value) return
    
    try {
      // Use default WebSocket URL if not provided
      const wsUrl = url || `ws://${window.location.host}/ws`
      wsStore.connect(wsUrl, protocols)
      
      // Set up subscriptions after connection
      if (options.subscriptions) {
        if (options.subscriptions.machine) {
          wsStore.subscribeToMachine(options.subscriptions.machine)
        }
        if (options.subscriptions.yard) {
          wsStore.subscribeToYard(options.subscriptions.yard)
        }
      }
      
    } catch (error) {
      handleConnectionError(error)
    }
  }
  
  function disconnect() {
    wsStore.disconnect()
    connectionError.value = null
  }
  
  function reconnect() {
    disconnect()
    setTimeout(() => {
      connect()
    }, 1000)
  }
  
  // Event subscription management
  function subscribe(eventType: string, callback?: (data: any) => void) {
    if (!events.includes(eventType)) {
      events.push(eventType)
    }
    
    const unsubscribe = wsStore.addEventListener(eventType, (eventData: any) => {
      handleEvent(eventType, eventData)
      callback?.(eventData)
    })
    
    unsubscribeFunctions.value.push(unsubscribe)
    return unsubscribe
  }
  
  function unsubscribe(eventType: string) {
    const index = events.indexOf(eventType)
    if (index > -1) {
      events.splice(index, 1)
    }
    
    // Remove from data and history
    delete data.value[eventType]
    delete lastEventTimestamp.value[eventType]
    eventHistory.value.delete(eventType)
  }
  
  function unsubscribeAll() {
    unsubscribeFunctions.value.forEach(fn => fn())
    unsubscribeFunctions.value = []
    events.length = 0
    data.value = {}
    lastEventTimestamp.value = {}
    eventHistory.value.clear()
  }
  
  // Machine and yard subscriptions
  function subscribeToMachine(machineId: string) {
    wsStore.subscribeToMachine(machineId)
    
    // Subscribe to common machine events
    const machineEvents = [
      'machine.status',
      'machine.location',
      'machine.battery',
      'machine.error',
      'task.progress',
      'task.completed',
      'task.failed'
    ]
    
    machineEvents.forEach(eventType => {
      subscribe(eventType)
    })
  }
  
  function unsubscribeFromMachine(machineId: string) {
    wsStore.unsubscribeFromMachine(machineId)
  }
  
  function subscribeToYard(yardId: string) {
    wsStore.subscribeToYard(yardId)
    
    // Subscribe to common yard events
    const yardEvents = [
      'yard.weather',
      'yard.zone_updated',
      'yard.obstacle_detected',
      'yard.boundary_crossed'
    ]
    
    yardEvents.forEach(eventType => {
      subscribe(eventType)
    })
  }
  
  function unsubscribeFromYard(yardId: string) {
    wsStore.unsubscribeFromYard(yardId)
  }
  
  // Data utilities
  function getLatestData(eventType: string) {
    return data.value[eventType] || null
  }
  
  function getEventHistory(eventType: string, limit = 20) {
    const history = eventHistory.value.get(eventType) || []
    return history.slice(0, limit)
  }
  
  function clearEventHistory(eventType?: string) {
    if (eventType) {
      eventHistory.value.delete(eventType)
    } else {
      eventHistory.value.clear()
    }
  }
  
  function emit(eventType: string, payload: any) {
    wsStore.send({
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    })
  }
  
  function sendCommand(command: string, parameters: Record<string, any> = {}) {
    emit('command', {
      command,
      parameters,
      requestId: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    })
  }
  
  // Status monitoring
  function getDataFreshness() {
    const freshness: Record<string, 'fresh' | 'stale' | 'expired'> = {}
    const now = Date.now()
    
    Object.entries(lastEventTimestamp.value).forEach(([eventType, timestamp]) => {
      const age = now - new Date(timestamp).getTime()
      
      if (age < 30000) { // 30 seconds
        freshness[eventType] = 'fresh'
      } else if (age < 300000) { // 5 minutes
        freshness[eventType] = 'stale'
      } else {
        freshness[eventType] = 'expired'
      }
    })
    
    return freshness
  }
  
  function isDataFresh(eventType: string, maxAge = 30000) {
    const timestamp = lastEventTimestamp.value[eventType]
    if (!timestamp) return false
    
    return Date.now() - new Date(timestamp).getTime() < maxAge
  }
  
  // Watch for connection changes
  watch(isConnected, (connected) => {
    if (connected) {
      handleConnectionSuccess()
    }
  })
  
  // Watch for connection errors
  watch(() => wsStore.recentEvents, (events) => {
    const errorEvent = events.find(e => 
      e.type.includes('error') || e.type.includes('connection.closed')
    )
    
    if (errorEvent && errorEvent.timestamp > (lastEventTimestamp.value['_last_check'] || '')) {
      handleConnectionError({ message: errorEvent.data?.error || 'Connection issue' })
      lastEventTimestamp.value['_last_check'] = errorEvent.timestamp
    }
  }, { deep: true })
  
  // Initialize
  onMounted(() => {
    // Set up reconnection configuration
    if (options.reconnectConfig) {
      wsStore.setReconnectConfig(
        options.reconnectConfig.maxAttempts,
        options.reconnectConfig.interval
      )
    }
    
    // Subscribe to events
    events.forEach(eventType => {
      const unsubscribe = wsStore.addEventListener(eventType, (eventData: any) => {
        handleEvent(eventType, eventData)
      })
      unsubscribeFunctions.value.push(unsubscribe)
    })
    
    // Auto-connect if enabled
    if (options.autoConnect !== false) {
      connect()
    }
    
    isInitialized.value = true
  })
  
  // Cleanup
  onUnmounted(() => {
    unsubscribeAll()
    
    // Unsubscribe from machine/yard if specified
    if (options.subscriptions?.machine) {
      unsubscribeFromMachine(options.subscriptions.machine)
    }
    if (options.subscriptions?.yard) {
      unsubscribeFromYard(options.subscriptions.yard)
    }
  })
  
  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionStatus,
    connectionError: computed(() => connectionError.value),
    connectionRetries: computed(() => connectionRetries.value),
    connectionStats,
    isInitialized: computed(() => isInitialized.value),
    
    // Data state
    data: computed(() => data.value),
    eventHistory: computed(() => eventHistory.value),
    lastEventTimestamp: computed(() => lastEventTimestamp.value),
    hasRecentData,
    dataAge,
    filteredRecentEvents,
    
    // Connection methods
    connect,
    disconnect,
    reconnect,
    
    // Subscription methods
    subscribe,
    unsubscribe,
    unsubscribeAll,
    subscribeToMachine,
    unsubscribeFromMachine,
    subscribeToYard,
    unsubscribeFromYard,
    
    // Data methods
    getLatestData,
    getEventHistory,
    clearEventHistory,
    emit,
    sendCommand,
    
    // Status methods
    getDataFreshness,
    isDataFresh
  }
}