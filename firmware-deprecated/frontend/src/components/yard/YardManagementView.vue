<template>
  <div class="yard-management-view">
    <!-- Header -->
    <div class="yard-management-view__header">
      <div class="yard-management-view__title-section">
        <h1 class="yard-management-view__title">Yard Management</h1>
        <div class="yard-management-view__subtitle">
          Zone mapping, boundary management, and yard configuration
        </div>
      </div>

      <div class="yard-management-view__actions">
        <q-btn
          color="positive"
          icon="add_location"
          label="Add Zone"
          @click="showCreateZoneDialog = true"
        />

        <q-btn
          color="secondary"
          icon="map"
          label="Map Editor"
          outline
          @click="showMapEditor = true"
        />

        <q-btn
          color="info"
          icon="settings"
          label="Yard Settings"
          outline
          @click="showYardSettings = true"
        />
      </div>
    </div>

    <!-- Yard Overview Cards -->
    <div class="yard-management-view__overview">
      <div class="row q-gutter-md">
        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="yard-management-view__overview-card">
            <q-card-section>
              <div class="yard-management-view__overview-content">
                <q-icon name="landscape" color="primary" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ yardStats.totalArea }}</div>
                  <div class="text-caption text-grey-6">Total Area (m²)</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="yard-management-view__overview-card">
            <q-card-section>
              <div class="yard-management-view__overview-content">
                <q-icon name="grid_on" color="positive" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ yardStats.zones }}</div>
                  <div class="text-caption text-grey-6">Active Zones</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="yard-management-view__overview-card">
            <q-card-section>
              <div class="yard-management-view__overview-content">
                <q-icon name="linear_scale" color="warning" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ yardStats.boundaries }}</div>
                  <div class="text-caption text-grey-6">Boundaries</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-lg-3">
          <q-card class="yard-management-view__overview-card">
            <q-card-section>
              <div class="yard-management-view__overview-content">
                <q-icon name="home" color="info" size="32px" />
                <div>
                  <div class="text-h4 text-weight-bold">{{ yardStats.dockingStations }}</div>
                  <div class="text-caption text-grey-6">Docking Stations</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="yard-management-view__content">
      <q-tabs v-model="activeTab" class="text-primary" indicator-color="primary" align="left">
        <q-tab name="map" icon="map" label="Interactive Map" />
        <q-tab name="zones" icon="grid_on" label="Zone Management" />
        <q-tab name="boundaries" icon="linear_scale" label="Boundaries" />
        <q-tab name="obstacles" icon="warning" label="Obstacles" />
        <q-tab name="settings" icon="settings" label="Yard Settings" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- Interactive Map Panel -->
        <q-tab-panel name="map" class="q-pa-none">
          <YardMap
            :zones="zones"
            :boundaries="boundaries"
            :obstacles="obstacles"
            :docking-stations="dockingStations"
            :selected-zone="selectedZone"
            @zone-select="handleZoneSelect"
            @zone-edit="handleZoneEdit"
            @boundary-edit="handleBoundaryEdit"
            @obstacle-add="handleObstacleAdd"
            @map-click="handleMapClick"
          />
        </q-tab-panel>

        <!-- Zone Management Panel -->
        <q-tab-panel name="zones" class="q-pa-none">
          <ZoneManagement
            :zones="zones"
            @zone-create="handleZoneCreate"
            @zone-edit="handleZoneEdit"
            @zone-delete="handleZoneDelete"
            @zone-toggle="handleZoneToggle"
          />
        </q-tab-panel>

        <!-- Boundaries Panel -->
        <q-tab-panel name="boundaries" class="q-pa-none">
          <BoundaryManagement
            :boundaries="boundaries"
            @boundary-create="handleBoundaryCreate"
            @boundary-edit="handleBoundaryEdit"
            @boundary-delete="handleBoundaryDelete"
            @boundary-calibrate="handleBoundaryCalibrate"
          />
        </q-tab-panel>

        <!-- Obstacles Panel -->
        <q-tab-panel name="obstacles" class="q-pa-none">
          <ObstacleManagement
            :obstacles="obstacles"
            @obstacle-add="handleObstacleAdd"
            @obstacle-edit="handleObstacleEdit"
            @obstacle-delete="handleObstacleDelete"
            @obstacle-detection="handleObstacleDetection"
          />
        </q-tab-panel>

        <!-- Yard Settings Panel -->
        <q-tab-panel name="settings" class="q-pa-none">
          <YardSettings
            :settings="yardSettings"
            @settings-update="handleSettingsUpdate"
            @coordinate-system="handleCoordinateSystem"
            @calibration="handleCalibration"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- Create Zone Dialog -->
    <q-dialog v-model="showCreateZoneDialog" position="right" full-height>
      <ZoneCreateDialog @save="handleZoneCreate" @close="showCreateZoneDialog = false" />
    </q-dialog>

    <!-- Map Editor Dialog -->
    <q-dialog v-model="showMapEditor" maximized>
      <div class="column fit">
        <div class="row justify-between items-center q-pa-md bg-primary text-white">
          <div class="text-h6">Yard Map Editor</div>
          <q-btn v-close-popup icon="close" flat round dense @click="showMapEditor = false" />
        </div>
        <div class="col">
          <YardMap
            :zones="zones"
            :boundaries="boundaries"
            :obstacles="obstacles"
            :docking-stations="dockingStations"
            @zone-select="handleZoneSelect"
            @zone-edit="handleZoneEdit"
          />
        </div>
        <div class="row q-pa-md bg-white">
          <q-space />
          <q-btn color="primary" label="Save Changes" @click="handleMapSave" />
          <q-btn color="grey" label="Cancel" flat class="q-ml-sm" @click="showMapEditor = false" />
        </div>
      </div>
    </q-dialog>

    <!-- Yard Settings Dialog -->
    <q-dialog v-model="showYardSettings" position="right" full-height>
      <div class="column fit">
        <div class="row justify-between items-center q-pa-md bg-primary text-white">
          <div class="text-h6">Yard Settings</div>
          <q-btn v-close-popup icon="close" flat round dense @click="showYardSettings = false" />
        </div>
        <div class="col">
          <YardSettings :settings="yardSettings" />
        </div>
        <div class="row q-pa-md bg-white">
          <q-space />
          <q-btn color="primary" label="Save Settings" @click="handleSettingsSave" />
          <q-btn
            color="grey"
            label="Cancel"
            flat
            class="q-ml-sm"
            @click="showYardSettings = false"
          />
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Components
import YardMap from './YardMap.vue'
import ZoneManagement from './ZoneManagement.vue'
import BoundaryManagement from './BoundaryManagement.vue'
import ObstacleManagement from './ObstacleManagement.vue'
import YardSettings from './YardSettings.vue'
import ZoneCreateDialog from './ZoneCreateDialog.vue'

