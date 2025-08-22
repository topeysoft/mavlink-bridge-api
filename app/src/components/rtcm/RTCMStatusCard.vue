<template>
  <q-card class="rtcm-status-card full-height">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="mdi-satellite-variant" class="q-mr-sm" />
        RTCM Status
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-subtitle2 text-grey-7">Connection</div>
          <div class="text-h5">
            <q-badge 
              :color="connectionStatusColor" 
              :label="connectionStatusText"
              class="q-pa-sm"
            />
          </div>
        </div>
        <div class="col-auto">
          <q-circular-progress
            v-if="isConnecting || isStarting || isStopping"
            indeterminate
            size="50px"
            :thickness="0.2"
            color="primary"
            track-color="grey-3"
          />
          <q-icon
            v-else
            :name="statusIcon"
            :color="connectionStatusColor"
            size="50px"
          />
        </div>
      </div>

      <q-separator class="q-my-md" />

      <!-- Connection Details -->
      <div v-if="config.data?.source" class="q-mb-md">
        <div class="text-subtitle2 text-grey-7 q-mb-xs">Source</div>
        <div class="text-body1">{{ sourceDescription }}</div>
      </div>

      <!-- Quick Stats -->
      <div v-if="formattedStatistics" class="row q-col-gutter-sm">
        <div class="col-6">
          <div class="text-caption text-grey-7">Messages</div>
          <div class="text-body2 text-weight-medium">
            {{ formattedStatistics.messagesReceived.toLocaleString() }}
          </div>
        </div>
        <div class="col-6">
          <div class="text-caption text-grey-7">Data Rate</div>
          <div class="text-body2 text-weight-medium">
            {{ formattedStatistics.formattedDataRate }}
          </div>
        </div>
        <div class="col-6">
          <div class="text-caption text-grey-7">Uptime</div>
          <div class="text-body2 text-weight-medium">
            {{ formattedStatistics.formattedUptime }}
          </div>
        </div>
        <div class="col-6">
          <div class="text-caption text-grey-7">Quality</div>
          <div class="text-body2 text-weight-medium">
            <q-chip 
              :color="qualityColor" 
              text-color="white" 
              size="sm"
              dense
            >
              {{ connectionQuality }}
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="q-mt-md">
        <q-btn
          v-if="!isActive"
          label="Connect"
          color="primary"
          :loading="isStarting"
          :disable="!canStart"
          @click="handleConnect"
          class="full-width"
        />
        <q-btn
          v-else
          label="Disconnect"
          color="negative"
          :loading="isStopping"
          :disable="!canStop"
          @click="handleDisconnect"
          class="full-width"
        />
      </div>
    </q-card-section>

    <!-- Data Activity Indicator -->
    <q-linear-progress
      v-if="isConnected && hasRecentData"
      indeterminate
      color="positive"
      size="2px"
      class="absolute-bottom"
    />
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'

const $q = useQuasar()
const {
  config,
  isActive,
  isConnected,
  isConnecting,
  isStarting,
  isStopping,
  canStart,
  canStop,
  hasRecentData,
  connectionStatusText,
  connectionStatusColor,
  formattedStatistics,
  connectionQuality,
  stopRTCM
} = useRTCM()

const statusIcon = computed(() => {
  if (isConnected.value) return 'mdi-check-circle'
  if (connectionStatusColor.value === 'negative') return 'mdi-alert-circle'
  if (isActive.value) return 'mdi-satellite-variant'
  return 'mdi-satellite-variant'
})

const qualityColor = computed(() => {
  switch (connectionQuality.value) {
    case 'good': return 'positive'
    case 'fair': return 'warning'
    case 'poor': return 'negative'
    case 'no-data': return 'grey'
    default: return 'grey'
  }
})

const sourceDescription = computed(() => {
  const source = config.value.data?.source
  if (!source) return 'Not configured'
  
  switch (source.type) {
    case 'ntrip':
      return `NTRIP: ${source.host}:${source.port}${source.mountpoint ? '/' + source.mountpoint : ''}`
    case 'tcp':
      return `TCP: ${source.host}:${source.port}`
    case 'udp':
      return `UDP: Port ${source.port}`
    default:
      return source.type
  }
})

function handleConnect() {
  // This will be handled by the connection form
  $q.notify({
    type: 'info',
    message: 'Use the connection form to start RTCM',
    position: 'top'
  })
}

async function handleDisconnect() {
  try {
    await stopRTCM()
    $q.notify({
      type: 'positive',
      message: 'RTCM disconnected successfully',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to disconnect RTCM',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}
</script>

<style scoped>
.rtcm-status-card {
  min-height: 320px;
}
</style>