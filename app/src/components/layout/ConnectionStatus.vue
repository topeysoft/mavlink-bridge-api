<template>
  <q-chip
    :color="statusColor"
    text-color="white"
    :icon="statusIcon"
    size="md"
  >
    <span class="text-weight-medium">{{ statusText }}</span>
    <q-tooltip v-if="tooltipText">
      {{ tooltipText }}
    </q-tooltip>
  </q-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMAVLinkClient } from '../../composables/useMAVLinkClient'
import { useDeviceStore } from '../../stores/device'

const { isConnected, isConnecting, connectionError } = useMAVLinkClient()
const deviceStore = useDeviceStore()

const statusColor = computed(() => {
  if (isConnecting.value) return 'orange'
  if (isConnected.value) {
    return deviceStore.isHealthy ? 'positive' : 'warning'
  }
  return 'negative'
})

const statusIcon = computed(() => {
  if (isConnecting.value) return 'mdi-loading mdi-spin'
  if (isConnected.value) {
    return deviceStore.isWebSocketConnected ? 'mdi-wifi' : 'mdi-wifi-strength-1'
  }
  return 'mdi-wifi-off'
})

const statusText = computed(() => {
  if (isConnecting.value) return 'Connecting...'
  if (isConnected.value) {
    return deviceStore.isHealthy ? 'Connected' : 'Degraded'
  }
  return 'Disconnected'
})

const tooltipText = computed(() => {
  if (connectionError.value) {
    return `Error: ${connectionError.value.message}`
  }
  if (isConnected.value && deviceStore.uptime > 0) {
    const hours = Math.floor(deviceStore.uptime / 3600000)
    const minutes = Math.floor((deviceStore.uptime % 3600000) / 60000)
    return `Uptime: ${hours}h ${minutes}m | Heap: ${(deviceStore.freeHeap / 1024).toFixed(0)}KB`
  }
  return null
})
</script>

<style lang="scss" scoped>
@keyframes mdi-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mdi-spin {
  animation: mdi-spin 2s linear infinite;
}
</style>