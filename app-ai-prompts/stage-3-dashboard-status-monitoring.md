# Stage 3: Dashboard & Status Monitoring

## Objective
Create the main dashboard with real-time telemetry display, system health monitoring, weather integration, and quick action controls. The dashboard should provide an at-a-glance view of the YardRover's status and allow quick access to common operations.

## Prerequisites
- Completed Stage 1 & 2
- Connection management implemented
- API client configured
- WebSocket integration ready

## Features to Implement

### 1. Dashboard Layout
- Responsive grid system
- Widget-based architecture
- Customizable layout
- Real-time data updates
- Auto-refresh capabilities

### 2. Status Widgets
- Machine status (battery, mode, GPS)
- Current task progress
- System health metrics
- Connection quality
- Environmental conditions

### 3. Real-time Telemetry
- Live data streaming via WebSocket
- Telemetry charts and graphs
- Historical data view
- Data export functionality

### 4. Quick Actions
- Emergency stop button
- Mode switching
- Task start/pause/cancel
- Return to home
- System reboot

### 5. Activity Timeline
- Recent events log
- Task history
- System notifications
- Error/warning messages

## Component Structure

```
src/components/dashboard/
├── DashboardGrid.vue           # Grid layout manager
├── widgets/
│   ├── MachineStatusWidget.vue # Battery, GPS, mode
│   ├── TaskProgressWidget.vue  # Current task status
│   ├── SystemHealthWidget.vue  # CPU, memory, temp
│   ├── WeatherWidget.vue       # Weather conditions
│   ├── QuickActionsWidget.vue  # Action buttons
│   ├── TelemetryWidget.vue     # Live telemetry
│   └── ActivityWidget.vue      # Recent activity
├── charts/
│   ├── BatteryChart.vue        # Battery history
│   ├── SpeedChart.vue          # Speed over time
│   └── SignalChart.vue         # Signal strength
└── EmergencyStop.vue           # Emergency stop overlay

src/pages/
├── DashboardPage.vue           # Main dashboard
└── IndexPage.vue               # Redirect to dashboard

src/stores/
├── telemetry.ts                # Telemetry data
├── health.ts                   # System health
└── activity.ts                 # Activity log
```

## Implementation

### Dashboard Page (pages/DashboardPage.vue)

