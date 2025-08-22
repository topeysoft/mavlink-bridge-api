<template>
  <div class="connection-page">
    <div class="connection-content">
      <!-- Header with fade-in animation -->
      <div 
        class="connection-header"
        :class="{ 'fade-in': !isPageLoading }"
      >
        <q-icon
          name="mdi-robot-mower"
          size="80px"
          color="primary"
          class="q-mb-md"
        />
        
        <h4 class="text-h4 q-mb-sm">YardRover Control</h4>
        <p class="text-subtitle1 text-grey-7 q-mb-lg">
          Connect to your YardRover device to get started
        </p>

        <!-- Quick Reconnect Button -->
        <q-btn
          v-if="lastDevice && !isPageLoading"
          :label="`Reconnect to ${lastDevice.name}`"
          color="primary"
          size="lg"
          class="full-width q-mb-xl"
          icon="mdi-history"
          @click="reconnectLast"
        />
      </div>

      <!-- Connection Methods Card -->
      <div v-if="isPageLoading" class="connection-methods-card-skeleton">
        <q-card>
          <q-skeleton type="rect" height="48px" />
          <q-separator />
          <q-card-section>
            <div class="text-center q-py-xl">
              <q-spinner-dots color="primary" size="40px" />
              <div class="text-caption text-grey-7 q-mt-md">
                Loading connection options...
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <q-card 
        v-else
        class="connection-methods-card fade-in-delayed"
      >
        <q-tabs
          v-model="activeTab"
          dense
          active-color="primary"
          indicator-color="primary"
          align="left"
          class="q-mb-md"
        >
          <q-tab name="discover" label="Discover" icon="mdi-radar" />
          <q-tab name="manual" label="Manual" icon="mdi-keyboard" />
          <q-tab name="saved" label="Saved" icon="mdi-history" />
        </q-tabs>

        <q-separator />

        <q-card-section>
          <q-tab-panels v-model="activeTab" animated>
            <q-tab-panel name="discover" class="q-pa-none">
              <DeviceScanning
                :is-connecting="isConnecting"
                :connection-error="connectionError"
                @connect="handleConnect"
                @clear-error="connectionError = null"
              />
            </q-tab-panel>

            <q-tab-panel name="manual" class="q-pa-none">
              <ManualConnection
                :is-connecting="isConnecting"
                @connect="handleConnect"
              />
            </q-tab-panel>

            <q-tab-panel name="saved" class="q-pa-none">
              <SavedDevices
                :is-connecting="isConnecting"
                @connect="handleConnect"
              />
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>
      </q-card>

      <div 
        v-if="!isPageLoading"
        class="q-mt-lg text-caption text-grey-6 text-center fade-in-delayed"
      >
        <p>Make sure your device is powered on and connected to the same network.</p>
        <p>Default AP Mode: Connect to "YardRover-AP" WiFi</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { useConnectionManager } from '../composables/useConnectionManager'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import { deviceDiscovery } from '../services/DeviceDiscovery'
import DeviceScanning from '../components/connection/DeviceScanning.vue'
import ManualConnection from '../components/connection/ManualConnection.vue'
import SavedDevices from '../components/connection/SavedDevices.vue'
import type { DiscoveredDevice } from '../services/DeviceDiscovery'

const router = useRouter()
const { lastConnectedDevice, connectToDevice } = useConnectionManager()
const { isConnected } = useMAVLinkClient()

const activeTab = ref('discover')
const isConnecting = ref(false)
const connectionError = ref<string | null>(null)
const isPageLoading = ref(true)

const lastDevice = computed(() => lastConnectedDevice.value)

async function handleConnect(device: DiscoveredDevice) {
  if (isConnecting.value) return
  
  isConnecting.value = true
  connectionError.value = null
  
  try {
    await connectToDevice(device)
    
    Notify.create({
      type: 'positive',
      message: `Connected to ${device.name}`,
      position: 'top'
    })
    
    // Navigate to dashboard on successful connection
    void router.replace('/')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection failed'
    connectionError.value = errorMessage
    
    Notify.create({
      type: 'negative',
      message: 'Failed to connect to device',
      caption: errorMessage,
      position: 'top'
    })
    
    console.error('Connection failed:', error)
  } finally {
    isConnecting.value = false
  }
}

async function reconnectLast() {
  if (lastDevice.value) {
    await handleConnect(lastDevice.value)
  }
}

onMounted(async () => {
  // Redirect if already connected
  if (isConnected.value) {
    void router.replace('/')
    return
  }
  
  // Progressive loading: show header first, then card
  await new Promise(resolve => setTimeout(resolve, 500))
  isPageLoading.value = false
})

onUnmounted(() => {
  // Always stop discovery when page unmounts
  deviceDiscovery.stopDiscovery()
})
</script>

<style lang="scss" scoped>
.connection-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--q-color-page-background, #f5f5f5);
}

.connection-content {
  width: 100%;
  max-width: 800px;
}

.connection-header {
  text-align: center;
  margin-bottom: 2rem;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease-out;
  
  &.fade-in {
    opacity: 1;
    transform: translateY(0);
  }
}

.connection-methods-card,
.connection-methods-card-skeleton {
  width: 100%;
}

.fade-in-delayed {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.6s ease-out 0.3s both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.connection-methods-card-skeleton {
  .q-card {
    min-height: 300px;
  }
}

@media (max-width: 599px) {
  .connection-content {
    max-width: 100%;
  }
  
  .connection-page {
    padding: 8px;
  }
}
</style>