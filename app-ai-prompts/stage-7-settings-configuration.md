# Stage 7: Settings & Configuration

## Objective
Build comprehensive settings and configuration interfaces for device management, parameter tuning, network setup, user preferences, and system maintenance. Provide both novice-friendly presets and advanced configuration options.

## Prerequisites
- Completed Stages 1-6
- Task management system working
- API parameter endpoints integrated
- Configuration persistence enabled

## Features to Implement

### 1. Device Configuration
- Device naming and identification
- Hardware profile selection
- Sensor calibration interfaces
- Communication settings
- Firmware update management

### 2. Network Settings
- WiFi network management
- RTCM correction source setup
- mDNS configuration
- Security settings
- Network diagnostics

### 3. Parameter Management
- Categorized parameter browser
- Search and filter functionality
- Parameter comparison tools
- Backup and restore
- Batch parameter updates

### 4. User Preferences
- Interface customization
- Theme and color settings
- Notification preferences
- Language selection
- Accessibility options

### 5. System Maintenance
- Diagnostic tools
- Log viewer and export
- Performance monitoring
- Reset and recovery options
- Update management

## Component Structure

```
src/components/settings/
├── SettingsLayout.vue          # Settings page layout
├── SettingsNavigation.vue      # Category navigation
├── device/
│   ├── DeviceInfo.vue          # Device identification
│   ├── HardwareProfile.vue     # Hardware configuration
│   ├── SensorCalibration.vue   # Sensor setup
│   └── CommunicationSetup.vue  # Comm settings
├── network/
│   ├── WiFiManager.vue         # WiFi configuration
│   ├── RTCMSetup.vue          # RTCM source setup
│   ├── NetworkDiagnostics.vue  # Network testing
│   └── SecuritySettings.vue    # Security config
├── parameters/
│   ├── ParameterBrowser.vue    # Parameter management
│   ├── ParameterEditor.vue     # Parameter editing
│   ├── ParameterBackup.vue     # Backup/restore
│   └── ParameterSearch.vue     # Search interface
├── preferences/
│   ├── InterfaceSettings.vue   # UI customization
│   ├── ThemeSelector.vue       # Theme options
│   ├── NotificationSettings.vue # Notification config
│   └── AccessibilitySettings.vue # Accessibility
└── maintenance/
    ├── SystemDiagnostics.vue   # System health
    ├── LogViewer.vue           # Log management
    ├── PerformanceMonitor.vue  # Performance data
    └── UpdateManager.vue       # System updates

src/pages/
└── SettingsPage.vue            # Main settings page

src/stores/
├── settings.ts                 # Settings management
├── parameters.ts               # Parameter state
└── preferences.ts              # User preferences
```

## Implementation

### Settings Page (pages/SettingsPage.vue)