```vue
<template>
  <q-page class="dashboard-page">
    <!-- Emergency Stop Overlay -->
    <EmergencyStop v-if="showEmergencyStop" @close="showEmergencyStop = false" />
    
    <!-- Page Header -->
    <div class="dashboard-header q-pa-md">
      <div class="row items-center">
        <div class="col">
          <h1 class="text-h4 text-primary q-mb-xs">Dashboard</h1>
          <p class="text-body2 text-grey-7">
            {{ currentTime }} - {{ weatherSummary }}
          </p>
        </div>
        
        <!-- Emergency Stop Button -->
        <q-btn
          round
          size="lg"
          color="negative"
          icon="emergency"
          @click="showEmergencyStop = true"
          class="emergency-button"
        >
          <q-tooltip>Emergency Stop</q-tooltip>
        </q-btn>
      </div>
    </div>
    
    <!-- Dashboard Grid -->
    <div class="dashboard-grid q-pa-md">
      <grid-layout
        v-model:layout="dashboardLayout"
        :col-num="12"
        :row-height="100"
        :is-draggable="editMode"
        :is-resizable="editMode"
        :vertical-compact="true"
        :use-css-transforms="true"
        :responsive="true"
        :breakpoints="{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }"
        :cols="{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }"
      >
        <grid-item
          v-for="widget in dashboardLayout"
          :key="widget.i"
          :x="widget.x"
          :y="widget.y"
          :w="widget.w"
          :h="widget.h"
          :i="widget.i"
          :min-w="widget.minW"
          :min-h="widget.minH"
        >
          <component
            :is="getWidgetComponent(widget.type)"
            :widget-id="widget.i"
            @remove="removeWidget"
          />
        </grid-item>
      </grid-layout>
    </div>
    
    <!-- Edit Mode FAB -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-fab
        v-model="fabOpen"
        color="primary"
        icon="dashboard"
        direction="up"
      >
        <q-fab-action
          color="primary"
          icon="edit"
          :label="editMode ? 'Done' : 'Edit Layout'"
          @click="editMode = !editMode"
        />
        <q-fab-action
          color="primary"
          icon="add"
          label="Add Widget"
          @click="showAddWidget = true"
        />
        <q-fab-action
          color="primary"
          icon="restore"
          label="Reset Layout"
          @click="resetLayout"
        />
      </q-fab>
    </q-page-sticky>
    
    <!-- Add Widget Dialog -->
    <q-dialog v-model="showAddWidget">
      <AddWidgetDialog @add="addWidget" />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { GridLayout, GridItem } from 'vue-grid-layout';
import { date } from 'quasar';
import { useTelemetryStore } from '@/stores/telemetry';
import { useHealthStore } from '@/stores/health';
import { useActivityStore } from '@/stores/activity';
import { useUserPreferencesStore } from '@/stores/user-preferences';

// Widget imports
import MachineStatusWidget from '@/components/dashboard/widgets/MachineStatusWidget.vue';
import TaskProgressWidget from '@/components/dashboard/widgets/TaskProgressWidget.vue';
import SystemHealthWidget from '@/components/dashboard/widgets/SystemHealthWidget.vue';
import WeatherWidget from '@/components/dashboard/widgets/WeatherWidget.vue';
import QuickActionsWidget from '@/components/dashboard/widgets/QuickActionsWidget.vue';
import TelemetryWidget from '@/components/dashboard/widgets/TelemetryWidget.vue';
import ActivityWidget from '@/components/dashboard/widgets/ActivityWidget.vue';
import EmergencyStop from '@/components/dashboard/EmergencyStop.vue';
import AddWidgetDialog from '@/components/dashboard/AddWidgetDialog.vue';

const telemetryStore = useTelemetryStore();
const healthStore = useHealthStore();
const activityStore = useActivityStore();
const preferencesStore = useUserPreferencesStore();

// Widget component mapping
const widgetComponents = {
  'machine-status': MachineStatusWidget,
  'task-progress': TaskProgressWidget,
  'system-health': SystemHealthWidget,
  'weather': WeatherWidget,
  'quick-actions': QuickActionsWidget,
  'telemetry': TelemetryWidget,
  'activity': ActivityWidget
};

// State
const showEmergencyStop = ref(false);
const editMode = ref(false);
const fabOpen = ref(false);
const showAddWidget = ref(false);
const currentTime = ref('');
const weatherSummary = ref('Loading weather...');

// Default dashboard layout
const defaultLayout = [
  { i: 'machine-status', x: 0, y: 0, w: 4, h: 3, minW: 3, minH: 2, type: 'machine-status' },
  { i: 'task-progress', x: 4, y: 0, w: 4, h: 3, minW: 3, minH: 2, type: 'task-progress' },
  { i: 'system-health', x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2, type: 'system-health' },
  { i: 'weather', x: 0, y: 3, w: 3, h: 2, minW: 3, minH: 2, type: 'weather' },
  { i: 'quick-actions', x: 3, y: 3, w: 6, h: 2, minW: 4, minH: 2, type: 'quick-actions' },
  { i: 'telemetry', x: 9, y: 3, w: 3, h: 4, minW: 3, minH: 3, type: 'telemetry' },
  { i: 'activity', x: 0, y: 5, w: 9, h: 3, minW: 6, minH: 2, type: 'activity' }
];

// Dashboard layout (loaded from preferences or default)
const dashboardLayout = ref(
  preferencesStore.dashboardLayout || defaultLayout
);

// Update time
let timeInterval: NodeJS.Timeout;

function updateTime() {
  currentTime.value = date.formatDate(new Date(), 'dddd, MMMM D, YYYY h:mm A');
}

// Widget management
function getWidgetComponent(type: string) {
  return widgetComponents[type] || 'div';
}

function addWidget(widget: any) {
  const newWidget = {
    i: `widget-${Date.now()}`,
    x: 0,
    y: 100, // Add at bottom
    w: widget.defaultWidth || 4,
    h: widget.defaultHeight || 3,
    minW: widget.minWidth || 3,
    minH: widget.minHeight || 2,
    type: widget.type
  };
  
  dashboardLayout.value.push(newWidget);
  saveDashboardLayout();
  showAddWidget.value = false;
}

function removeWidget(widgetId: string) {
  const index = dashboardLayout.value.findIndex(w => w.i === widgetId);
  if (index >= 0) {
    dashboardLayout.value.splice(index, 1);
    saveDashboardLayout();
  }
}

function resetLayout() {
  dashboardLayout.value = [...defaultLayout];
  saveDashboardLayout();
}

function saveDashboardLayout() {
  preferencesStore.setDashboardLayout(dashboardLayout.value);
}

// Lifecycle
onMounted(() => {
  // Start time updates
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
  
  // Start data subscriptions
  telemetryStore.startSubscription();
  healthStore.startMonitoring();
  activityStore.startLogging();
  
  // Mock weather summary (replace with actual weather API)
  setTimeout(() => {
    weatherSummary.value = 'Partly cloudy, 72°F';
  }, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
  
  // Stop subscriptions
  telemetryStore.stopSubscription();
  healthStore.stopMonitoring();
  activityStore.stopLogging();
});
</script>

<style lang="scss" scoped>
.dashboard-page {
  background-color: $background;
  min-height: 100vh;
}

.dashboard-header {
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  
  h1 {
    font-weight: 300;
    margin: 0;
  }
}

.emergency-button {
  animation: pulse 2s infinite;
  
  &:hover {
    animation: none;
    transform: scale(1.1);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba($negative, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba($negative, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba($negative, 0);
  }
}

.dashboard-grid {
  :deep(.vue-grid-item) {
    background: white;
    border-radius: $radius-lg;
    box-shadow: $shadow-sm;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: $shadow-md;
    }
    
    &.vue-grid-placeholder {
      background: rgba($primary, 0.1);
      border: 2px dashed $primary;
    }
  }
}
</style>
```

