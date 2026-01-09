<template>
  <div class="api-demo">
    <h2>YardRover API Services Demo</h2>

    <!-- Authentication Section -->
    <section class="demo-section">
      <h3>Authentication</h3>
      <div class="demo-controls">
        <input v-model="loginForm.email" type="email" placeholder="Email" class="demo-input" />
        <input
          v-model="loginForm.password"
          type="password"
          placeholder="Password"
          class="demo-input"
        />
        <button :disabled="isLoading" class="demo-button" @click="handleLogin">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
        <button class="demo-button secondary" @click="handleLogout">Logout</button>
      </div>
      <div v-if="currentUser" class="demo-status">
        Logged in as: {{ currentUser.firstName }} {{ currentUser.lastName }}
      </div>
    </section>

    <!-- Machine Status Section -->
    <section class="demo-section">
      <h3>Machine Status</h3>
      <div class="demo-controls">
        <button :disabled="isLoading" class="demo-button" @click="fetchMachineStatus">
          Get Machine Status
        </button>
        <button :disabled="isLoading" class="demo-button" @click="startMachine">
          Start Machine
        </button>
        <button :disabled="isLoading" class="demo-button" @click="stopMachine">Stop Machine</button>
      </div>
      <div v-if="machineStatus" class="demo-status">
        <strong>Machine:</strong> {{ machineStatus.name }}<br />
        <strong>Status:</strong> {{ machineStatus.status }}<br />
        <strong>Battery:</strong> {{ machineStatus.batteryLevel }}%<br />
        <strong>Mode:</strong> {{ machineStatus.mode }}
      </div>
    </section>

    <!-- WebSocket Section -->
    <section class="demo-section">
      <h3>Real-time Updates</h3>
      <div class="demo-controls">
        <button :disabled="isConnected" class="demo-button" @click="connectWebSocket">
          Connect WebSocket
        </button>
        <button :disabled="!isConnected" class="demo-button" @click="disconnectWebSocket">
          Disconnect WebSocket
        </button>
      </div>
      <div class="demo-status">
        <strong>WebSocket Status:</strong> {{ isConnected ? 'Connected' : 'Disconnected' }}
      </div>
      <div v-if="realtimeUpdates.length > 0" class="demo-logs">
        <h4>Real-time Updates:</h4>
        <div v-for="update in realtimeUpdates.slice(-5)" :key="update.id" class="log-entry">
          <span class="timestamp">{{ formatTime(update.timestamp) }}</span>
          <span class="event-type">{{ update.type }}</span>
          <span class="event-data">{{ JSON.stringify(update.data) }}</span>
        </div>
      </div>
    </section>

    <!-- Yard Management Section -->
    <section class="demo-section">
      <h3>Yard Management</h3>
      <div class="demo-controls">
        <button :disabled="isLoading" class="demo-button" @click="fetchYards">Get Yards</button>
        <button :disabled="isLoading" class="demo-button" @click="fetchWeather">Get Weather</button>
      </div>
      <div v-if="yards.length > 0" class="demo-status">
        <strong>Yards:</strong> {{ yards.length }} configured<br />
        <div v-for="yard in yards" :key="yard.id" class="yard-item">
          {{ yard.name }} - {{ yard.area }}m²
        </div>
      </div>
      <div v-if="weather" class="demo-status">
        <strong>Weather:</strong> {{ weather.current.conditions }},
        {{ weather.current.temperature }}°C
      </div>
    </section>

    <!-- Error Display -->
    <section v-if="error" class="demo-section error">
      <h3>Error</h3>
      <div class="error-message">
        {{ error }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  authService,
  machineService,
  yardService,
  initializeWebSocket,
  type User,
  type MachineStatus,
  type Yard,
  type WeatherData,
  type WebSocketEventType
} from '@/services'

// Reactive state
const isLoading = ref(false)
const error = ref<string | null>(null)
const currentUser = ref<User | null>(null)
const machineStatus = ref<MachineStatus | null>(null)
const yards = ref<Yard[]>([])
const weather = ref<WeatherData | null>(null)
const isConnected = ref(false)
const realtimeUpdates = ref<
  Array<{
    id: string
    type: WebSocketEventType
    data: any
    timestamp: string
  }>
>([])

// Form data
const loginForm = ref({
  email: 'demo@yardrover.com',
  password: 'demo123'
})

// WebSocket instance
let websocket: any = null
const unsubscribeFunctions: Array<() => void> = []

// Helper functions
const clearError = () => {
  error.value = null
}