```vue
<template>
  <q-page class="settings-page">
    <div class="settings-container">
      <!-- Settings Navigation -->
      <div class="settings-nav">
        <SettingsNavigation
          v-model="currentCategory"
          :categories="settingsCategories"
        />
      </div>
      
      <!-- Settings Content -->
      <div class="settings-content">
        <div class="settings-header">
          <h1 class="text-h4 text-primary">{{ currentCategoryTitle }}</h1>
          <p class="text-body2 text-grey-7">{{ currentCategoryDescription }}</p>
        </div>
        
        <q-separator class="q-my-md" />
        
        <div class="settings-body">
          <transition name="fade" mode="out-in">
            <component
              :is="currentCategoryComponent"
              :key="currentCategory"
              @change="handleSettingChange"
              @save="saveSettings"
              @reset="resetCategory"
            />
          </transition>
        </div>
        
        <!-- Settings Actions -->
        <div class="settings-actions q-mt-xl">
          <q-btn
            color="positive"
            icon="save"
            label="Save Changes"
            @click="saveAllSettings"
            :loading="isSaving"
            :disable="!hasUnsavedChanges"
            unelevated
          />
          <q-btn
            outline
            color="grey-7"
            icon="undo"
            label="Reset All"
            @click="resetAllSettings"
            :disable="!hasUnsavedChanges"
          />
          <q-btn
            outline
            color="primary"
            icon="download"
            label="Export Config"
            @click="exportConfiguration"
          />
          <q-btn
            outline
            color="primary"
            icon="upload"
            label="Import Config"
            @click="importConfiguration"
          />
        </div>
      </div>
    </div>
    
    <!-- Confirmation Dialogs -->
    <q-dialog v-model="showResetDialog" persistent>
      <q-card>
        <q-card-section>
          <div class="text-h6">Reset Settings</div>
        </q-card-section>
        <q-card-section>
          Are you sure you want to reset all settings to defaults? This action cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="grey-7" label="Cancel" v-close-popup />
          <q-btn flat color="negative" label="Reset" @click="confirmReset" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useSettingsStore } from '@/stores/settings';
import { useParametersStore } from '@/stores/parameters';
import { useUserPreferencesStore } from '@/stores/user-preferences';

// Component imports
import SettingsNavigation from '@/components/settings/SettingsNavigation.vue';
import DeviceSettings from '@/components/settings/device/DeviceSettings.vue';
import NetworkSettings from '@/components/settings/network/NetworkSettings.vue';
import ParameterSettings from '@/components/settings/parameters/ParameterSettings.vue';
import PreferenceSettings from '@/components/settings/preferences/PreferenceSettings.vue';
import MaintenanceSettings from '@/components/settings/maintenance/MaintenanceSettings.vue';

const $q = useQuasar();
const settingsStore = useSettingsStore();
const parametersStore = useParametersStore();
const preferencesStore = useUserPreferencesStore();

// State
const currentCategory = ref('device');
const isSaving = ref(false);
const showResetDialog = ref(false);

// Settings categories
const settingsCategories = [
  {
    id: 'device',
    title: 'Device',
    description: 'Device identification and hardware configuration',
    icon: 'memory',
    component: DeviceSettings
  },
  {
    id: 'network',
    title: 'Network',
    description: 'WiFi, RTCM, and connectivity settings',
    icon: 'wifi',
    component: NetworkSettings
  },
  {
    id: 'parameters',
    title: 'Parameters',
    description: 'Flight controller parameter management',
    icon: 'tune',
    component: ParameterSettings
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'User interface and behavior preferences',
    icon: 'person',
    component: PreferenceSettings
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    description: 'System diagnostics and maintenance tools',
    icon: 'build',
    component: MaintenanceSettings
  }
];

// Category mapping
const categoryComponents = {
  device: DeviceSettings,
  network: NetworkSettings,
  parameters: ParameterSettings,
  preferences: PreferenceSettings,
  maintenance: MaintenanceSettings
};

// Computed
const currentCategoryComponent = computed(() => 
  categoryComponents[currentCategory.value]
);

const currentCategoryInfo = computed(() => 
  settingsCategories.find(cat => cat.id === currentCategory.value)
);

const currentCategoryTitle = computed(() => 
  currentCategoryInfo.value?.title || 'Settings'
);

const currentCategoryDescription = computed(() => 
  currentCategoryInfo.value?.description || ''
);

const hasUnsavedChanges = computed(() => 
  settingsStore.hasUnsavedChanges ||
  parametersStore.hasUnsavedChanges ||
  preferencesStore.hasUnsavedChanges
);

// Settings management
function handleSettingChange(key: string, value: any) {
  settingsStore.updateSetting(key, value);
}

async function saveSettings(category?: string) {
  try {
    if (category) {
      await settingsStore.saveCategory(category);
    } else {
      await saveAllSettings();
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to save settings: ${error.message}`
    });
  }
}