// Types
interface Zone {
  id: string
  name: string
  type: 'lawn' | 'garden' | 'path' | 'restricted'
  coordinates: Array<{ lat: number; lng: number }>
  area: number
  priority: number
  enabled: boolean
  settings: {
    cuttingHeight: number
    mowingPattern: string
    frequency: string
  }
  color: string
  createdAt: string
  updatedAt: string
}

interface Boundary {
  id: string
  name: string
  type: 'perimeter' | 'exclusion' | 'guide'
  coordinates: Array<{ lat: number; lng: number }>
  signal: 'wire' | 'virtual' | 'gps'
  strength: number
  active: boolean
  createdAt: string
}

interface Obstacle {
  id: string
  name: string
  type: 'static' | 'temporary' | 'seasonal'
  shape: 'circle' | 'rectangle' | 'polygon'
  position: { lat: number; lng: number }
  dimensions: { width: number; height: number; radius?: number }
  detected: boolean
  createdAt: string
}

interface DockingStation {
  id: string
  name: string
  position: { lat: number; lng: number }
  type: 'primary' | 'secondary'
  status: 'active' | 'inactive' | 'maintenance'
  connectedMachines: string[]
}

interface YardSettingsConfig {
  coordinateSystem: 'gps' | 'local'
  units: 'metric' | 'imperial'
  mapProvider: 'google' | 'openstreet' | 'satellite'
  autoMapping: boolean
  obstacleDetection: boolean
  weatherIntegration: boolean
  defaultCuttingHeight: number
  safetyMargin: number
}

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('map')
const showCreateZoneDialog = ref(false)
const showMapEditor = ref(false)
const showYardSettings = ref(false)
const selectedZone = ref<Zone | null>(null)

// Yard statistics
const yardStats = ref({
  totalArea: 1250,
  zones: 8,
  boundaries: 3,
  dockingStations: 2
})

