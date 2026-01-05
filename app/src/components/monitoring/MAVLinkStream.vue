<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

interface MAVLinkMessage {
  id: number
  timestamp: string
  type: string
  content: string
  level: 'info' | 'warning' | 'error'
}

const messages = ref<MAVLinkMessage[]>([
  { id: 1, timestamp: '14:23:45', type: 'HEARTBEAT', content: 'System status: ACTIVE', level: 'info' },
  { id: 2, timestamp: '14:23:44', type: 'GPS_RAW_INT', content: 'Lat: 40.7128, Lon: -74.0060, Alt: 15m', level: 'info' },
  { id: 3, timestamp: '14:23:43', type: 'ATTITUDE', content: 'Roll: 0.1°, Pitch: -0.2°, Yaw: 45.3°', level: 'info' },
  { id: 4, timestamp: '14:23:42', type: 'BATTERY_STATUS', content: 'Voltage: 16.8V, Current: 2.3A, Remaining: 87%', level: 'info' },
  { id: 5, timestamp: '14:23:41', type: 'SYS_STATUS', content: 'Load: 45%, Errors: 0', level: 'info' }
])

const handleClear = () => {
  messages.value = []
}

const handleExport = () => {
  console.log('Exporting MAVLink messages...')
}

const handleFilter = () => {
  console.log('Filter messages...')
}
</script>

<template>
  <Card>
    <template #header>
      <div class="stream-header">
        <div>
          <div class="card-title">MAVLink Stream</div>
          <div class="card-subtitle">Real-time message log</div>
        </div>
        <div class="stream-actions">
          <Button variant="outline" size="sm" @click="handleFilter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="handleExport">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="handleClear">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </Button>
        </div>
      </div>
    </template>

    <div class="messages-container">
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
  }
}

.stream-actions {
  display: flex;
  gap: var(--spacing-xs);

  svg {
    width: 14px;
    height: 14px;
  }
}

.messages-container {
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: var(--font-size-xs);
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