async function saveAllSettings() {
  isSaving.value = true;
  
  try {
    await Promise.all([
      settingsStore.saveAll(),
      parametersStore.saveAll(),
      preferencesStore.saveAll()
    ]);
    
    $q.notify({
      type: 'positive',
      message: 'All settings saved successfully'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to save settings: ${error.message}`
    });
  } finally {
    isSaving.value = false;
  }
}

function resetCategory() {
  $q.dialog({
    title: 'Reset Category',
    message: `Reset ${currentCategoryTitle.value} settings to defaults?`,
    cancel: true
  }).onOk(() => {
    settingsStore.resetCategory(currentCategory.value);
  });
}

function resetAllSettings() {
  showResetDialog.value = true;
}

function confirmReset() {
  showResetDialog.value = false;
  
  Promise.all([
    settingsStore.resetAll(),
    parametersStore.resetAll(),
    preferencesStore.resetAll()
  ]).then(() => {
    $q.notify({
      type: 'positive',
      message: 'All settings reset to defaults'
    });
  });
}

// Import/Export
async function exportConfiguration() {
  try {
    const config = await settingsStore.exportConfiguration();
    
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardrover-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    $q.notify({
      type: 'positive',
      message: 'Configuration exported'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Export failed: ${error.message}`
    });
  }
}

function importConfiguration() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      $q.dialog({
        title: 'Import Configuration',
        message: 'This will overwrite current settings. Continue?',
        cancel: true
      }).onOk(async () => {
        await settingsStore.importConfiguration(config);
        
        $q.notify({
          type: 'positive',
          message: 'Configuration imported successfully'
        });
      });
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: `Import failed: ${error.message}`
      });
    }
  };
  
  input.click();
}

onMounted(() => {
  // Load all settings
  settingsStore.loadSettings();
  parametersStore.loadParameters();
  preferencesStore.loadPreferences();
});
</script>

<style lang="scss" scoped>
.settings-page {
  background-color: $background;
  min-height: 100vh;
}

.settings-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

.settings-nav {
  background: white;
  border-right: 1px solid $grey-4;
  padding: 20px;
}

.settings-content {
  padding: 24px;
  max-width: 800px;
}

.settings-header {
  h1 {
    margin: 0;
    font-weight: 300;
  }
}

.settings-body {
  min-height: 400px;
}

.settings-actions {
  display: flex;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid $grey-4;
}

// Responsive
@media (max-width: 996px) {
  .settings-container {
    grid-template-columns: 1fr;
  }
  
  .settings-nav {
    border-right: none;
    border-bottom: 1px solid $grey-4;
  }
}
</style>
```

### Parameter Browser Component (components/settings/parameters/ParameterBrowser.vue)

```vue
<template>
  <div class="parameter-browser">
    <!-- Search and Filters -->
    <div class="parameter-controls q-mb-md">
      <div class="row q-gutter-md">
        <q-input
          v-model="searchTerm"
          placeholder="Search parameters..."
          outlined
          dense
          clearable
          class="col"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
        
        <q-select
          v-model="selectedCategory"
          :options="categoryOptions"
          label="Category"
          outlined
          dense
          clearable
          style="min-width: 150px"
        />
        
        <q-select
          v-model="selectedLevel"
          :options="levelOptions"
          label="Level"
          outlined
          dense
          clearable
          style="min-width: 120px"
        />
      </div>
      
      <div class="row q-gutter-sm q-mt-sm">
        <q-chip
          v-model:selected="showModified"
          clickable
          color="primary"
          text-color="white"
          icon="edit"
        >
          Modified Only
        </q-chip>
        <q-chip
          v-model:selected="showAdvanced"
          clickable
          color="secondary"
          text-color="white"
          icon="engineering"
        >
          Advanced
        </q-chip>
      </div>
    </div>
    
    <!-- Parameter List -->
    <q-table
      :rows="filteredParameters"
      :columns="parameterColumns"
      :loading="parametersStore.isLoading"
      :pagination="pagination"
      :filter="searchTerm"
      row-key="name"
      flat
      bordered
      class="parameter-table"
    >
      <template v-slot:body-cell-name="props">
        <q-td :props="props">
          <div class="parameter-name">
            <span class="name-text">{{ props.value }}</span>
            <q-chip
              v-if="isModified(props.row.name)"
              dense
              color="warning"
              text-color="white"
              size="xs"
              class="q-ml-xs"
            >
              Modified
            </q-chip>
          </div>
        </q-td>
      </template>
      
      <template v-slot:body-cell-value="props">
        <q-td :props="props">
          <ParameterValueEditor
            :parameter="props.row"
            :value="getParameterValue(props.row.name)"
            @update="updateParameter"
            :readonly="!canEditParameter(props.row)"
          />
        </q-td>
      </template>
      
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            dense
            icon="info"
            @click="showParameterInfo(props.row)"
            size="sm"
          >
            <q-tooltip>Parameter details</q-tooltip>
          </q-btn>
          <q-btn
            v-if="isModified(props.row.name)"
            flat
            round
            dense
            icon="undo"
            @click="resetParameter(props.row.name)"
            size="sm"
          >
            <q-tooltip>Reset to default</q-tooltip>
          </q-btn>
          <q-btn
            v-if="canFavorite(props.row)"
            flat
            round
            dense
            :icon="isFavorite(props.row.name) ? 'star' : 'star_border'"
            @click="toggleFavorite(props.row.name)"
            size="sm"
          >
            <q-tooltip>{{ isFavorite(props.row.name) ? 'Remove from' : 'Add to' }} favorites</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
    
    <!-- Parameter Info Dialog -->
    <q-dialog v-model="showParameterDialog">
      <ParameterDetailsDialog
        :parameter="selectedParameter"
        @close="showParameterDialog = false"
        @edit="editParameterValue"
      />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useParametersStore } from '@/stores/parameters';