### Machine Status Widget (components/dashboard/widgets/MachineStatusWidget.vue)

```vue
<template>
  <q-card class="widget machine-status-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Machine Status</div>
      <q-space />
      <q-btn
        v-if="editMode"
        flat
        round
        dense
        icon="close"
        size="sm"
        @click="$emit('remove', widgetId)"
      />
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="widget-content">
      <div class="status-grid">
        <!-- Battery Status -->
        <div class="status-item">
          <q-icon name="battery_charging_full" size="32px" :color="batteryColor" />
          <div class="status-info">
            <div class="status-value">{{ batteryLevel }}%</div>
            <div class="status-label">Battery</div>
            <q-linear-progress
              :value="batteryLevel / 100"
              :color="batteryColor"
              size="4px"
              class="q-mt-xs"
            />
          </div>
        </div>
        
        <!-- GPS Status -->
        <div class="status-item">
          <q-icon name="gps_fixed" size="32px" :color="gpsColor" />
          <div class="status-info">
            <div class="status-value">{{ gpsStatus }}</div>
            <div class="status-label">GPS ({{ numSatellites }} sats)</div>
            <div class="status-detail">{{ gpsAccuracy }}m accuracy</div>
          </div>
        </div>
        
        <!-- Mode Status -->
        <div class="status-item">
          <q-icon name="flight" size="32px" color="primary" />
          <div class="status-info">
            <div class="status-value">{{ flightMode }}</div>
            <div class="status-label">Mode</div>
            <q-chip
              dense
              :color="armedStatus ? 'positive' : 'grey-5'"
              text-color="white"
              size="sm"
            >
              {{ armedStatus ? 'ARMED' : 'DISARMED' }}
            </q-chip>
          </div>
        </div>
        
        <!-- Speed Status -->
        <div class="status-item">
          <q-icon name="speed" size="32px" color="secondary" />
          <div class="status-info">
            <div class="status-value">{{ groundSpeed.toFixed(1) }} m/s</div>
            <div class="status-label">Speed</div>
            <div class="status-detail">Heading: {{ heading }}°</div>
          </div>
        </div>
      </div>
      
      <!-- Position Map Mini -->
      <div class="position-map q-mt-md">
        <div class="map-placeholder">
          <q-icon name="place" size="24px" color="negative" />
          <div class="text-caption">
            {{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useTelemetryStore } from '@/stores/telemetry';

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const editMode = inject('dashboardEditMode', false);
const telemetryStore = useTelemetryStore();

// Computed values from telemetry
const batteryLevel = computed(() => telemetryStore.battery.level);
const batteryColor = computed(() => {
  if (batteryLevel.value > 60) return 'positive';
  if (batteryLevel.value > 30) return 'warning';
  return 'negative';
});

const gpsStatus = computed(() => {
  if (telemetryStore.gps.fix === 3) return '3D Fix';
  if (telemetryStore.gps.fix === 2) return '2D Fix';
  return 'No Fix';
});

const gpsColor = computed(() => {
  return telemetryStore.gps.fix >= 2 ? 'positive' : 'negative';
});

const numSatellites = computed(() => telemetryStore.gps.satellites);
const gpsAccuracy = computed(() => telemetryStore.gps.hdop.toFixed(1));

const flightMode = computed(() => telemetryStore.flightMode);
const armedStatus = computed(() => telemetryStore.armed);

const groundSpeed = computed(() => telemetryStore.velocity.ground);
const heading = computed(() => Math.round(telemetryStore.attitude.yaw * 180 / Math.PI));

const latitude = computed(() => telemetryStore.position.lat);
const longitude = computed(() => telemetryStore.position.lon);
</script>

<style lang="scss" scoped>
.machine-status-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
}

.widget-content {
  flex: 1;
  overflow-y: auto;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background-color: $surface-variant;
  border-radius: $radius-md;
}

.status-info {
  flex: 1;
}

.status-value {
  font-size: 1.25rem;
  font-weight: 500;
  color: $text-primary;
}

.status-label {
  font-size: 0.875rem;
  color: $text-secondary;
  margin-top: 2px;
}

.status-detail {
  font-size: 0.75rem;
  color: $text-secondary;
  margin-top: 4px;
}

.position-map {
  height: 120px;
  background-color: $surface-variant;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .map-placeholder {
    text-align: center;
    color: $text-secondary;
  }
}
</style>
```

