<template>
  <BasePage
    title="Vehicle Control"
    subtitle="Monitor and control your vehicle"
    :loading="loading"
    :error="error"
    @retry="loadData"
  >
    <template #actions>
      <q-btn round flat icon="refresh" @click="loadData" :loading="loading">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </template>

    <!-- Connection Warning -->
    <q-banner v-if="!isConnected" class="bg-warning text-white q-mb-lg" rounded>
      <template #avatar>
        <q-icon name="mdi-link-off" />
      </template>
      MAVLink connection not established. Check your vehicle connection.
    </q-banner>

    <div class="row q-col-gutter-md">
      <!-- Status Column -->
      <div class="col-12 col-lg-8">
        <VehicleStatus class="q-mb-md" />

        <q-tabs
          v-model="tab"
          dense
          active-color="primary"
          indicator-color="primary"
          align="left"
          class="q-mb-md"
        >
          <q-tab name="control" label="Basic Control" />
          <q-tab name="console" label="Command Console" />
          <q-tab name="telemetry" label="Telemetry" />
        </q-tabs>

        <q-tab-panels v-model="tab" animated>
          <q-tab-panel name="control">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <ArmControl />
              </div>
              <div class="col-12 col-md-6">
                <FlightModeSelector />
              </div>
            </div>
          </q-tab-panel>

          <q-tab-panel name="console">
            <CommandConsole />
          </q-tab-panel>

          <q-tab-panel name="telemetry">
            <TelemetryDisplay />
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- Side Column -->
      <div class="col-12 col-lg-4">
        <EmergencyStop class="q-mb-md" />

        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Quick Actions</div>

            <div class="q-gutter-sm">
              <q-btn
                label="Set Home Here"
                color="primary"
                icon="mdi-home-map-marker"
                class="full-width"
                @click="setHomeHere"
              />
              <q-btn
                label="Request Data Streams"
                color="primary"
                icon="mdi-download"
                class="full-width"
                @click="requestDataStreams"
              />
              <q-btn
                label="Calibrate Compass"
                color="primary"
                icon="mdi-compass"
                class="full-width"
                @click="calibrateCompass"
              />
              <q-btn
                label="Reboot Flight Controller"
                color="warning"
                icon="mdi-restart"
                class="full-width"
                @click="rebootFC"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useMAVLinkStore } from '../stores/mavlink';
import BasePage from '../components/layout/BasePage.vue';
import VehicleStatus from '../components/mavlink/VehicleStatus.vue';
import ArmControl from '../components/mavlink/ArmControl.vue';
import FlightModeSelector from '../components/mavlink/FlightModeSelector.vue';
import CommandConsole from '../components/mavlink/CommandConsole.vue';
import EmergencyStop from '../components/mavlink/EmergencyStop.vue';
import TelemetryDisplay from '../components/mavlink/TelemetryDisplay.vue';

const $q = useQuasar();
const mavlinkStore = useMAVLinkStore();

const tab = ref('control');
let telemetryInterval: number | null = null;

const loading = computed(() => mavlinkStore.loading);
const error = computed(() => mavlinkStore.error);
const isConnected = computed(() => mavlinkStore.isConnected);

async function loadData() {
  try {
    // Use environment variable or fallback to localhost
    const deviceUrl = import.meta.env.VITE_DEFAULT_DEVICE_URL || 'http://localhost:8080';
    await mavlinkStore.connect(deviceUrl);
    await mavlinkStore.requestDataStreams();
    mavlinkStore.setupWebSocketHandlers();
    mavlinkStore.initializePreflightChecks();
  } catch (error) {
    console.error('Failed to load MAVLink data:', error);
  }
}

function setHomeHere() {
  $q.dialog({
    title: 'Set Home Position',
    message: 'Set the home position to the current vehicle location?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.setHomePosition();
        $q.notify({
          type: 'positive',
          message: 'Home position set',
          position: 'top',
        });
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to set home position',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top',
        });
      }
    })();
  });
}

async function requestDataStreams() {
  try {
    await mavlinkStore.requestDataStreams();
    $q.notify({
      type: 'positive',
      message: 'Data streams requested',
      position: 'top',
    });
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to request data streams',
      caption: error instanceof Error ? error.message : 'Unknown error',
      position: 'top',
    });
  }
}

function calibrateCompass() {
  $q.dialog({
    title: 'Calibrate Compass',
    message: 'Start compass calibration? You will need to rotate the vehicle in all axes.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.startCompassCalibration();
        $q.notify({
          type: 'info',
          message: 'Compass calibration started',
          caption: 'Rotate the vehicle in all axes',
          position: 'top',
          timeout: 0,
          actions: [{ label: 'OK', color: 'white' }],
        });
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to start calibration',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top',
        });
      }
    })();
  });
}

function rebootFC() {
  $q.dialog({
    title: 'Reboot Flight Controller',
    message: 'This will reboot the flight controller. The connection will be lost temporarily.',
    cancel: true,
    persistent: true,
    color: 'warning',
  }).onOk(() => {
    void (async () => {
      try {
        await mavlinkStore.rebootFlightController();
        $q.notify({
          type: 'warning',
          message: 'Flight controller rebooting',
          caption: 'Connection will be restored automatically',
          position: 'top',
        });
      } catch (error: unknown) {
        $q.notify({
          type: 'negative',
          message: 'Failed to reboot',
          caption: error instanceof Error ? error.message : 'Unknown error',
          position: 'top',
        });
      }
    })();
  });
}

onMounted(() => {
  void loadData();

  // Set up telemetry updates
  telemetryInterval = window.setInterval(() => {
    if (isConnected.value) {
      mavlinkStore.updateTelemetry();
    }
  }, 1000);
});

onUnmounted(() => {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
  }
  // Stop mock telemetry when component unmounts
  mavlinkStore.stopMockTelemetry();
});
</script>
