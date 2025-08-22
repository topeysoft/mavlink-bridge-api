<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-subtitle1">Connection History</div>
        <div class="text-caption text-grey-6">Recent RTCM connection attempts and sessions</div>
      </div>
      <div class="col-auto">
        <q-btn
          label="Clear History"
          flat
          icon="mdi-delete"
          @click="clearHistory"
          :disable="connectionHistory.length === 0"
        />
      </div>
    </div>

    <div v-if="connectionHistory.length === 0" class="text-center q-py-lg text-grey-6">
      <q-icon name="mdi-history" size="64px" color="grey-4" />
      <div class="q-mt-md">No connection history</div>
    </div>

    <q-timeline v-else color="primary">
      <q-timeline-entry
        v-for="(entry, index) in connectionHistory"
        :key="index"
        :color="entry.success ? 'positive' : 'negative'"
        :icon="entry.success ? 'mdi-check' : 'mdi-close'"
      >
        <template v-slot:title>
          <div class="row items-center">
            <div class="col">
              {{ entry.source }}
            </div>
            <div class="col-auto text-caption text-grey-7">
              {{ formatRelativeTime(entry.timestamp) }}
            </div>
          </div>
        </template>

        <div class="text-caption">
          <div v-if="entry.success && entry.duration">
            Duration: {{ formatDuration(entry.duration) }}
          </div>
          <div v-if="entry.error" class="text-negative">
            Error: {{ entry.error }}
          </div>
          <div class="text-grey-6">
            {{ new Date(entry.timestamp).toLocaleString() }}
          </div>
        </div>
      </q-timeline-entry>
    </q-timeline>

    <!-- Connection Statistics -->
    <q-card v-if="connectionHistory.length > 0" flat bordered class="q-mt-md">
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">Statistics</div>
        <div class="row q-col-gutter-md">
          <div class="col-6 col-md-3">
            <div class="text-caption text-grey-7">Total Connections</div>
            <div class="text-h6">{{ connectionHistory.length }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-caption text-grey-7">Success Rate</div>
            <div class="text-h6">
              <span :class="successRateClass">{{ successRate }}%</span>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-caption text-grey-7">Avg. Duration</div>
            <div class="text-h6">{{ averageDuration }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="text-caption text-grey-7">Most Used</div>
            <div class="text-body2">{{ mostUsedSource }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'

const $q = useQuasar()
const { connectionHistory } = useRTCM()

const successRate = computed(() => {
  if (connectionHistory.value.length === 0) return 0
  const successCount = connectionHistory.value.filter(c => c.success).length
  return Math.round((successCount / connectionHistory.value.length) * 100)
})

const successRateClass = computed(() => {
  const rate = successRate.value
  if (rate >= 80) return 'text-positive'
  if (rate >= 50) return 'text-warning'
  return 'text-negative'
})

const averageDuration = computed(() => {
  const durations = connectionHistory.value
    .filter(c => c.success && c.duration)
    .map(c => c.duration!)
  
  if (durations.length === 0) return 'N/A'
  
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
  return formatDuration(avg)
})

const mostUsedSource = computed(() => {
  if (connectionHistory.value.length === 0) return 'N/A'
  
  const sourceCounts = connectionHistory.value.reduce((acc, entry) => {
    const source = entry.source.split(' ')[0] // Get source type
    if (source) {
      acc[source] = (acc[source] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)
  
  const entries = Object.entries(sourceCounts)
  if (entries.length === 0) return 'N/A'
  
  const topEntry = entries.sort(([, a], [, b]) => b - a)[0]
  if (!topEntry) return 'N/A'
  
  const [mostUsed] = topEntry
  return mostUsed || 'N/A'
})

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function clearHistory() {
  $q.dialog({
    title: 'Clear History',
    message: 'Are you sure you want to clear all connection history?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    connectionHistory.value.splice(0, connectionHistory.value.length)
    $q.notify({
      type: 'info',
      message: 'Connection history cleared',
      position: 'top'
    })
  })
}
</script>