### Telemetry Store (stores/telemetry.ts)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';
import type { MAVLinkMessage } from '@mavlinkbridge/api-client';

export interface TelemetryData {
  // Battery
  battery: {
    level: number;
    voltage: number;
    current: number;
    remaining: number;
  };
  
  // GPS
  gps: {
    fix: number;
    satellites: number;
    hdop: number;
    vdop: number;
  };
  
  // Position
  position: {
    lat: number;
    lon: number;
    alt: number;
    relative_alt: number;
  };
  
  // Velocity
  velocity: {
    ground: number;
    air: number;
    climb: number;
  };
  
  // Attitude
  attitude: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  
  // Status
  flightMode: string;
  armed: boolean;
  systemStatus: number;
}

export const useTelemetryStore = defineStore('telemetry', () => {
  // State
  const battery = ref({
    level: 0,
    voltage: 0,
    current: 0,
    remaining: 0
  });
  
  const gps = ref({
    fix: 0,
    satellites: 0,
    hdop: 99.9,
    vdop: 99.9
  });
  
  const position = ref({
    lat: 0,
    lon: 0,
    alt: 0,
    relative_alt: 0
  });
  
  const velocity = ref({
    ground: 0,
    air: 0,
    climb: 0
  });
  
  const attitude = ref({
    roll: 0,
    pitch: 0,
    yaw: 0
  });
  
  const flightMode = ref('UNKNOWN');
  const armed = ref(false);
  const systemStatus = ref(0);
  
  const lastUpdate = ref<Date | null>(null);
  const isSubscribed = ref(false);
  
  // WebSocket subscription
  let unsubscribe: (() => void) | null = null;
  
  // Actions
  function startSubscription() {
    if (isSubscribed.value) return;
    
    const client = apiClient.getClient();
    if (!client) return;
    
    // Subscribe to MAVLink messages
    unsubscribe = client.on('mavlink_message', (message: MAVLinkMessage) => {
      handleMAVLinkMessage(message);
      lastUpdate.value = new Date();
    });
    
    isSubscribed.value = true;
  }
  
  function stopSubscription() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    isSubscribed.value = false;
  }
  
  function handleMAVLinkMessage(message: MAVLinkMessage) {
    switch (message.name) {
      case 'HEARTBEAT':
        updateHeartbeat(message);
        break;
      
      case 'SYS_STATUS':
        updateSystemStatus(message);
        break;
      
      case 'BATTERY_STATUS':
        updateBatteryStatus(message);
        break;
      
      case 'GPS_RAW_INT':
        updateGPSStatus(message);
        break;
      
      case 'GLOBAL_POSITION_INT':
        updatePosition(message);
        break;
      
      case 'ATTITUDE':
        updateAttitude(message);
        break;
      
      case 'VFR_HUD':
        updateVFRHud(message);
        break;
    }
  }
  
  function updateHeartbeat(message: any) {
    const modeMapping = {
      0: 'STABILIZE',
      1: 'ACRO',
      2: 'ALT_HOLD',
      3: 'AUTO',
      4: 'GUIDED',
      5: 'LOITER',
      6: 'RTL',
      7: 'CIRCLE',
      9: 'LAND',
      15: 'AUTOTUNE',
      16: 'POSHOLD',
      19: 'MANUAL'
    };
    
    flightMode.value = modeMapping[message.custom_mode] || `MODE_${message.custom_mode}`;
    armed.value = (message.base_mode & 128) !== 0;
    systemStatus.value = message.system_status;
  }
  
  function updateSystemStatus(message: any) {
    battery.value.voltage = message.voltage_battery / 1000;
    battery.value.current = message.current_battery / 100;
    battery.value.remaining = message.battery_remaining;
    battery.value.level = message.battery_remaining;
  }
  
  function updateBatteryStatus(message: any) {
    if (message.voltages && message.voltages.length > 0) {
      battery.value.voltage = message.voltages[0] / 1000;
    }
    battery.value.current = message.current_consumed / 1000;
  }
  
  function updateGPSStatus(message: any) {
    gps.value.fix = message.fix_type;
    gps.value.satellites = message.satellites_visible;
    gps.value.hdop = message.eph / 100;
    gps.value.vdop = message.epv / 100;
  }
  
  function updatePosition(message: any) {
    position.value.lat = message.lat / 1e7;
    position.value.lon = message.lon / 1e7;
    position.value.alt = message.alt / 1000;
    position.value.relative_alt = message.relative_alt / 1000;
    
    velocity.value.ground = Math.sqrt(
      Math.pow(message.vx / 100, 2) + 
      Math.pow(message.vy / 100, 2)
    );
    velocity.value.climb = -message.vz / 100;
  }
  
  function updateAttitude(message: any) {
    attitude.value.roll = message.roll;
    attitude.value.pitch = message.pitch;
    attitude.value.yaw = message.yaw;
  }
  
  function updateVFRHud(message: any) {
    velocity.value.ground = message.groundspeed;
    velocity.value.air = message.airspeed;
    velocity.value.climb = message.climb;
  }
  
  // Getters
  const isConnected = computed(() => isSubscribed.value && lastUpdate.value !== null);
  
  const dataAge = computed(() => {
    if (!lastUpdate.value) return Infinity;
    return Date.now() - lastUpdate.value.getTime();
  });
  
  const isDataFresh = computed(() => dataAge.value < 5000); // 5 seconds
  
  return {
    // State
    battery,
    gps,
    position,
    velocity,
    attitude,
    flightMode,
    armed,
    systemStatus,
    lastUpdate,
    isSubscribed,
    
    // Getters
    isConnected,
    dataAge,
    isDataFresh,
    
    // Actions
    startSubscription,
    stopSubscription
  };
});
```

### Quick Actions Widget (components/dashboard/widgets/QuickActionsWidget.vue)

```vue
<template>
  <q-card class="widget quick-actions-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Quick Actions</div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="widget-content">
      <div class="actions-grid">
        <!-- Arm/Disarm -->
        <q-btn
          :color="telemetryStore.armed ? 'negative' : 'positive'"
          :icon="telemetryStore.armed ? 'lock' : 'lock_open'"
          :label="telemetryStore.armed ? 'Disarm' : 'Arm'"
          @click="toggleArm"
          :loading="armLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Mode Selection -->
        <q-btn-dropdown
          color="primary"
          icon="flight"
          :label="`Mode: ${telemetryStore.flightMode}`"
          unelevated
          class="action-btn"
        >
          <q-list>
            <q-item
              v-for="mode in flightModes"
              :key="mode.value"
              clickable
              v-close-popup
              @click="setMode(mode.value)"
            >
              <q-item-section avatar>
                <q-icon :name="mode.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ mode.label }}</q-item-label>
                <q-item-label caption>{{ mode.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        
        <!-- RTL -->
        <q-btn
          color="warning"
          icon="home"
          label="Return Home"
          @click="returnToLaunch"
          :loading="rtlLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Land -->
        <q-btn
          color="accent"
          icon="flight_land"
          label="Land"
          @click="land"
          :loading="landLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Pause -->
        <q-btn
          color="grey-7"
          icon="pause"
          label="Pause"
          @click="pause"
          unelevated
          class="action-btn"
        />
        
        <!-- Resume -->
        <q-btn
          color="secondary"
          icon="play_arrow"
          label="Resume"
          @click="resume"
          unelevated
          class="action-btn"
        />
      </div>
      
      <!-- Status Messages -->
      <q-banner
        v-if="statusMessage"
        :class="`bg-${statusType} text-white q-mt-md`"
        rounded
        dense
      >
        {{ statusMessage }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useTelemetryStore } from '@/stores/telemetry';
import { apiClient } from '@/services/api/client';

const $q = useQuasar();
const telemetryStore = useTelemetryStore();

// Loading states
const armLoading = ref(false);
const rtlLoading = ref(false);
const landLoading = ref(false);

// Status message
const statusMessage = ref('');
const statusType = ref('info');

// Flight modes
const flightModes = [
  { value: 0, label: 'Stabilize', icon: 'balance', description: 'Manual control with auto-leveling' },
  { value: 3, label: 'Auto', icon: 'play_circle', description: 'Follow mission waypoints' },
  { value: 4, label: 'Guided', icon: 'navigation', description: 'Computer controlled mode' },
  { value: 5, label: 'Loiter', icon: 'loop', description: 'Hold position' },
  { value: 6, label: 'RTL', icon: 'home', description: 'Return to launch' },
  { value: 9, label: 'Land', icon: 'flight_land', description: 'Automatic landing' },
  { value: 19, label: 'Manual', icon: 'sports_esports', description: 'Full manual control' }
];

// Actions
async function toggleArm() {
  armLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    
    if (telemetryStore.armed) {
      await client.mavlink.disarm();
      showStatus('Vehicle disarmed', 'positive');
    } else {
      // Confirm arming
      $q.dialog({
        title: 'Confirm Arming',
        message: 'Are you sure you want to arm the vehicle?',
        cancel: true,
        persistent: true
      }).onOk(async () => {
        await client.mavlink.arm();
        showStatus('Vehicle armed - Be careful!', 'warning');
      });
    }
  } catch (error) {
    showStatus(`Command failed: ${error.message}`, 'negative');
  } finally {
    armLoading.value = false;
  }
}

async function setMode(mode: number) {
  try {
    const client = apiClient.getClient();
    await client.mavlink.setMode(mode);
    showStatus(`Mode changed to ${flightModes.find(m => m.value === mode)?.label}`, 'positive');
  } catch (error) {
    showStatus(`Mode change failed: ${error.message}`, 'negative');
  }
}

async function returnToLaunch() {
  rtlLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    await client.mavlink.returnToLaunch();
    showStatus('Returning to launch position', 'positive');
  } catch (error) {
    showStatus(`RTL failed: ${error.message}`, 'negative');
  } finally {
    rtlLoading.value = false;
  }
}

