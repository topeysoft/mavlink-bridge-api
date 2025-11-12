<template>
  <q-page class="dashboard-page">
    <!-- Emergency Stop Overlay -->
    <EmergencyStop
      v-model="showEmergencyStop"
      @close="showEmergencyStop = false"
    />

    <!-- Page Header -->
    <div class="dashboard-header q-pa-md">
      <div class="row items-center">
        <div class="col">
          <h1 class="text-h4 text-primary q-mb-xs">Dashboard</h1>
          <p class="text-body2 text-grey-7">
            {{ currentTime }} - Connected:
            {{ connectionStore.isConnected ? 'Yes' : 'No' }}
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
        @layout-updated="saveDashboardLayout"
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
      <q-fab v-model="fabOpen" color="primary" icon="dashboard" direction="up">
        <q-fab-action
          color="primary"
          icon="edit"
          :label="editMode ? 'Done' : 'Edit Layout'"
          @click="editMode = !editMode"
        />
        <q-fab-action
          color="primary"
          icon="restore"
          label="Reset Layout"
          @click="resetLayout"
        />
      </q-fab>
    </q-page-sticky>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide, markRaw } from 'vue';
import { GridLayout, GridItem } from 'vue3-grid-layout';
import { date } from 'quasar';
import { useConnectionStore } from '@/stores/connection';
import { useTelemetryStore } from '@/stores/telemetry';
import { useHealthStore } from '@/stores/health';
import { useActivityStore } from '@/stores/activity';
import { useUserPreferencesStore } from '@/stores/user-preferences';

// Widget imports
import MachineStatusWidget from '@/components/dashboard/widgets/MachineStatusWidget.vue';
import QuickActionsWidget from '@/components/dashboard/widgets/QuickActionsWidget.vue';
import SystemHealthWidget from '@/components/dashboard/widgets/SystemHealthWidget.vue';
import ActivityWidget from '@/components/dashboard/widgets/ActivityWidget.vue';
import TelemetryWidget from '@/components/dashboard/widgets/TelemetryWidget.vue';
import EmergencyStop from '@/components/dashboard/EmergencyStop.vue';

const connectionStore = useConnectionStore();
const telemetryStore = useTelemetryStore();
const healthStore = useHealthStore();
const activityStore = useActivityStore();
const preferencesStore = useUserPreferencesStore();

// Widget component mapping - use markRaw to prevent reactivity
const widgetComponents = markRaw({
  'machine-status': MachineStatusWidget,
  'quick-actions': QuickActionsWidget,
  'system-health': SystemHealthWidget,
  activity: ActivityWidget,
  telemetry: TelemetryWidget,
});

// Non-reactive widget component getter to prevent infinite loops
function getWidgetComponent(type: string) {
  return (
    widgetComponents[type as keyof typeof widgetComponents] || markRaw('div')
  );
}

// State
const showEmergencyStop = ref(false);
const editMode = ref(false);
const fabOpen = ref(false);
const currentTime = ref('');

// Provide edit mode to child components
provide('dashboardEditMode', editMode);

// Default dashboard layout
const defaultLayout = [
  {
    i: 'machine-status',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    type: 'machine-status',
  },
  {
    i: 'quick-actions',
    x: 6,
    y: 0,
    w: 6,
    h: 2,
    minW: 4,
    minH: 2,
    type: 'quick-actions',
  },
  {
    i: 'system-health',
    x: 6,
    y: 2,
    w: 6,
    h: 3,
    minW: 4,
    minH: 3,
    type: 'system-health',
  },
  { i: 'activity', x: 0, y: 4, w: 8, h: 3, minW: 6, minH: 3, type: 'activity' },
  {
    i: 'telemetry',
    x: 8,
    y: 4,
    w: 4,
    h: 4,
    minW: 3,
    minH: 4,
    type: 'telemetry',
  },
];

// Dashboard layout (loaded from preferences or default)
const dashboardLayout = ref(
  preferencesStore.dashboardLayout.length > 0
    ? [...preferencesStore.dashboardLayout] // Create a copy to break reactivity
    : [...defaultLayout], // Create a copy of default layout too
);

// Update time
let timeInterval: NodeJS.Timeout;

function updateTime() {
  currentTime.value = date.formatDate(new Date(), 'dddd, MMMM D, YYYY h:mm A');
}

function removeWidget(widgetId: string) {
  const index = dashboardLayout.value.findIndex((w) => w.i === widgetId);
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
  // Create a deep copy to break reactivity cycles
  const layoutCopy = JSON.parse(JSON.stringify(dashboardLayout.value));
  preferencesStore.setDashboardLayout(layoutCopy);
}

// Lifecycle
onMounted(() => {
  // Start time updates
  updateTime();
  timeInterval = setInterval(updateTime, 1000);

  // Start data subscriptions if connected
  if (connectionStore.isConnected) {
    telemetryStore.startSubscription();
    healthStore.startMonitoring();
  }
  activityStore.startLogging();
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
@import '@/assets/styles/variables';

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

.widget {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
