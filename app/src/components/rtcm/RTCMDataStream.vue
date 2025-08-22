<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-subtitle1">
          Real-time Data Stream
          <q-chip v-if="hasRecentData" color="positive" text-color="white" size="sm" dense>
            LIVE
          </q-chip>
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          flat
          round
          dense
          :icon="isPaused ? 'mdi-play' : 'mdi-pause'"
          @click="isPaused = !isPaused"
          :disable="!isActive"
        >
          <q-tooltip>{{ isPaused ? 'Resume' : 'Pause' }} stream</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          icon="mdi-delete"
          @click="clearStream"
          :disable="streamingData.length === 0"
        >
          <q-tooltip>Clear stream</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          icon="mdi-download"
          @click="exportStream"
          :disable="streamingData.length === 0"
        >
          <q-tooltip>Export stream data</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div v-if="!isActive" class="text-center q-py-lg text-grey-6">
      <q-icon name="mdi-satellite-uplink" size="64px" color="grey-4" />
      <div class="q-mt-md">No active RTCM connection</div>
    </div>

    <div v-else-if="filteredData.length === 0" class="text-center q-py-lg text-grey-6">
      <q-circular-progress
        indeterminate
        size="50px"
        :thickness="0.2"
        color="primary"
        track-color="grey-3"
      />
      <div class="q-mt-md">Waiting for RTCM data...</div>
    </div>

    <div v-else>
      <!-- Filters -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div class="col-12 col-md-6">
          <q-input
            v-model="messageTypeFilter"
            label="Filter by message type"
            dense
            clearable
          >
            <template v-slot:prepend>
              <q-icon name="mdi-filter" />
            </template>
          </q-input>
        </div>
        <div class="col-12 col-md-6">
          <q-select
            v-model="displayMode"
            :options="displayModeOptions"
            label="Display mode"
            emit-value
            map-options
            dense
          />
        </div>
      </div>

      <!-- Data Table -->
      <q-virtual-scroll
        :items="filteredData"
        virtual-scroll-item-size="48"
        style="height: 400px"
        class="rtcm-data-stream"
      >
        <template v-slot="{ item, index }">
          <q-item :key="index" dense class="rtcm-message-item">
            <q-item-section side>
              <q-item-label caption>
                {{ formatTimestamp(item.timestamp) }}
              </q-item-label>
            </q-item-section>

            <q-item-section>
              <q-item-label>
                <q-badge color="primary" class="q-mr-sm">
                  {{ item.messageType }}
                </q-badge>
                {{ item.messageName }}
              </q-item-label>
              <q-item-label caption v-if="displayMode === 'detailed'">
                Length: {{ item.length }} bytes
                <span v-if="item.stationId"> | Station: {{ item.stationId }}</span>
              </q-item-label>
            </q-item-section>

            <q-item-section side v-if="displayMode === 'detailed'">
              <q-btn
                size="sm"
                flat
                dense
                icon="mdi-information"
                @click="showMessageDetails(item)"
              />
            </q-item-section>
          </q-item>
        </template>
      </q-virtual-scroll>

      <!-- Stream Statistics -->
      <q-card flat bordered class="q-mt-md">
        <q-card-section>
          <div class="row q-col-gutter-md text-center">
            <div class="col">
              <div class="text-caption text-grey-7">Messages</div>
              <div class="text-body1 text-weight-medium">{{ streamingData.length }}</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-7">Rate</div>
              <div class="text-body1 text-weight-medium">{{ messageRate }} msg/s</div>
            </div>
            <div class="col">
              <div class="text-caption text-grey-7">Unique Types</div>
              <div class="text-body1 text-weight-medium">{{ uniqueMessageTypes }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Message Details Dialog -->
    <q-dialog v-model="showDetailsDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Message Details</div>
        </q-card-section>

        <q-separator />

        <q-card-section v-if="selectedMessage">
          <q-list dense>
            <q-item>
              <q-item-section>Type:</q-item-section>
              <q-item-section>{{ selectedMessage.messageType }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Name:</q-item-section>
              <q-item-section>{{ selectedMessage.messageName }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Timestamp:</q-item-section>
              <q-item-section>{{ new Date(selectedMessage.timestamp).toLocaleString() }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>Length:</q-item-section>
              <q-item-section>{{ selectedMessage.length }} bytes</q-item-section>
            </q-item>
            <q-item v-if="selectedMessage.stationId">
              <q-item-section>Station ID:</q-item-section>
              <q-item-section>{{ selectedMessage.stationId }}</q-item-section>
            </q-item>
          </q-list>

          <div class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Description</div>
            <div class="text-body2">{{ getMessageDescription(selectedMessage.messageType.toString()) }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'

const $q = useQuasar()
const { 
  isActive, 
  streamingData,
  hasRecentData 
} = useRTCM()

const isPaused = ref(false)
const messageTypeFilter = ref('')
const displayMode = ref<'compact' | 'detailed'>('compact')
const showDetailsDialog = ref(false)
const selectedMessage = ref<{messageType: number, messageName: string, timestamp: number, length: number, stationId?: number} | null>(null)

const displayModeOptions = [
  { label: 'Compact', value: 'compact' },
  { label: 'Detailed', value: 'detailed' }
]

const filteredData = computed(() => {
  if (isPaused.value) return []
  
  let data = streamingData.value
  
  if (messageTypeFilter.value) {
    data = data.filter(msg => 
      msg.messageType.toString().includes(messageTypeFilter.value)
    )
  }
  
  return data
})

const messageRate = computed(() => {
  if (streamingData.value.length < 2) return 0
  
  const firstMsg = streamingData.value[streamingData.value.length - 1]
  const lastMsg = streamingData.value[0]
  const timeDiff = (lastMsg?.timestamp && firstMsg?.timestamp) ? (lastMsg.timestamp - firstMsg.timestamp) / 1000 : 0
  
  if (timeDiff === 0) return 0
  
  return (streamingData.value.length / timeDiff).toFixed(1)
})

const uniqueMessageTypes = computed(() => {
  const types = new Set(streamingData.value.map(msg => msg.messageType))
  return types.size
})

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

function clearStream() {
  streamingData.value.splice(0, streamingData.value.length)
  $q.notify({
    type: 'info',
    message: 'Stream data cleared',
    position: 'top'
  })
}

function exportStream() {
  const data = streamingData.value.map(msg => ({
    timestamp: new Date(msg.timestamp).toISOString(),
    messageType: msg.messageType,
    messageName: msg.messageName,
    length: msg.length,
    stationId: msg.stationId
  }))
  
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rtcm-stream-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  
  $q.notify({
    type: 'positive',
    message: 'Stream data exported',
    position: 'top'
  })
}

function showMessageDetails(message: {messageType: number, messageName: string, timestamp: number, length: number, stationId?: number}) {
  selectedMessage.value = message
  showDetailsDialog.value = true
}

function getMessageDescription(type: string): string {
  const descriptions: Record<string, string> = {
    '1001': 'L1-only GPS RTK observables',
    '1002': 'Extended L1-only GPS RTK observables',
    '1003': 'L1/L2 GPS RTK observables',
    '1004': 'Extended L1/L2 GPS RTK observables',
    '1005': 'Stationary RTK reference station ARP',
    '1006': 'Stationary RTK reference station ARP with height',
    '1007': 'Antenna descriptor',
    '1008': 'Antenna descriptor & serial number',
    '1009': 'L1-only GLONASS RTK observables',
    '1010': 'Extended L1-only GLONASS RTK observables',
    '1011': 'L1/L2 GLONASS RTK observables',
    '1012': 'Extended L1/L2 GLONASS RTK observables',
    '1019': 'GPS ephemerides',
    '1020': 'GLONASS ephemerides',
    '1033': 'Receiver and antenna descriptors',
    '1074': 'GPS MSM4 - Multiple Signal Messages for GPS',
    '1077': 'GPS MSM7 - Full GPS observables',
    '1084': 'GLONASS MSM4',
    '1087': 'GLONASS MSM7',
    '1094': 'Galileo MSM4',
    '1097': 'Galileo MSM7',
    '1124': 'BeiDou MSM4',
    '1127': 'BeiDou MSM7',
    '1230': 'GLONASS code-phase biases',
    '4072': 'Reference station PVT (u-blox proprietary)'
  }
  
  return descriptions[type] || 'Unknown message type'
}
</script>

<style scoped>
.rtcm-data-stream {
  background: #f5f5f5;
  border-radius: 4px;
}

.rtcm-message-item {
  border-bottom: 1px solid #e0e0e0;
}

.rtcm-message-item:hover {
  background: #fafafa;
}

.q-dark .rtcm-data-stream {
  background: #1d1d1d;
}

.q-dark .rtcm-message-item {
  border-bottom-color: #313131;
}

.q-dark .rtcm-message-item:hover {
  background: #262626;
}
</style>