async function land() {
  landLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    await client.mavlink.land();
    showStatus('Landing initiated', 'positive');
  } catch (error) {
    showStatus(`Land failed: ${error.message}`, 'negative');
  } finally {
    landLoading.value = false;
  }
}

async function pause() {
  try {
    const client = apiClient.getClient();
    await client.mavlink.commandLong({
      command: 252, // MAV_CMD_OVERRIDE_GOTO
      param1: 1,    // Pause
      param2: 0     // Hold position
    });
    showStatus('Mission paused', 'info');
  } catch (error) {
    showStatus(`Pause failed: ${error.message}`, 'negative');
  }
}

async function resume() {
  try {
    const client = apiClient.getClient();
    await client.mavlink.commandLong({
      command: 252, // MAV_CMD_OVERRIDE_GOTO
      param1: 0,    // Resume
      param2: 0
    });
    showStatus('Mission resumed', 'positive');
  } catch (error) {
    showStatus(`Resume failed: ${error.message}`, 'negative');
  }
}

function showStatus(message: string, type: string) {
  statusMessage.value = message;
  statusType.value = type;
  
  setTimeout(() => {
    statusMessage.value = '';
  }, 5000);
}
</script>

<style lang="scss" scoped>
.quick-actions-widget {
  .widget-content {
    padding: 16px;
  }
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.action-btn {
  height: 48px;
  font-size: 0.875rem;
  
  :deep(.q-btn__content) {
    flex-direction: column;
    gap: 4px;
    
    .q-icon {
      font-size: 20px;
    }
  }
}
</style>
```

## Additional Widgets to Implement

### 1. Task Progress Widget
- Current task name and type
- Progress bar with percentage
- Waypoint counter
- ETA and distance remaining
- Pause/resume/cancel controls

### 2. System Health Widget
- CPU usage gauge
- Memory usage
- Temperature monitoring
- Component health status
- Error/warning indicators

### 3. Weather Widget
- Current temperature
- Wind speed and direction
- Precipitation status
- UV index
- Weather alerts

### 4. Activity Timeline Widget
- Recent events with timestamps
- Event type indicators
- Expandable details
- Filter by event type
- Export functionality

### 5. Telemetry Charts Widget
- Real-time line charts
- Battery voltage history
- Speed over time
- Altitude profile
- Signal strength

## Real-time Updates

### WebSocket Event Handling
```typescript
// Handle real-time events
client.on('task_execution_progress', (data) => {
  activityStore.addEvent({
    type: 'task_progress',
    message: `Task ${data.taskId} - ${data.progress * 100}% complete`,
    timestamp: new Date(),
    data
  });
});

client.on('system_error', (data) => {
  activityStore.addEvent({
    type: 'error',
    message: data.message,
    timestamp: new Date(),
    severity: 'high',
    data
  });
  
  // Show notification
  $q.notify({
    type: 'negative',
    message: data.message,
    position: 'top',
    timeout: 0,
    actions: [
      { label: 'Dismiss', color: 'white' }
    ]
  });
});
```

## Performance Optimization

### 1. Data Throttling
- Throttle telemetry updates to 10Hz
- Batch chart updates
- Debounce widget refresh

### 2. Memory Management
- Limit historical data storage
- Clear old activity logs
- Unsubscribe when widgets unmount

### 3. Rendering Optimization
- Use virtual scrolling for activity log
- Lazy load chart libraries
- Memoize computed values

## Testing Requirements
- Test real-time data updates
- Verify emergency stop functionality
- Test widget drag-and-drop
- Validate data accuracy
- Test offline behavior

## Next Steps
After completing this stage, proceed to Stage 4: Machine Control Interface to implement detailed control features for each machine function.