const handleError = (err: any) => {
  console.error('API Error:', err)
  error.value = err.message || 'An unexpected error occurred'
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

// Authentication methods
const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    error.value = 'Please enter email and password'
    return
  }

  isLoading.value = true
  clearError()

  try {
    const response = await authService.login({
      email: loginForm.value.email,
      password: loginForm.value.password,
      rememberMe: true
    })

    currentUser.value = response.user
    console.log('Login successful:', response)
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const handleLogout = async () => {
  isLoading.value = true
  clearError()

  try {
    await authService.logout()
    currentUser.value = null
    machineStatus.value = null
    yards.value = []
    weather.value = null
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

// Machine methods
const fetchMachineStatus = async () => {
  isLoading.value = true
  clearError()

  try {
    const machines = await machineService.getAllMachines()
    if (machines.length > 0) {
      machineStatus.value = machines[0]
    } else {
      error.value = 'No machines found'
    }
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const startMachine = async () => {
  if (!machineStatus.value) {
    error.value = 'No machine selected'
    return
  }

  isLoading.value = true
  clearError()

  try {
    await machineService.startMachine(machineStatus.value.id)
    await fetchMachineStatus() // Refresh status
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const stopMachine = async () => {
  if (!machineStatus.value) {
    error.value = 'No machine selected'
    return
  }

  isLoading.value = true
  clearError()

  try {
    await machineService.stopMachine(machineStatus.value.id)
    await fetchMachineStatus() // Refresh status
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

// Yard methods
const fetchYards = async () => {
  isLoading.value = true
  clearError()

  try {
    yards.value = await yardService.getYards()
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

const fetchWeather = async () => {
  if (yards.value.length === 0) {
    error.value = 'No yards available for weather data'
    return
  }

  isLoading.value = true
  clearError()

  try {
    weather.value = await yardService.getWeather(yards.value[0].id)
  } catch (err) {
    handleError(err)
  } finally {
    isLoading.value = false
  }
}

// WebSocket methods
const connectWebSocket = () => {
  try {
    websocket = initializeWebSocket()
    if (!websocket) {
      error.value = 'Failed to initialize WebSocket'
      return
    }

    // Subscribe to various events
    const events: WebSocketEventType[] = [
      'machine.status',
      'machine.location',
      'machine.battery',
      'task.progress',
      'obstacle.detected',
      'connection.status'
    ]

    events.forEach(eventType => {
      const unsubscribe = websocket.subscribe(eventType, (data: any) => {
        realtimeUpdates.value.push({
          id: Date.now().toString(),
          type: eventType,
          data,
          timestamp: new Date().toISOString()
        })

        // Keep only last 20 updates
        if (realtimeUpdates.value.length > 20) {
          realtimeUpdates.value = realtimeUpdates.value.slice(-20)
        }
      })
      unsubscribeFunctions.push(unsubscribe)
    })

    // Connect
    websocket
      .connect()
      .then(() => {
        isConnected.value = true
      })
      .catch((err: any) => {
        handleError(err)
      })
  } catch (err) {
    handleError(err)
  }
}

const disconnectWebSocket = () => {
  if (websocket) {
    // Unsubscribe from all events
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    unsubscribeFunctions.length = 0

    websocket.disconnect()
    websocket = null
    isConnected.value = false
  }
}

// Lifecycle
onMounted(async () => {
  // Check if user is already logged in
  try {
    if (authService.isLoggedIn()) {
      currentUser.value = await authService.getCurrentUser()
    }
  } catch (err) {
    console.log('Not logged in or token expired')
  }
})

onUnmounted(() => {
  disconnectWebSocket()
})
</script>

<style scoped>
.api-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.demo-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.demo-section.error {
  border-color: #f44336;
  background: #ffebee;
}

.demo-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.demo-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.demo-input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 200px;
}

.demo-button {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.demo-button:hover:not(:disabled) {
  background: #45a049;
}

.demo-button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.demo-button.secondary {
  background: #2196f3;
}

.demo-button.secondary:hover:not(:disabled) {
  background: #0b7dda;
}

.demo-status {
  padding: 1rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  margin-top: 1rem;
}

.error-message {
  color: #f44336;
  font-weight: bold;
}

.demo-logs {
  margin-top: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  font-family: monospace;
  font-size: 0.8rem;
}

.timestamp {
  color: #666;
  min-width: 80px;
}

.event-type {
  color: #2196f3;
  font-weight: bold;
  min-width: 120px;
}

.event-data {
  color: #333;
  word-break: break-all;
}

.yard-item {
  padding: 0.25rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.yard-item:last-child {
  border-bottom: none;
}
</style>
