# Stage 7: Vue Composables and Utilities

## Objective

Create reusable Vue 3 composables for common functionality like machine control, real-time data, geolocation, and UI interactions.

## Tasks

1. Create composables for machine operations
2. Build real-time data synchronization composable
3. Develop geolocation and mapping utilities
4. Create notification system composable
5. Build form validation composables
6. Implement permission checking composable
7. Create responsive design helpers
8. Build keyboard shortcuts composable
9. Implement data persistence composable
10. Create animation and transition composables

## Composables Structure

```typescript
src/composables/
├── useMachine.ts           // Machine control operations
├── useRealtime.ts          // WebSocket real-time data
├── useGeolocation.ts       // GPS and location tracking
├── useYardMap.ts           // Yard mapping utilities
├── useNotifications.ts     // Toast and alert system
├── usePermissions.ts       // User permission checks
├── useResponsive.ts        // Responsive breakpoints
├── useKeyboard.ts          // Keyboard shortcuts
├── useStorage.ts           // Local storage wrapper
├── useAnimation.ts         // Animation utilities
├── useWeather.ts           // Weather integration
└── useValidation.ts        // Form validation rules
```

## Core Composables

### useMachine.ts
```typescript
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMachineStore } from '@/stores/machine'
import { MachineService } from '@/services/machine/MachineService'

export function useMachine() {
  const store = useMachineStore()
  const { status, mode, battery, location } = storeToRefs(store)
  
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  
  // Computed properties
  const isOperational = computed(() => 
    status.value === 'running' || status.value === 'paused'
  )
  
  const canStart = computed(() => 
    status.value === 'idle' && battery.value > 20
  )
  
  const batteryLow = computed(() => battery.value < 20)
  
  // Methods
  async function start(options?: StartOptions) {
    isLoading.value = true
    error.value = null
    
    try {
      await store.startMachine(options)
      return { success: true }
    } catch (e) {
      error.value = e as Error
      return { success: false, error: e }
    } finally {
      isLoading.value = false
    }
  }
  
  async function stop() {
    isLoading.value = true
    try {
      await store.stopMachine()
    } finally {
      isLoading.value = false
    }
  }
  
  async function pause() {
    await store.pauseMachine()
  }
  
  async function resume() {
    await store.resumeMachine()
  }
  
  async function setMode(newMode: MachineMode) {
    await store.setMode(newMode)
  }
  
  // Auto-stop on critical battery
  watch(battery, (newBattery) => {
    if (newBattery <= 5 && isOperational.value) {
      stop()
    }
  })
  
  return {
    // State
    status,
    mode,
    battery,
    location,
    isLoading,
    error,
    
    // Computed
    isOperational,
    canStart,
    batteryLow,
    
    // Methods
    start,
    stop,
    pause,
    resume,
    setMode
  }
}
```

### useRealtime.ts
```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'

export function useRealtime(events: string[]) {
  const wsStore = useWebSocketStore()
  const data = ref<Record<string, any>>({})
  const isConnected = computed(() => wsStore.isConnected)
  
  const handlers = new Map<string, Function>()
  
  function handleEvent(event: string, payload: any) {
    data.value[event] = payload
  }
  
  onMounted(() => {
    // Subscribe to events
    events.forEach(event => {
      const handler = (payload: any) => handleEvent(event, payload)
      handlers.set(event, handler)
      wsStore.subscribe(event, handler)
    })
    
    // Connect if not already connected
    if (!isConnected.value) {
      wsStore.connect()
    }
  })
  
  onUnmounted(() => {
    // Unsubscribe from events
    handlers.forEach((handler, event) => {
      wsStore.unsubscribe(event, handler)
    })
    handlers.clear()
  })
  
  return {
    data,
    isConnected,
    
    emit: (event: string, payload: any) => {
      wsStore.emit(event, payload)
    }
  }
}
```

### useYardMap.ts
```typescript
import { ref, computed } from 'vue'
import { useYardStore } from '@/stores/yard'

export function useYardMap() {
  const yardStore = useYardStore()
  const mapRef = ref<HTMLElement>()
  
  const zones = computed(() => yardStore.zones)
  const obstacles = computed(() => yardStore.obstacles)
  const currentPath = computed(() => yardStore.currentPath)
  
  function createZone(coordinates: Coordinate[]) {
    return yardStore.createZone({
      name: `Zone ${zones.value.length + 1}`,
      coordinates,
      type: 'mowing',
      priority: 'normal'
    })
  }
  
  function updateZone(id: string, updates: Partial<Zone>) {
    return yardStore.updateZone(id, updates)
  }
  
  function deleteZone(id: string) {
    return yardStore.deleteZone(id)
  }
  
  function addObstacle(location: Coordinate, type: ObstacleType) {
    return yardStore.addObstacle({
      location,
      type,
      permanent: type === 'tree' || type === 'building'
    })
  }
  
  function calculateRoute(start: Coordinate, zones: string[]) {
    return yardStore.calculateRoute(start, zones)
  }
  
  function exportMap() {
    const data = {
      zones: zones.value,
      obstacles: obstacles.value,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yard-map-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return {
    mapRef,
    zones,
    obstacles,
    currentPath,
    
    createZone,
    updateZone,
    deleteZone,
    addObstacle,
    calculateRoute,
    exportMap
  }
}
```

### useWeather.ts
```typescript
import { ref, computed, onMounted } from 'vue'
import { WeatherService } from '@/services/weather/WeatherService'

export function useWeather() {
  const weather = ref<Weather | null>(null)
  const forecast = ref<Forecast[]>([])
  const isLoading = ref(false)
  
  const isSafeToOperate = computed(() => {
    if (!weather.value) return true
    
    // Check for unsafe conditions
    const unsafe = 
      weather.value.windSpeed > 25 || // mph
      weather.value.precipitation > 0.5 || // inches/hr
      weather.value.visibility < 0.5 // miles
    
    return !unsafe
  })
  
  const operationWarnings = computed(() => {
    const warnings = []
    
    if (weather.value?.temperature < 32) {
      warnings.push('Freezing conditions detected')
    }
    
    if (weather.value?.windSpeed > 15) {
      warnings.push('High wind conditions')
    }
    
    if (weather.value?.precipitation > 0) {
      warnings.push('Precipitation detected')
    }
    
    return warnings
  })
  
  async function fetchWeather(location?: Coordinate) {
    isLoading.value = true
    try {
      weather.value = await WeatherService.getCurrent(location)
      forecast.value = await WeatherService.getForecast(location)
    } finally {
      isLoading.value = false
    }
  }
  
  onMounted(() => {
    fetchWeather()
    
    // Refresh every 30 minutes
    const interval = setInterval(() => {
      fetchWeather()
    }, 30 * 60 * 1000)
    
    onUnmounted(() => clearInterval(interval))
  })
  
  return {
    weather,
    forecast,
    isLoading,
    isSafeToOperate,
    operationWarnings,
    refresh: fetchWeather
  }
}
```

## Expected Output

A comprehensive collection of reusable Vue 3 composables that encapsulate common functionality and business logic for the YardRover application.