import ParameterValueEditor from '@/components/settings/parameters/ParameterValueEditor.vue';
import ParameterDetailsDialog from '@/components/settings/parameters/ParameterDetailsDialog.vue';

const $q = useQuasar();
const parametersStore = useParametersStore();

// State
const searchTerm = ref('');
const selectedCategory = ref(null);
const selectedLevel = ref(null);
const showModified = ref(false);
const showAdvanced = ref(false);
const showParameterDialog = ref(false);
const selectedParameter = ref(null);
const isSaving = ref(false);

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 25,
  sortBy: 'name',
  descending: false
});

// Table columns
const parameterColumns = [
  {
    name: 'name',
    label: 'Parameter',
    field: 'name',
    align: 'left',
    sortable: true,
    style: 'width: 200px'
  },
  {
    name: 'value',
    label: 'Value',
    field: 'value',
    align: 'left',
    style: 'width: 150px'
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    align: 'left'
  },
  {
    name: 'units',
    label: 'Units',
    field: 'units',
    align: 'center',
    style: 'width: 80px'
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    style: 'width: 120px'
  }
];

// Filter options
const categoryOptions = computed(() => {
  const categories = [...new Set(parametersStore.parameters.map(p => p.category))];
  return categories.map(cat => ({ label: cat, value: cat }));
});

const levelOptions = [
  { label: 'Standard', value: 'Standard' },
  { label: 'Advanced', value: 'Advanced' },
  { label: 'Expert', value: 'Expert' }
];

// Filtered parameters
const filteredParameters = computed(() => {
  let filtered = parametersStore.parameters;
  
  // Category filter
  if (selectedCategory.value) {
    filtered = filtered.filter(p => p.category === selectedCategory.value);
  }
  
  // Level filter
  if (selectedLevel.value) {
    filtered = filtered.filter(p => p.userLevel === selectedLevel.value);
  }
  
  // Modified only filter
  if (showModified.value) {
    filtered = filtered.filter(p => isModified(p.name));
  }
  
  // Advanced filter
  if (!showAdvanced.value) {
    filtered = filtered.filter(p => p.userLevel !== 'Expert');
  }
  
  return filtered;
});

const hasUnsavedChanges = computed(() => parametersStore.hasUnsavedChanges);

// Parameter management
function getParameterValue(name: string) {
  return parametersStore.getParameterValue(name);
}

function updateParameter(name: string, value: number) {
  parametersStore.updateParameter(name, value);
}

function isModified(name: string): boolean {
  return parametersStore.isParameterModified(name);
}

