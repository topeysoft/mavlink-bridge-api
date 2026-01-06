<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import { useConnectionStore } from '@/stores/connection'
import { MAVLinkDecoder, MAVLinkMessageType } from '@mavlinkbridge/api-client'

interface MAVLinkMessage {
  id: number
  timestamp: string
  type: string
  content: string
  level: 'info' | 'warning' | 'error'
  messageId: number
  systemId: number
  componentId: number
}

const connectionStore = useConnectionStore()
const messages = ref<MAVLinkMessage[]>([])
const maxMessages = 100
const messageFilter = ref<Set<string>>(new Set())
const showFilterDialog = ref(false)
const autoScroll = ref(true)
const messagesContainer = ref<HTMLElement | null>(null)
const decoder = new MAVLinkDecoder()

let unsubscribe: (() => void) | undefined
let messageCounter = 0

// Setup MAVLink message subscription
onMounted(() => {
  if (!connectionStore.isConnected) {
    console.warn('MAVLinkStream: Not connected to device')
    return
  }

  const client = connectionStore.getClient()

  unsubscribe = client.communication.onMAVLinkMessage((message) => {
    // Decode the message
    const decoded = decoder.decode(
      message.messageId,
      message.systemId,
      message.componentId,
      message.payload
    )

    const messageName = decoded?.messageName || getMessageName(message.messageId)

    // Apply filter
    if (messageFilter.value.size > 0 && !messageFilter.value.has(messageName)) {
      return
    }

    // Format message content based on type
    const content = decoded ? formatMessageContent(decoded.messageName, decoded.data) : 'Unknown message'

    // Determine level based on message type
    let level: 'info' | 'warning' | 'error' = 'info'
    if (messageName.includes('ERROR') || messageName.includes('CRITICAL')) {
      level = 'error'
    } else if (messageName.includes('WARNING') || messageName === 'COMMAND_ACK') {
      level = 'warning'
    }

    // Add message to list
    messages.value.push({
      id: ++messageCounter,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type: messageName,
      content,
      level,
      messageId: message.messageId,
      systemId: message.systemId,
      componentId: message.componentId
    })

    // Trim to max messages
    if (messages.value.length > maxMessages) {
      messages.value = messages.value.slice(-maxMessages)
    }

    // Auto-scroll to bottom
    if (autoScroll.value) {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

// Get message name from ID
function getMessageName(messageId: number): string {
  const typeMap: Record<number, string> = {
    [MAVLinkMessageType.HEARTBEAT]: 'HEARTBEAT',
    [MAVLinkMessageType.SYS_STATUS]: 'SYS_STATUS',
    [MAVLinkMessageType.GPS_RAW_INT]: 'GPS_RAW_INT',
    [MAVLinkMessageType.GPS_STATUS]: 'GPS_STATUS',
    [MAVLinkMessageType.SCALED_IMU]: 'SCALED_IMU',
    [MAVLinkMessageType.RAW_IMU]: 'RAW_IMU',
    [MAVLinkMessageType.HIGHRES_IMU]: 'HIGHRES_IMU',
    [MAVLinkMessageType.ATTITUDE]: 'ATTITUDE',
    [MAVLinkMessageType.GLOBAL_POSITION_INT]: 'GLOBAL_POSITION_INT',
    [MAVLinkMessageType.LOCAL_POSITION_NED]: 'LOCAL_POSITION_NED',
    [MAVLinkMessageType.VFR_HUD]: 'VFR_HUD',
    [MAVLinkMessageType.BATTERY_STATUS]: 'BATTERY_STATUS',
    [MAVLinkMessageType.COMMAND_ACK]: 'COMMAND_ACK'
  }
  return typeMap[messageId] || `MSG_${messageId}`
}

// Format message content for display
function formatMessageContent(messageName: string, data: any): string {
  switch (messageName) {
    case 'HEARTBEAT':
      return `Mode: ${data.customMode}, Armed: ${(data.baseMode & 0x80) !== 0}`
    case 'GPS_RAW_INT':
      return `Lat: ${(data.lat / 1e7).toFixed(6)}°, Lon: ${(data.lon / 1e7).toFixed(6)}°, Sats: ${data.satellitesVisible}`
    case 'ATTITUDE':
      return `Roll: ${(data.roll * 180 / Math.PI).toFixed(1)}°, Pitch: ${(data.pitch * 180 / Math.PI).toFixed(1)}°, Yaw: ${(data.yaw * 180 / Math.PI).toFixed(1)}°`
    case 'BATTERY_STATUS':
      const voltage = data.voltages.filter((v: number) => v !== 65535).reduce((sum: number, v: number) => sum + v / 1000, 0)
      return `Voltage: ${voltage.toFixed(2)}V, Remaining: ${data.batteryRemaining}%`
    case 'GLOBAL_POSITION_INT':
      return `Lat: ${(data.lat / 1e7).toFixed(6)}°, Lon: ${(data.lon / 1e7).toFixed(6)}°, Alt: ${(data.alt / 1000).toFixed(1)}m`
    case 'SCALED_IMU':
    case 'RAW_IMU':
      return `Acc: (${data.xacc}, ${data.yacc}, ${data.zacc}), Gyro: (${data.xgyro}, ${data.ygyro}, ${data.zgyro})`
    case 'VFR_HUD':
      return `Speed: ${data.groundspeed.toFixed(1)}m/s, Alt: ${data.alt.toFixed(1)}m, Heading: ${data.heading}°`
    default:
      return JSON.stringify(data).substring(0, 100)
  }
}

const handleClear = () => {
  messages.value = []
  messageCounter = 0
}

const handleExport = () => {
  const data = messages.value.map(m => ({
    timestamp: m.timestamp,
    type: m.type,
    content: m.content,
    messageId: m.messageId,
    systemId: m.systemId,
    componentId: m.componentId
  }))

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mavlink-messages-${new Date().toISOString()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleFilter = () => {
  showFilterDialog.value = !showFilterDialog.value
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
}

// Connection status
const isConnected = computed(() => connectionStore.isConnected)
</script>

<template>
  <Card>
    <template #header>
      <div class="stream-header">
        <div>
          <div class="card-title">MAVLink Stream</div>
          <div class="card-subtitle">
            <span v-if="isConnected" class="status-connected">
              <span class="status-dot"></span>
              Live
            </span>
            <span v-else class="status-disconnected">Disconnected</span>
            · {{ messages.length }} messages
          </div>
        </div>
        <div class="stream-actions">
          <Button
            variant="outline"
            size="sm"
            :class="{ active: autoScroll }"
            @click="toggleAutoScroll"
            title="Auto-scroll"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="handleFilter" title="Filter messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="handleExport" title="Export messages" :disabled="messages.length === 0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="handleClear" title="Clear messages" :disabled="messages.length === 0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </Button>
        </div>
      </div>
    </template>

    <div ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-state">
        <p v-if="!isConnected">Not connected to device</p>
        <p v-else>Waiting for MAVLink messages...</p>
      </div>
      <div v-for="message in messages" :key="message.id" class="message" :class="`message-${message.level}`">
        <span class="message-timestamp">{{ message.timestamp }}</span>
        <span class="message-type">{{ message.type }}</span>
        <span class="message-content">{{ message.content }}</span>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);

  .card-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .card-subtitle {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
}

.status-connected {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--status-success);
  font-weight: 500;
}

.status-disconnected {
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.stream-actions {
  display: flex;
  gap: var(--spacing-xs);

  svg {
    width: 14px;
    height: 14px;
  }

  .active {
    background: var(--primary-green);
    color: white;

    &:hover {
      background: var(--primary-green-dark);
    }
  }
}

.messages-container {
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: var(--font-size-xs);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
}

.message {
  display: grid;
  grid-template-columns: 80px 140px 1fr;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);

  &:hover {
    background: var(--bg-secondary);
  }
}

.message-timestamp {
  color: var(--text-secondary);
}

.message-type {
  color: var(--primary-green);
  font-weight: 600;
}

.message-content {
  color: var(--text-primary);
}

.message-warning {
  .message-type {
    color: var(--status-warning);
  }
}

.message-error {
  .message-type {
    color: var(--status-error);
  }
}
</style>
