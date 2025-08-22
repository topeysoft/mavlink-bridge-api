<template>
  <div class="device-scanning">
    <!-- Connection Status Banner -->
    <q-banner v-if="isConnecting" class="bg-blue-1 q-mb-md">
      <template v-slot:avatar>
        <q-spinner-hourglass color="primary" size="24px" />
      </template>
      Connecting to device...
    </q-banner>

    <q-banner v-if="connectionError" class="bg-negative text-white q-mb-md">
      <template v-slot:avatar>
        <q-icon name="error" />
      </template>
      <div>{{ connectionError }}</div>
      <template v-slot:action>
        <q-btn flat color="white" label="Dismiss" @click="$emit('clearError')" />
      </template>
    </q-banner>

    <!-- Component Loading State -->
    <div v-if="isInitializing" class="text-center q-py-lg">
      <q-spinner-dots color="primary" size="40px" />
      <div class="text-caption text-grey-7 q-mt-md">
        Initializing device discovery...
      </div>
    </div>

    <div v-else>
      <div class="q-mb-md row items-center">
        <div class="col">
          <div class="text-h6">Nearby Devices</div>
          <div class="text-caption text-grey-7">
            {{ scanStatusText }}
          </div>
        </div>
        <div class="col-auto q-gutter-sm">
          <q-btn
            :label="isScanning ? 'Stop' : 'Scan'"
            :loading="isScanning"
            :color="isScanning ? 'negative' : 'primary'"
            :icon="isScanning ? 'stop' : 'mdi-radar'"
            :disable="isConnecting"
            @click="toggleScan"
          />
          <q-btn
            v-if="discoveredDevices.length > 0"
            flat
            dense
            round
            icon="refresh"
            @click="refreshScan"
            :disable="isScanning || isConnecting"
          >
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Device List with Skeleton Loading -->
      <div v-if="isLoadingDevices">
        <q-list separator>
          <q-skeleton-item 
            v-for="n in 3" 
            :key="n"
            class="q-pa-md"
          >
            <div class="row items-center">
              <q-skeleton type="QAvatar" size="40px" class="q-mr-md" />
              <div class="col">
                <q-skeleton type="text" width="60%" />
                <q-skeleton type="text" width="40%" />
              </div>
              <q-skeleton type="QBtn" />
            </div>
          </q-skeleton-item>
        </q-list>
      </div>

      <q-list separator v-else-if="discoveredDevices.length > 0">
        <DeviceListItem
          v-for="device in discoveredDevices"
          :key="device.ip"
          :device="device"
          :disable="isConnecting"
          @connect="$emit('connect', device)"
        />
      </q-list>

      <q-banner v-else-if="isScanning" class="bg-blue-1">
        <template v-slot:avatar>
          <q-spinner-radar color="primary" size="32px" />
        </template>
        Searching for devices...
      </q-banner>

      <q-banner v-else class="bg-grey-2">
        <template v-slot:avatar>
          <q-icon name="mdi-wifi-off" />
        </template>
        No devices found. Make sure your device is powered on and connected to the same network.
      </q-banner>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { deviceDiscovery } from '../../services/DeviceDiscovery'
import DeviceListItem from './DeviceListItem.vue'
import type { DiscoveredDevice } from '../../services/DeviceDiscovery'

interface Props {
  isConnecting: boolean
  connectionError: string | null
}

defineProps<Props>()

defineEmits<{
  connect: [device: DiscoveredDevice]
  clearError: []
}>()

const isInitializing = ref(true)
const isLoadingDevices = ref(false)

const isScanning = computed(() => deviceDiscovery.scanning)
const discoveredDevices = computed(() => deviceDiscovery.getDevices())

const scanStatusText = computed(() => {
  if (isScanning.value) {
    return `Scanning for devices... Found ${discoveredDevices.value.length}`
  }
  if (discoveredDevices.value.length > 0) {
    return `Found ${discoveredDevices.value.length} device${discoveredDevices.value.length > 1 ? 's' : ''}`
  }
  return 'Click "Scan" to search for YardRover devices on your network'
})

async function toggleScan() {
  if (isScanning.value) {
    deviceDiscovery.stopDiscovery()
  } else {
    isLoadingDevices.value = true
    try {
      await deviceDiscovery.startDiscovery()
      // Show skeleton for a minimum time to indicate something is happening
      setTimeout(() => {
        isLoadingDevices.value = false
      }, 1500)
    } catch (error) {
      isLoadingDevices.value = false
      console.error('Failed to start discovery:', error)
    }
  }
}

function refreshScan() {
  if (!isScanning.value) {
    isLoadingDevices.value = true
    void deviceDiscovery.refreshScan().finally(() => {
      setTimeout(() => {
        isLoadingDevices.value = false
      }, 1000)
    })
  }
}

onMounted(async () => {
  // Simulate component initialization time
  await new Promise(resolve => setTimeout(resolve, 800))
  isInitializing.value = false
})
</script>