function resetParameter(name: string) {
  parametersStore.resetParameter(name);
}

function canEditParameter(parameter: any): boolean {
  return !parameter.readonly && parametersStore.isConnected;
}

function canFavorite(parameter: any): boolean {
  return parameter.userLevel === 'Standard' || parameter.userLevel === 'Advanced';
}

function isFavorite(name: string): boolean {
  return parametersStore.favoriteParameters.includes(name);
}

function toggleFavorite(name: string) {
  parametersStore.toggleFavorite(name);
}

// Parameter details
function showParameterInfo(parameter: any) {
  selectedParameter.value = parameter;
  showParameterDialog.value = true;
}

function editParameterValue(name: string, value: number) {
  updateParameter(name, value);
  showParameterDialog.value = false;
}

onMounted(async () => {
  await parametersStore.loadParameters();
});
</script>

<style lang="scss" scoped>
.parameter-browser {
  .parameter-controls {
    background: white;
    padding: 16px;
    border-radius: $radius-md;
    border: 1px solid $grey-4;
  }
  
  .parameter-table {
    background: white;
    
    :deep(.q-table__top) {
      background-color: rgba($primary, 0.05);
    }
    
    :deep(.q-table tbody tr:hover) {
      background-color: rgba($primary, 0.02);
    }
  }
}

.parameter-name {
  display: flex;
  align-items: center;
  
  .name-text {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.875rem;
  }
}
</style>
```

### WiFi Manager Component (components/settings/network/WiFiManager.vue)

```vue
<template>
  <div class="wifi-manager">
    <q-card>
      <q-card-section>
        <div class="text-h6 q-mb-md">WiFi Networks</div>
        
        <!-- Current Connection -->
        <q-banner
          v-if="wifiStore.status.connected"
          class="bg-positive text-white q-mb-md"
          rounded
        >
          <template v-slot:avatar>
            <q-icon name="wifi" />
          </template>
          <div>
            <div class="text-subtitle1">Connected to {{ wifiStore.status.ssid }}</div>
            <div class="text-caption">
              IP: {{ wifiStore.status.ip }} | Signal: {{ wifiStore.status.rssi }} dBm
            </div>
          </div>
          <template v-slot:action>
            <q-btn 
              flat 
              color="white" 
              label="Disconnect"
              @click="disconnect"
            />
          </template>
        </q-banner>
        
        <!-- Scan Controls -->
        <div class="scan-controls q-mb-md">
          <q-btn
            color="primary"
            icon="refresh"
            label="Scan Networks"
            @click="scanNetworks"
            :loading="wifiStore.isScanning"
            unelevated
          />
          <q-btn
            outline
            color="primary"
            icon="add"
            label="Add Network"
            @click="showAddNetwork = true"
          />
        </div>
        
        <!-- Available Networks -->
        <q-list v-if="wifiStore.availableNetworks.length > 0" bordered>
          <q-item-label header>Available Networks</q-item-label>
          <q-item
            v-for="network in wifiStore.availableNetworks"
            :key="network.ssid"
            clickable
            @click="connectToNetwork(network)"
          >
            <q-item-section avatar>
              <q-icon 
                :name="getSignalIcon(network.rssi)"
                :color="getSignalColor(network.rssi)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ network.ssid }}</q-item-label>
              <q-item-label caption>
                {{ network.authMode }} | Channel {{ network.channel }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="network-info">
                <q-chip
                  dense
                  :color="getSignalColor(network.rssi)"
                  text-color="white"
                  size="sm"
                >
                  {{ getSignalQuality(network.rssi) }}%
                </q-chip>
                <q-icon
                  v-if="network.secure"
                  name="lock"
                  color="grey-6"
                  size="xs"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
        
        <!-- Saved Networks -->
        <q-list v-if="savedNetworks.length > 0" bordered class="q-mt-md">
          <q-item-label header>Saved Networks</q-item-label>
          <q-item
            v-for="network in savedNetworks"
            :key="network.ssid"
          >
            <q-item-section avatar>
              <q-icon name="bookmark" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ network.ssid }}</q-item-label>
              <q-item-label caption>
                Last connected: {{ formatDate(network.lastConnected) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="delete"
                @click="removeSavedNetwork(network.ssid)"
                size="sm"
              >
                <q-tooltip>Remove saved network</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    
    <!-- WiFi Connection Dialog -->
    <q-dialog v-model="showWiFiDialog" persistent>
      <WiFiConnectionDialog
        :network="selectedNetwork"
        @connect="handleWiFiConnect"
        @cancel="showWiFiDialog = false"
      />
    </q-dialog>
    
    <!-- Add Network Dialog -->
    <q-dialog v-model="showAddNetwork">
      <WiFiManualDialog
        @connect="handleManualConnect"
        @cancel="showAddNetwork = false"
      />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useWiFiStore } from '@/stores/wifi';
import WiFiConnectionDialog from '@/components/settings/network/WiFiConnectionDialog.vue';
import WiFiManualDialog from '@/components/settings/network/WiFiManualDialog.vue';

const $q = useQuasar();
const wifiStore = useWiFiStore();

// State
const showWiFiDialog = ref(false);
const showAddNetwork = ref(false);
const selectedNetwork = ref(null);

// Mock saved networks (replace with actual storage)
const savedNetworks = ref([
  { ssid: 'HomeNetwork', lastConnected: new Date() },
  { ssid: 'OfficeWiFi', lastConnected: new Date(Date.now() - 86400000) }
]);

// WiFi management
async function scanNetworks() {
  try {
    await wifiStore.scanNetworks(true); // Force new scan
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Scan failed: ${error.message}`
    });
  }
}

function connectToNetwork(network: any) {
  selectedNetwork.value = network;
  
  if (network.secure) {
    showWiFiDialog.value = true;
  } else {
    // Connect directly to open network
    handleWiFiConnect(network.ssid, '');
  }
}

async function handleWiFiConnect(ssid: string, password: string) {
  showWiFiDialog.value = false;
  
  try {
    await wifiStore.connect(ssid, password);
    
    $q.notify({
      type: 'positive',
      message: `Connected to ${ssid}`
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Connection failed: ${error.message}`
    });
  }
}