// Mock data
const zones = ref<Zone[]>([
  {
    id: '1',
    name: 'Front Lawn',
    type: 'lawn',
    coordinates: [
      { lat: 40.7128, lng: -74.006 },
      { lat: 40.713, lng: -74.006 },
      { lat: 40.713, lng: -74.0055 },
      { lat: 40.7128, lng: -74.0055 }
    ],
    area: 450,
    priority: 1,
    enabled: true,
    settings: {
      cuttingHeight: 40,
      mowingPattern: 'parallel',
      frequency: 'daily'
    },
    color: '#4CAF50',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Back Garden',
    type: 'garden',
    coordinates: [
      { lat: 40.7125, lng: -74.006 },
      { lat: 40.7127, lng: -74.006 },
      { lat: 40.7127, lng: -74.0055 },
      { lat: 40.7125, lng: -74.0055 }
    ],
    area: 320,
    priority: 2,
    enabled: true,
    settings: {
      cuttingHeight: 50,
      mowingPattern: 'random',
      frequency: 'weekly'
    },
    color: '#2196F3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
])

const boundaries = ref<Boundary[]>([
  {
    id: '1',
    name: 'Main Perimeter',
    type: 'perimeter',
    coordinates: [
      { lat: 40.712, lng: -74.0065 },
      { lat: 40.7135, lng: -74.0065 },
      { lat: 40.7135, lng: -74.005 },
      { lat: 40.712, lng: -74.005 }
    ],
    signal: 'wire',
    strength: 85,
    active: true,
    createdAt: new Date().toISOString()
  }
])

const obstacles = ref<Obstacle[]>([
  {
    id: '1',
    name: 'Garden Shed',
    type: 'static',
    shape: 'rectangle',
    position: { lat: 40.7129, lng: -74.0058 },
    dimensions: { width: 3, height: 4 },
    detected: true,
    createdAt: new Date().toISOString()
  }
])

const dockingStations = ref<DockingStation[]>([
  {
    id: '1',
    name: 'Main Dock',
    position: { lat: 40.7132, lng: -74.0062 },
    type: 'primary',
    status: 'active',
    connectedMachines: ['mower-01', 'mower-02']
  }
])

const yardSettings = ref<YardSettingsConfig>({
  coordinateSystem: 'gps',
  units: 'metric',
  mapProvider: 'satellite',
  autoMapping: true,
  obstacleDetection: true,
  weatherIntegration: true,
  defaultCuttingHeight: 40,
  safetyMargin: 0.5
})

// Methods
const handleZoneSelect = (zone: Zone) => {
  selectedZone.value = zone
  $q.notify({
    type: 'info',
    message: `Selected zone: ${zone.name}`
  })
}

const handleZoneEdit = (zone: Zone) => {
  selectedZone.value = zone
  $q.notify({
    type: 'info',
    message: `Editing zone: ${zone.name}`
  })
}

const handleZoneCreate = (zoneData: Partial<Zone>) => {
  const newZone: Zone = {
    id: Date.now().toString(),
    name: zoneData.name || 'New Zone',
    type: zoneData.type || 'lawn',
    coordinates: zoneData.coordinates || [],
    area: zoneData.area || 0,
    priority: zoneData.priority || zones.value.length + 1,
    enabled: true,
    settings: {
      cuttingHeight: 40,
      mowingPattern: 'random',
      frequency: 'daily'
    },
    color: zoneData.color || '#4CAF50',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  zones.value.push(newZone)
  showCreateZoneDialog.value = false

  $q.notify({
    type: 'positive',
    message: `Zone "${newZone.name}" created successfully`
  })
}

const handleZoneDelete = async (zone: Zone) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Zone',
      message: `Are you sure you want to delete "${zone.name}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = zones.value.findIndex(z => z.id === zone.id)
    if (index !== -1) {
      zones.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Zone deleted successfully'
      })
    }
  }
}

const handleZoneToggle = (zone: Zone) => {
  zone.enabled = !zone.enabled
  zone.updatedAt = new Date().toISOString()

  $q.notify({
    type: zone.enabled ? 'positive' : 'warning',
    message: `Zone ${zone.enabled ? 'enabled' : 'disabled'}`
  })
}

const handleBoundaryCreate = (boundaryData: Partial<Boundary>) => {
  const newBoundary: Boundary = {
    id: Date.now().toString(),
    name: boundaryData.name || 'New Boundary',
    type: boundaryData.type || 'perimeter',
    coordinates: boundaryData.coordinates || [],
    signal: boundaryData.signal || 'wire',
    strength: boundaryData.strength || 100,
    active: true,
    createdAt: new Date().toISOString()
  }

  boundaries.value.push(newBoundary)

  $q.notify({
    type: 'positive',
    message: `Boundary "${newBoundary.name}" created successfully`
  })
}

const handleBoundaryEdit = (boundary: Boundary) => {
  $q.notify({
    type: 'info',
    message: `Editing boundary: ${boundary.name}`
  })
}

const handleBoundaryDelete = async (boundary: Boundary) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Boundary',
      message: `Are you sure you want to delete "${boundary.name}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = boundaries.value.findIndex(b => b.id === boundary.id)
    if (index !== -1) {
      boundaries.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Boundary deleted successfully'
      })
    }
  }
}

