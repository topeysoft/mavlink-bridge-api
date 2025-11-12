# Stage 2: Connection & Device Management
> **Status**: ✅ Complete | **Updated**: 2025-09-02

## Objective
Implement device discovery, connection management, and real-time connection monitoring. Create intuitive interfaces for discovering YardRover devices on the network, managing saved devices, and maintaining stable connections with automatic reconnection.

## Prerequisites
- Completed Stage 1 (Project Setup & Core Infrastructure)
- API client service configured
- Basic layout and routing in place

## Features to Implement

### 1. Device Discovery
- mDNS/Bonjour device discovery
- Manual IP connection
- Network scanning for devices
- Discovery progress indication
- Device information display

### 2. Connection Management
- Connect/disconnect functionality
- Automatic reconnection
- Connection status monitoring
- Connection history
- Multiple device support

### 3. Saved Devices
- Save frequently used devices
- Quick connect from saved list
- Device nicknames
- Device information caching
- Import/export device list

## Component Structure

```
src/components/connection/
├── DeviceDiscovery.vue         # Discovery interface
├── DeviceCard.vue              # Device display card
├── ConnectionDialog.vue        # Connection modal
├── ManualConnectionForm.vue    # Manual IP entry
├── SavedDevicesList.vue        # Saved devices
├── ConnectionStatus.vue        # Status display
└── ConnectionHistory.vue       # Connection logs

src/pages/
└── ConnectionPage.vue          # Main connection page

src/stores/
├── connection.ts               # Connection state
└── devices.ts                  # Device management
```

## Implementation

### Connection Store (stores/connection.ts)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  currentDevice: MAVLinkBridgeDevice | null;
  connectionUrl: string | null;
  lastConnected: Date | null;
  errorMessage: string | null;
  signalStrength: number;
  latency: number;
}