async function disconnect() {
  try {
    await wifiStore.disconnect();
    
    $q.notify({
      type: 'info',
      message: 'Disconnected from WiFi'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Disconnect failed: ${error.message}`
    });
  }
}

// Utility functions
function getSignalIcon(rssi: number): string {
  if (rssi > -50) return 'signal_wifi_4_bar';
  if (rssi > -60) return 'network_wifi_3_bar';
  if (rssi > -70) return 'network_wifi_2_bar';
  return 'network_wifi_1_bar';
}

function getSignalColor(rssi: number): string {
  if (rssi > -50) return 'positive';
  if (rssi > -70) return 'warning';
  return 'negative';
}

function getSignalQuality(rssi: number): number {
  return Math.max(0, Math.min(100, 2 * (rssi + 100)));
}

onMounted(() => {
  // Load WiFi status and scan networks
  wifiStore.loadStatus();
  scanNetworks();
});
</script>
```

## Advanced Features

### Parameter Validation
- Range checking
- Type validation
- Dependency verification
- Safety constraints
- Reboot requirements

### Backup & Restore
- Full configuration backup
- Selective parameter backup
- Cloud storage integration
- Automatic backup scheduling
- Restore point creation

### Configuration Presets
- Beginner/Expert modes
- Seasonal configurations
- Task-specific presets
- Equipment-specific settings
- Performance profiles

### Diagnostic Tools
- System health checker
- Network connectivity tests
- Sensor calibration status
- Communication diagnostics
- Performance benchmarks

## Testing Requirements
- Test parameter validation
- Verify backup/restore functionality
- Test WiFi connection flow
- Validate setting persistence
- Test import/export features
- Verify reset functionality

## Next Steps
After completing this stage, proceed to Stage 8: Advanced Features to implement multi-device support, automation, and analytics.