<template>
  <div class="connection-status">
    <q-chip
      :color="statusColor"
      :text-color="textColor"
      :icon="statusIcon"
      size="sm"
      dense
      class="connection-status__chip"
    >
      <span class="connection-status__text">
        {{ statusText }}
      </span>
    </q-chip>

    <!-- Detailed tooltip -->
    <q-tooltip
      anchor="bottom middle"
      self="top middle"
      :offset="[0, 10]"
      class="connection-status__tooltip"
    >
      <div class="text-center">
        <div class="text-weight-medium">
          {{ detailedStatusText }}
        </div>
        <div v-if="lastConnected" class="text-caption q-mt-xs">
          Last connected: {{ formatTime(lastConnected) }}
        </div>
        <div v-if="connectionLatency" class="text-caption">Latency: {{ connectionLatency }}ms</div>
      </div>
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebSocketStore } from '@/stores/websocket'
import { formatDistanceToNow } from 'date-fns'

// Composables
const websocket = useWebSocketStore()

// Computed properties
const statusColor = computed(() => {
  switch (websocket.connectionStatus) {
    case 'connected':
      return 'positive'
    case 'connecting':
      return 'warning'
    case 'disconnected':
    default:
      return 'negative'
  }
})

const textColor = computed(() => 'white')

const statusIcon = computed(() => {
  switch (websocket.connectionStatus) {
    case 'connected':
      return 'wifi'
    case 'connecting':
      return 'wifi_tethering'
    case 'disconnected':
    default:
      return 'wifi_off'
  }
})

const statusText = computed(() => {
  switch (websocket.connectionStatus) {
    case 'connected':
      return 'Online'
    case 'connecting':
      return 'Connecting...'
    case 'disconnected':
    default:
      return 'Offline'
  }
})

const detailedStatusText = computed(() => {
  switch (websocket.connectionStatus) {
    case 'connected':
      return 'Connected to YardRover API'
    case 'connecting':
      return 'Establishing connection...'
    case 'disconnected':
    default:
      return 'Disconnected from server'
  }
})

const lastConnected = computed(() => websocket.lastConnected)
const connectionLatency = computed(() => websocket.latency)

// Methods
const formatTime = (date: Date) => {
  return formatDistanceToNow(date, { addSuffix: true })
}
</script>

<style lang="scss" scoped>
.connection-status {
  display: inline-flex;
  align-items: center;
}

.connection-status__chip {
  cursor: help;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
}

.connection-status__text {
  font-size: 0.75rem;
  font-weight: 500;
}

.connection-status__tooltip {
  font-size: 0.8rem;
  max-width: 200px;
}

// Pulsing animation for connecting state
.connection-status__chip {
  &.bg-warning {
    animation: pulse 2s infinite;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
</style>