export const useConnectionStore = defineStore('connection', () => {
  // State
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const currentDevice = ref<MAVLinkBridgeDevice | null>(null);
  const connectionUrl = ref<string | null>(null);
  const lastConnected = ref<Date | null>(null);
  const errorMessage = ref<string | null>(null);
  const signalStrength = ref(0);
  const latency = ref(0);
  const autoReconnect = ref(true);
  const reconnectAttempts = ref(0);
  
  // Getters
  const connectionStatus = computed(() => {
    if (isConnecting.value) return 'connecting';
    if (isConnected.value) return 'connected';
    if (errorMessage.value) return 'error';
    return 'disconnected';
  });
  
  const connectionQuality = computed(() => {
    if (!isConnected.value) return 'none';
    if (signalStrength.value > -50) return 'excellent';
    if (signalStrength.value > -60) return 'good';
    if (signalStrength.value > -70) return 'fair';
    return 'poor';
  });
  
  // Actions
  async function connect(url: string, device?: MAVLinkBridgeDevice) {
    try {
      isConnecting.value = true;
      errorMessage.value = null;
      
      await apiClient.connect(url);
      
      isConnected.value = true;
      connectionUrl.value = url;
      currentDevice.value = device || null;
      lastConnected.value = new Date();
      reconnectAttempts.value = 0;
      
      // Start monitoring connection health
      startHealthMonitoring();
    } catch (error) {
      errorMessage.value = error.message;
      throw error;
    } finally {
      isConnecting.value = false;
    }
  }
  
  async function disconnect() {
    apiClient.disconnect();
    
    isConnected.value = false;
    isConnecting.value = false;
    currentDevice.value = null;
    connectionUrl.value = null;
    signalStrength.value = 0;
    latency.value = 0;
    
    stopHealthMonitoring();
  }
  
  async function reconnect() {
    if (!connectionUrl.value || !autoReconnect.value) return;
    
    reconnectAttempts.value++;
    
    try {
      await connect(connectionUrl.value, currentDevice.value);
    } catch (error) {
      if (reconnectAttempts.value < 5) {
        setTimeout(() => reconnect(), 2000 * reconnectAttempts.value);
      } else {
        errorMessage.value = 'Maximum reconnection attempts reached';
        autoReconnect.value = false;
      }
    }
  }
  
  let healthInterval: NodeJS.Timeout | null = null;
  
  function startHealthMonitoring() {
    stopHealthMonitoring();
    
    healthInterval = setInterval(async () => {
      if (!isConnected.value) return;
      
      try {
        const startTime = Date.now();
        const health = await apiClient.getClient().getHealth();
        latency.value = Date.now() - startTime;
        
        if (health.network?.wifi?.rssi) {
          signalStrength.value = health.network.wifi.rssi;
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 5000);
  }
  
  function stopHealthMonitoring() {
    if (healthInterval) {
      clearInterval(healthInterval);
      healthInterval = null;
    }
  }
  
  return {
    // State
    isConnected,
    isConnecting,
    currentDevice,
    connectionUrl,
    lastConnected,
    errorMessage,
    signalStrength,
    latency,
    autoReconnect,
    reconnectAttempts,
    
    // Getters
    connectionStatus,
    connectionQuality,
    
    // Actions
    connect,
    disconnect,
    reconnect
  };
});
```

### Device Store (stores/devices.ts)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { LocalStorage } from 'quasar';

export interface SavedDevice extends MAVLinkBridgeDevice {
  nickname?: string;
  lastSeen: Date;
  favorite: boolean;
}

export const useDevicesStore = defineStore('devices', () => {
  // State
  const discoveredDevices = ref<MAVLinkBridgeDevice[]>([]);
  const savedDevices = ref<SavedDevice[]>([]);
  const isDiscovering = ref(false);
  const discoveryProgress = ref(0);
  
  // Load saved devices from storage
  const stored = LocalStorage.getItem('savedDevices');
  if (stored) {
    savedDevices.value = stored as SavedDevice[];
  }
  
  // Getters
  const favoriteDevices = computed(() => 
    savedDevices.value.filter(d => d.favorite)
  );
  
  const recentDevices = computed(() => 
    [...savedDevices.value].sort((a, b) => 
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    ).slice(0, 5)
  );
  
  // Actions
  async function discoverDevices(timeout = 5000) {
    try {
      isDiscovering.value = true;
      discoveryProgress.value = 0;
      discoveredDevices.value = [];
      
      const { discoverMAVLinkBridgeDevices } = await import('@mavlinkbridge/api-client');
      
      const progressInterval = setInterval(() => {
        discoveryProgress.value = Math.min(
          discoveryProgress.value + (100 / (timeout / 100)),
          99
        );
      }, 100);
      
      const result = await discoverMAVLinkBridgeDevices({ timeout });
      
      clearInterval(progressInterval);
      discoveryProgress.value = 100;
      
      discoveredDevices.value = result.devices;
      
      // Update last seen for any saved devices found
      result.devices.forEach(device => {
        const saved = savedDevices.value.find(s => s.ip === device.ip);
        if (saved) {
          saved.lastSeen = new Date();
        }
      });
      
      persistSavedDevices();
      
      return result.devices;
    } finally {
      isDiscovering.value = false;
      setTimeout(() => {
        discoveryProgress.value = 0;
      }, 1000);
    }
  }
  
  function saveDevice(device: MAVLinkBridgeDevice, nickname?: string) {
    const existing = savedDevices.value.find(d => d.ip === device.ip);
    
    if (existing) {
      existing.nickname = nickname || existing.nickname;
      existing.lastSeen = new Date();
    } else {
      savedDevices.value.push({
        ...device,
        nickname,
        lastSeen: new Date(),
        favorite: false
      });
    }
    
    persistSavedDevices();
  }
  
  function removeDevice(ip: string) {
    const index = savedDevices.value.findIndex(d => d.ip === ip);
    if (index >= 0) {
      savedDevices.value.splice(index, 1);
      persistSavedDevices();
    }
  }
  
  function toggleFavorite(ip: string) {
    const device = savedDevices.value.find(d => d.ip === ip);
    if (device) {
      device.favorite = !device.favorite;
      persistSavedDevices();
    }
  }
  
  function updateNickname(ip: string, nickname: string) {
    const device = savedDevices.value.find(d => d.ip === ip);
    if (device) {
      device.nickname = nickname;
      persistSavedDevices();
    }
  }
  
  function persistSavedDevices() {
    LocalStorage.set('savedDevices', savedDevices.value);
  }
  
  function exportDevices() {
    const data = JSON.stringify(savedDevices.value, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yardrover-devices.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  async function importDevices(file: File) {
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as SavedDevice[];
      
      // Merge with existing devices
      imported.forEach(device => {
        const existing = savedDevices.value.find(d => d.ip === device.ip);
        if (!existing) {
          savedDevices.value.push(device);
        }
      });
      
      persistSavedDevices();
    } catch (error) {
      throw new Error('Invalid device file format');
    }
  }
  
  return {
    // State
    discoveredDevices,
    savedDevices,
    isDiscovering,
    discoveryProgress,
    
    // Getters
    favoriteDevices,
    recentDevices,
    
    // Actions
    discoverDevices,
    saveDevice,
    removeDevice,
    toggleFavorite,
    updateNickname,
    exportDevices,
    importDevices
  };
});
```

### Connection Page (pages/ConnectionPage.vue)

```vue
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
        message: `Discovery failed: ${error.message}`
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
      message: `Connection failed: ${error.message}`
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
      message: `Connection failed: ${error.message}`
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
```

### Device Card Component (components/connection/DeviceCard.vue)

```vue
<template>
  <q-card class="device-card" :class="{ 'device-card--connected': isConnected }">
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon 
          name="router" 
          size="32px" 
          :color="isConnected ? 'positive' : 'primary'"
        />
        <div class="col">
          <div class="text-h6">{{ device.name || 'YardRover' }}</div>
          <div class="text-caption text-grey-7">{{ device.ip }}</div>
        </div>
        <q-chip
          v-if="device.version"
          dense
          color="grey-3"
          text-color="grey-8"
          size="sm"
        >
          v{{ device.version }}
        </q-chip>
      </div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="q-pt-sm">
      <div class="device-info">
        <div class="info-item">
          <q-icon name="memory" size="xs" color="grey-6" />
          <span>{{ device.chipModel || 'ESP32' }}</span>
        </div>
        <div v-if="device.hostname" class="info-item">
          <q-icon name="badge" size="xs" color="grey-6" />
          <span>{{ device.hostname }}</span>
        </div>
        <div v-if="device.macAddress" class="info-item">
          <q-icon name="fingerprint" size="xs" color="grey-6" />
          <span>{{ formatMacAddress(device.macAddress) }}</span>
        </div>
      </div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-actions>
      <q-btn
        v-if="!isConnected"
        flat
        color="primary"
        icon="link"
        label="Connect"
        @click="$emit('connect', device)"
        class="full-width"
      />
      <q-btn
        v-else
        flat
        color="positive"
        icon="check_circle"
        label="Connected"
        disable
        class="full-width"
      />
      
      <q-space />
      
      <q-btn
        v-if="!isSaved"
        flat
        round
        dense
        icon="bookmark_border"
        color="grey-7"
        @click="$emit('save', device)"
      >
        <q-tooltip>Save device</q-tooltip>
      </q-btn>
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { useConnectionStore } from '@/stores/connection';
import { useDevicesStore } from '@/stores/devices';

const props = defineProps<{
  device: MAVLinkBridgeDevice;
}>();

const emit = defineEmits<{
  connect: [device: MAVLinkBridgeDevice];
  save: [device: MAVLinkBridgeDevice];
}>();

const connectionStore = useConnectionStore();
const devicesStore = useDevicesStore();

const isConnected = computed(() => 
  connectionStore.isConnected && 
  connectionStore.currentDevice?.ip === props.device.ip
);

const isSaved = computed(() => 
  devicesStore.savedDevices.some(d => d.ip === props.device.ip)
);

function formatMacAddress(mac: string): string {
  return mac.replace(/(.{2})(?=.)/g, '$1:').toUpperCase();
}
</script>

<style lang="scss" scoped>
.device-card {
  transition: all 0.3s ease;
  height: 100%;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &--connected {
    border: 2px solid $positive;
  }
}

.device-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.875rem;
  color: $text-secondary;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .q-icon {
    opacity: 0.7;
  }
}
</style>
```

### Connection Status Component (components/connection/ConnectionStatus.vue)

```vue
<template>
  <q-card class="connection-status" :class="`status--${connectionStore.connectionStatus}`">
    <q-card-section>
      <div class="row items-center q-gutter-md">
        <!-- Status Icon -->
        <div class="status-icon">
          <q-spinner-rings
            v-if="connectionStore.isConnecting"
            color="primary"
            size="48px"
          />
          <q-icon
            v-else
            :name="statusIcon"
            :color="statusColor"
            size="48px"
          />
        </div>
        
        <!-- Status Info -->
        <div class="col">
          <div class="text-h6">{{ statusTitle }}</div>
          <div class="text-body2 text-grey-7">{{ statusMessage }}</div>
          
          <!-- Connection Details -->
          <div v-if="connectionStore.isConnected" class="q-mt-sm">
            <q-chip
              dense
              color="grey-3"
              text-color="grey-8"
              icon="wifi"
              size="sm"
            >
              {{ connectionStore.signalStrength }} dBm
            </q-chip>
            <q-chip
              dense
              color="grey-3"
              text-color="grey-8"
              icon="speed"
              size="sm"
              class="q-ml-sm"
            >
              {{ connectionStore.latency }} ms
            </q-chip>
          </div>
        </div>
        
        <!-- Connection Quality -->
        <div v-if="connectionStore.isConnected" class="text-center">
          <q-circular-progress
            :value="signalQuality"
            size="60px"
            :thickness="0.2"
            :color="qualityColor"
            track-color="grey-3"
            show-value
          />
          <div class="text-caption text-grey-7 q-mt-xs">Signal Quality</div>
        </div>
      </div>
      
      <!-- Error Message -->
      <q-banner
        v-if="connectionStore.errorMessage"
        class="bg-negative text-white q-mt-md"
        rounded
        dense
      >
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ connectionStore.errorMessage }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnectionStore } from '@/stores/connection';

const connectionStore = useConnectionStore();

const statusIcon = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': return 'check_circle';
    case 'connecting': return 'pending';
    case 'error': return 'error';
    default: return 'link_off';
  }
});

const statusColor = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': return 'positive';
    case 'connecting': return 'primary';
    case 'error': return 'negative';
    default: return 'grey-6';
  }
});

const statusTitle = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': 
      return `Connected to ${connectionStore.currentDevice?.name || 'YardRover'}`;
    case 'connecting': 
      return 'Connecting...';
    case 'error': 
      return 'Connection Error';
    default: 
      return 'Not Connected';
  }
});

const statusMessage = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': 
      return `Connected via ${connectionStore.connectionUrl}`;
    case 'connecting': 
      return 'Establishing connection to device...';
    case 'error': 
      return 'Failed to connect to device';
    default: 
      return 'Connect to a YardRover device to get started';
  }
});

const signalQuality = computed(() => {
  const rssi = connectionStore.signalStrength;
  if (rssi >= -50) return 100;
  if (rssi >= -60) return 80;
  if (rssi >= -70) return 60;
  if (rssi >= -80) return 40;
  return 20;
});

const qualityColor = computed(() => {
  const quality = signalQuality.value;
  if (quality >= 80) return 'positive';
  if (quality >= 60) return 'warning';
  return 'negative';
});
</script>

<style lang="scss" scoped>
.connection-status {
  &.status--connected {
    border-left: 4px solid $positive;
  }
  
  &.status--connecting {
    border-left: 4px solid $primary;
  }
  
  &.status--error {
    border-left: 4px solid $negative;
  }
  
  &.status--disconnected {
    border-left: 4px solid $grey-6;
  }
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: rgba($primary, 0.1);
}
</style>
```

### Connection Indicator Component (components/common/ConnectionIndicator.vue)

```vue
<template>
  <div class="connection-indicator">
    <q-btn
      flat
      dense
      round
      :icon="connectionIcon"
      :color="connectionColor"
      @click="showDetails = true"
    >
      <q-tooltip>
        {{ tooltipText }}
      </q-tooltip>
    </q-btn>
    
    <!-- Connection Details Popup -->
    <q-dialog v-model="showDetails">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Connection Details</div>
        </q-card-section>
        
        <q-separator />
        
        <q-card-section>
          <q-list>
            <q-item>
              <q-item-section avatar>
                <q-icon name="router" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Device</q-item-label>
                <q-item-label caption>
                  {{ deviceName }}
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="link" />
              </q-item-section>
              <q-item-section>
                <q-item-label>URL</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.connectionUrl }}
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="wifi" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Signal Strength</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.signalStrength }} dBm
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="speed" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Latency</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.latency }} ms
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        
        <q-separator />
        
        <q-card-actions align="right">
          <q-btn
            v-if="!connectionStore.isConnected"
            flat
            color="primary"
            label="Connect"
            @click="goToConnection"
          />
          <q-btn
            v-else
            flat
            color="negative"
            label="Disconnect"
            @click="disconnect"
          />
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useConnectionStore } from '@/stores/connection';

const router = useRouter();
const connectionStore = useConnectionStore();

const showDetails = ref(false);

const connectionIcon = computed(() => {
  if (connectionStore.isConnecting) return 'pending';
  if (connectionStore.isConnected) {
    switch (connectionStore.connectionQuality) {
      case 'excellent': return 'signal_wifi_4_bar';
      case 'good': return 'signal_wifi_4_bar';
      case 'fair': return 'network_wifi_2_bar';
      case 'poor': return 'network_wifi_1_bar';
      default: return 'signal_wifi_0_bar';
    }
  }
  return 'signal_wifi_off';
});

const connectionColor = computed(() => {
  if (connectionStore.isConnecting) return 'warning';
  if (connectionStore.isConnected) return 'positive';
  return 'grey-6';
});

const deviceName = computed(() => {
  if (connectionStore.currentDevice?.name) {
    return connectionStore.currentDevice.name;
  }
  if (connectionStore.currentDevice?.ip) {
    return connectionStore.currentDevice.ip;
  }
  return 'Not connected';
});

const tooltipText = computed(() => {
  if (connectionStore.isConnecting) return 'Connecting...';
  if (connectionStore.isConnected) {
    return `Connected to ${deviceName.value}`;
  }
  return 'Not connected';
});

function goToConnection() {
  showDetails.value = false;
  router.push('/connection');
}

function disconnect() {
  connectionStore.disconnect();
  showDetails.value = false;
}
</script>

<style lang="scss" scoped>
.connection-indicator {
  display: flex;
  align-items: center;
}
</style>
```

## Testing Guidelines

### Unit Tests
- Test connection store actions and state management
- Test device discovery and filtering
- Test saved devices persistence
- Test connection retry logic

### Integration Tests
- Test actual device discovery (with mock devices)
- Test connection establishment and error handling
- Test WebSocket event handling
- Test auto-reconnection scenarios

### E2E Tests
- Test complete connection flow
- Test manual connection input
- Test device saving and management
- Test connection status updates

## Accessibility Requirements
- Keyboard navigation for all interactive elements
- Screen reader support for connection status
- Clear focus indicators
- Proper ARIA labels and roles
- Status announcements for screen readers

## Performance Considerations
- Debounce discovery requests
- Cache device information
- Lazy load saved devices list
- Optimize re-render on connection status changes
- Use virtual scrolling for large device lists

## Security Considerations
- Validate IP addresses before connection
- Sanitize device names and nicknames
- Implement connection timeout
- Clear sensitive data on disconnect
- Validate imported device files

## Next Steps
After completing this stage, proceed to Stage 3: Dashboard & Status Monitoring to create the main dashboard interface.