const handleBoundaryCalibrate = (boundary: Boundary) => {
  $q.notify({
    type: 'info',
    message: `Calibrating boundary: ${boundary.name}`
  })
}

const handleObstacleAdd = (obstacleData: Partial<Obstacle>) => {
  const newObstacle: Obstacle = {
    id: Date.now().toString(),
    name: obstacleData.name || 'New Obstacle',
    type: obstacleData.type || 'static',
    shape: obstacleData.shape || 'circle',
    position: obstacleData.position || { lat: 0, lng: 0 },
    dimensions: obstacleData.dimensions || { width: 1, height: 1 },
    detected: false,
    createdAt: new Date().toISOString()
  }

  obstacles.value.push(newObstacle)

  $q.notify({
    type: 'positive',
    message: `Obstacle "${newObstacle.name}" added successfully`
  })
}

const handleObstacleEdit = (obstacle: Obstacle) => {
  $q.notify({
    type: 'info',
    message: `Editing obstacle: ${obstacle.name}`
  })
}

const handleObstacleDelete = async (obstacle: Obstacle) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Obstacle',
      message: `Are you sure you want to delete "${obstacle.name}"?`,
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = obstacles.value.findIndex(o => o.id === obstacle.id)
    if (index !== -1) {
      obstacles.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Obstacle deleted successfully'
      })
    }
  }
}

const handleObstacleDetection = () => {
  $q.notify({
    type: 'info',
    message: 'Starting automatic obstacle detection...'
  })
}

const handleSettingsUpdate = (settings: Partial<YardSettingsConfig>) => {
  Object.assign(yardSettings.value, settings)
  showYardSettings.value = false

  $q.notify({
    type: 'positive',
    message: 'Yard settings updated successfully'
  })
}

const handleSettingsSave = () => {
  showYardSettings.value = false
  $q.notify({
    type: 'positive',
    message: 'Yard settings saved successfully'
  })
}

const handleCoordinateSystem = (system: string) => {
  yardSettings.value.coordinateSystem = system as 'gps' | 'local'

  $q.notify({
    type: 'info',
    message: `Coordinate system changed to ${system.toUpperCase()}`
  })
}

const handleCalibration = () => {
  $q.notify({
    type: 'info',
    message: 'Starting yard calibration...'
  })
}

const handleMapClick = (_coordinates: { lat: number; lng: number }) => {
  // Handle map click - could be used for adding markers, etc.
  // For now, just clear selected zone
  selectedZone.value = null
}

const handleMapSave = () => {
  showMapEditor.value = false
  $q.notify({
    type: 'positive',
    message: 'Map changes saved successfully'
  })
}

// Lifecycle
onMounted(() => {
  // Load initial yard data
})
</script>

<style lang="scss" scoped>
.yard-management-view {
  min-height: 100vh;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.yard-management-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark);
    border-bottom-color: var(--q-grey-8);
  }
}

.yard-management-view__title-section {
  display: flex;
  flex-direction: column;
}

.yard-management-view__title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.yard-management-view__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-top: 4px;
}

.yard-management-view__actions {
  display: flex;
  gap: 8px;
}

.yard-management-view__overview {
  padding: 24px;
}

.yard-management-view__overview-card {
  height: 100%;
}

.yard-management-view__overview-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.yard-management-view__content {
  background: white;
  min-height: 600px;

  .body--dark & {
    background: var(--q-dark);
  }

  .q-tabs {
    padding: 0 24px;
  }

  .q-tab-panels {
    background: transparent;
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .yard-management-view__header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .yard-management-view__actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 599px) {
  .yard-management-view__header {
    padding: 16px;
  }

  .yard-management-view__overview {
    padding: 16px;
  }

  .yard-management-view__actions {
    flex-wrap: wrap;
    gap: 8px;

    .q-btn {
      flex: 1;
      min-width: 120px;
    }
  }

  .yard-management-view__title {
    font-size: 1.5rem;
  }
}
</style>
