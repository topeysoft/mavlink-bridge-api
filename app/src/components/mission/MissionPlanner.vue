<template>
  <div class="mission-planner">
    <div class="planner-header q-pa-md">
      <div class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Mission Planner</div>
          <div class="text-caption text-grey-7">
            {{ waypoints.length }} waypoints
            <span v-if="totalDistance > 0"> • {{ totalDistance.toFixed(0) }}m total distance </span>
          </div>
        </div>

        <q-btn-group>
          <q-btn
            :color="planningMode === 'waypoint' ? 'primary' : 'grey'"
            icon="mdi-map-marker-plus"
            label="Add Waypoints"
            @click="planningMode = 'waypoint'"
          />
          <q-btn
            :color="planningMode === 'pattern' ? 'primary' : 'grey'"
            icon="mdi-grid"
            label="Patterns"
            @click="planningMode = 'pattern'"
          />
        </q-btn-group>

        <q-btn-group>
          <q-btn flat icon="mdi-upload" @click="showImportDialog = true">
            <q-tooltip>Import mission</q-tooltip>
          </q-btn>
          <q-btn flat icon="mdi-download" @click="exportMission" :disable="waypoints.length === 0">
            <q-tooltip>Export mission</q-tooltip>
          </q-btn>
          <q-btn flat icon="mdi-delete" @click="clearMission" :disable="waypoints.length === 0">
            <q-tooltip>Clear mission</q-tooltip>
          </q-btn>
        </q-btn-group>
      </div>
    </div>

    <div class="planner-content row no-wrap">
      <!-- Map -->
      <div class="col map-section">
        <MapContainer
          :center="mapCenter"
          :zoom="mapZoom"
          :waypoints="waypoints"
          :vehicle-position="vehiclePosition"
          :show-trail="showTrail"
          @map-click="handleMapClick"
          @waypoint-move="handleWaypointMove"
          @waypoint-click="selectWaypoint"
          ref="mapRef"
        />
      </div>

      <!-- Side Panel -->
      <div class="col-auto side-panel">
        <q-tabs v-model="sideTab" vertical active-color="primary" indicator-color="primary">
          <q-tab name="waypoints" label="Waypoints" icon="mdi-format-list-numbered" />
          <q-tab name="patterns" label="Patterns" icon="mdi-grid" />
          <q-tab name="settings" label="Settings" icon="mdi-cog" />
        </q-tabs>

        <q-tab-panels v-model="sideTab" animated vertical>
          <q-tab-panel name="waypoints">
            <WaypointList
              :waypoints="waypoints"
              :selected-index="selectedWaypointIndex"
              @select="selectWaypoint"
              @update="updateWaypoint"
              @delete="deleteWaypoint"
              @reorder="reorderWaypoints"
            />
          </q-tab-panel>

          <q-tab-panel name="patterns">
            <PatternGenerator @generate="generatePattern" />
          </q-tab-panel>

          <q-tab-panel name="settings">
            <MissionSettings v-model="missionSettings" />
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>

    <!-- Import Dialog -->
    <q-dialog v-model="showImportDialog">
      <MissionImportDialog @import="importMission" @close="showImportDialog = false" />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useMissionStore } from '../../stores/mission';
import { useMAVLinkStore } from '../../stores/mavlink';
import MapContainer from '@/components/map/MapContainer.vue';
import WaypointList from './WaypointList.vue';
import PatternGenerator from './PatternGenerator.vue';
import MissionSettings from './MissionSettings.vue';
import MissionImportDialog from './MissionImportDialog.vue';
import type { Waypoint, PatternDefinition, MissionData } from '../../stores/mission';

const $q = useQuasar();
const missionStore = useMissionStore();
const mavlinkStore = useMAVLinkStore();

const mapRef = ref();
const planningMode = ref<'waypoint' | 'pattern'>('waypoint');
const sideTab = ref('waypoints');
const showImportDialog = ref(false);
const selectedWaypointIndex = ref(-1);

const mapCenter = ref<[number, number]>([40.7128, -74.006]);
const mapZoom = ref(15);
const showTrail = ref(false);

// Store reactive refs
const waypoints = computed(() => missionStore.waypoints);
const missionSettings = computed({
  get: () => missionStore.missionSettings,
  set: (value) => {
    missionStore.missionSettings = value;
  },
});
const totalDistance = computed(() => missionStore.totalDistance);

const vehiclePosition = computed(() => {
  const vehicle = mavlinkStore.vehicleState;
  return {
    lat: vehicle.position.lat || 40.7128,
    lng: vehicle.position.lng || -74.006,
    heading: vehicle.heading,
  };
});

function handleMapClick(event: { lat: number; lng: number }) {
  if (planningMode.value === 'waypoint') {
    const waypoint: Waypoint = {
      lat: event.lat,
      lng: event.lng,
      alt: missionSettings.value.defaultAltitude,
      type: 'waypoint',
    };
    missionStore.addWaypoint(waypoint);
    selectedWaypointIndex.value = waypoints.value.length - 1;
  }
}

function handleWaypointMove(index: number, position: { lat: number; lng: number }) {
  const waypoint = waypoints.value[index];
  if (waypoint) {
    const updatedWaypoint: Waypoint = {
      ...waypoint,
      lat: position.lat,
      lng: position.lng,
    };
    missionStore.updateWaypoint(index, updatedWaypoint);
  }
}

function selectWaypoint(index: number) {
  selectedWaypointIndex.value = index;
}

function updateWaypoint(index: number, waypoint: Waypoint) {
  missionStore.updateWaypoint(index, waypoint);
}

function deleteWaypoint(index: number) {
  missionStore.deleteWaypoint(index);
  if (selectedWaypointIndex.value >= waypoints.value.length) {
    selectedWaypointIndex.value = waypoints.value.length - 1;
  }
}

function reorderWaypoints(from: number, to: number) {
  missionStore.reorderWaypoints(from, to);
}

function clearMission() {
  $q.dialog({
    title: 'Clear Mission',
    message: 'Remove all waypoints from the mission?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    missionStore.clearWaypoints();
    selectedWaypointIndex.value = -1;
  });
}

function generatePattern(pattern: PatternDefinition) {
  const newWaypoints = missionStore.generatePattern(pattern);
  missionStore.setWaypoints(newWaypoints);

  // Fit map to pattern bounds
  if (newWaypoints.length > 0) {
    const bounds = missionStore.calculateBounds(newWaypoints);
    mapRef.value?.fitBounds(bounds);
  }
}

function exportMission() {
  try {
    const missionData = missionStore.exportMission();
    const data = JSON.stringify(missionData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mission-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    $q.notify({
      type: 'positive',
      message: 'Mission exported successfully',
      position: 'top',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    $q.notify({
      type: 'negative',
      message: 'Failed to export mission',
      caption: errorMsg,
      position: 'top',
    });
  }
}

function importMission(missionData: MissionData) {
  missionStore.importMission(missionData);
  showImportDialog.value = false;

  $q.notify({
    type: 'positive',
    message: 'Mission imported successfully',
    position: 'top',
  });
}
</script>

<style lang="scss" scoped>
.mission-planner {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.planner-header {
  border-bottom: 1px solid var(--q-color-grey-3);

  .body--dark & {
    border-color: var(--q-color-grey-8);
  }
}

.planner-content {
  flex: 1;
  min-height: 0;
}

.map-section {
  position: relative;
}

.side-panel {
  width: 350px;
  border-left: 1px solid var(--q-color-grey-3);
  background: var(--q-color-grey-1);

  .body--dark & {
    border-color: var(--q-color-grey-8);
    background: var(--q-color-grey-9);
  }
}
</style>
