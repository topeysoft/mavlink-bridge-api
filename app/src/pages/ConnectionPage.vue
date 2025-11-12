<template>
  <q-page class="connection-page">
    <div class="q-pa-md">
      <!-- Page Header -->
      <div class="page-header q-mb-lg">
        <h1 class="text-h4 text-primary q-mb-sm">Device Connection</h1>
        <p class="text-body1 text-grey-7">
          Connect to your YardRover device to start managing tasks
        </p>
      </div>
      
      <!-- Connection Status Card -->
      <ConnectionStatus class="q-mb-lg" />
      
      <!-- Quick Actions -->
      <div class="row q-gutter-md q-mb-lg">
        <q-btn
          v-if="!connectionStore.isConnected"
          unelevated
          color="primary"
          icon="search"
          label="Discover Devices"
          @click="startDiscovery"
          :loading="devicesStore.isDiscovering"
          class="col-12 col-sm-auto"
        />
        
        <q-btn
          v-if="!connectionStore.isConnected"
          outline
          color="primary"
          icon="add_circle"
          label="Manual Connection"
          @click="showManualConnection = true"
          class="col-12 col-sm-auto"
        />
        
        <q-btn
          v-if="connectionStore.isConnected"
          outline
          color="negative"
          icon="link_off"
          label="Disconnect"
          @click="disconnect"
          class="col-12 col-sm-auto"
        />
      </div>
      
      <!-- Device Lists -->
      <q-tabs
        v-model="activeTab"
        class="text-primary"
        active-color="primary"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="discovered" label="Discovered" icon="radar" />
        <q-tab name="saved" label="Saved" icon="bookmark" />
        <q-tab name="recent" label="Recent" icon="history" />
      </q-tabs>
      
      <q-separator />
      
      <q-tab-panels v-model="activeTab" animated>
        <!-- Discovered Devices -->
        <q-tab-panel name="discovered">
          <div v-if="devicesStore.isDiscovering" class="text-center q-py-xl">
            <q-circular-progress
              :value="devicesStore.discoveryProgress"
              size="120px"
              :thickness="0.2"
              color="primary"
              track-color="grey-3"
              class="q-mb-md"
            >
              <div class="text-h6">{{ devicesStore.discoveryProgress }}%</div>
            </q-circular-progress>
            <p class="text-body1 text-grey-7">
              Searching for YardRover devices...
            </p>
          </div>
          
          <div
            v-else-if="devicesStore.discoveredDevices.length === 0"
            class="text-center q-py-xl"
          >
            <q-icon name="wifi_find" size="64px" color="grey-5" class="q-mb-md" />
            <p class="text-body1 text-grey-7">
              No devices discovered. Click "Discover Devices" to search.
            </p>
          </div>
          
          <div v-else class="row q-gutter-md">
            <div
              v-for="device in devicesStore.discoveredDevices"
              :key="device.ip"
              class="col-12 col-sm-6 col-md-4"
            >
              <DeviceCard
                :device="device"
                @connect="connectToDevice(device)"
                @save="saveDevice(device)"
              />
            </div>
          </div>
        </q-tab-panel>
        
        <!-- Saved Devices -->
        <q-tab-panel name="saved">
          <SavedDevicesList
            :devices="devicesStore.savedDevices"
            @connect="connectToDevice"
            @remove="devicesStore.removeDevice"
            @toggle-favorite="devicesStore.toggleFavorite"
            @update-nickname="devicesStore.updateNickname"
          />
        </q-tab-panel>
        
        <!-- Recent Devices -->
        <q-tab-panel name="recent">
          <SavedDevicesList
            :devices="devicesStore.recentDevices"
            @connect="connectToDevice"
            hide-actions
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>
    
    <!-- Manual Connection Dialog -->
    <q-dialog v-model="showManualConnection">
      <ConnectionDialog @connect="handleManualConnection" />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useConnectionStore } from '@/stores/connection';
import { useDevicesStore } from '@/stores/devices';
import ConnectionStatus from '@/components/connection/ConnectionStatus.vue';
import DeviceCard from '@/components/connection/DeviceCard.vue';
import SavedDevicesList from '@/components/connection/SavedDevicesList.vue';
import ConnectionDialog from '@/components/connection/ConnectionDialog.vue';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';

const $q = useQuasar();
const router = useRouter();
const connectionStore = useConnectionStore();
const devicesStore = useDevicesStore();

const activeTab = ref('discovered');
const showManualConnection = ref(false);

async function startDiscovery() {
  try {
    await devicesStore.discoverDevices(10000);
    
    if (devicesStore.discoveredDevices.length === 0) {
      $q.notify({
        type: 'info',
        message: 'No devices found. Make sure your YardRover is powered on and connected to the same network.'
      });
    }
  } catch (error) {
    $q.notify({
        type: 'negative',
        message: `Discovery failed: ${(error as Error).message}`
      });
  }
}

async function connectToDevice(device: MAVLinkBridgeDevice) {
  try {
    const url = `http://${device.ip}`;
    await connectionStore.connect(url, device);
    
    // Save device for future use
    devicesStore.saveDevice(device);
    
    // Navigate to dashboard
    router.push('/');
    
    $q.notify({
      type: 'positive',
      message: `Connected to ${device.name || device.ip}`
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Connection failed: ${(error as Error).message}`
    });
  }
}

async function disconnect() {
  connectionStore.disconnect();
  
  $q.notify({
    type: 'info',
    message: 'Disconnected from device'
  });
}

function saveDevice(device: MAVLinkBridgeDevice) {
  $q.dialog({
    title: 'Save Device',
    message: 'Enter a nickname for this device (optional)',
    prompt: {
      model: '',
      type: 'text',
      placeholder: device.name || 'YardRover'
    },
    cancel: true
  }).onOk((nickname) => {
    devicesStore.saveDevice(device, nickname || undefined);
    
    $q.notify({
      type: 'positive',
      message: 'Device saved'
    });
  });
}

async function handleManualConnection(url: string) {
  showManualConnection.value = false;
  
  try {
    await connectionStore.connect(url);
    
    // Navigate to dashboard
    router.push('/');
    
    $q.notify({
      type: 'positive',
      message: 'Connected successfully'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Connection failed: ${(error as Error).message}`
    });
  }
}

onMounted(() => {
  // Auto-discover on page load if not connected
  if (!connectionStore.isConnected) {
    startDiscovery();
  }
});
</script>

<style lang="scss" scoped>
.connection-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  h1 {
    font-weight: 300;
    margin: 0;
  }
}
</style>