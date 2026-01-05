<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMissionsStore } from '@/stores/missions'
import { useVehicleStore } from '@/stores/vehicle'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import type { Waypoint } from '@/types/waypoint'
import WaypointEditor from '@/components/mission/WaypointEditor.vue'
import MissionPreview from '@/components/mission/MissionPreview.vue'
import GeofenceManager from '@/components/mission/GeofenceManager.vue'
import RallyPointManager from '@/components/mission/RallyPointManager.vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const router = useRouter()
const route = useRoute()
const missionsStore = useMissionsStore()
const vehicleStore = useVehicleStore()
const { success, error, info } = useNotifications()
const dialog = useDialog()

// Tab state
type TabType = 'waypoints' | 'geofences' | 'rally-points'
const activeTab = ref<TabType>('waypoints')

const missionName = ref('')
const missionDescription = ref('')
const waypoints = ref<Waypoint[]>([])
const homePosition = ref(vehicleStore.vehicleState.latitude && vehicleStore.vehicleState.longitude
  ? {
      latitude: vehicleStore.vehicleState.latitude,
      longitude: vehicleStore.vehicleState.longitude,
      altitude: vehicleStore.vehicleState.altitude
    }
  : undefined
)

const isEditing = ref(false)
const planId = ref<string | null>(null)
const showPreview = ref(false)

const currentPlan = computed(() => {
  if (!planId.value) return null
  return missionsStore.missionPlans.find(p => p.id === planId.value) || null
})

const canSave = computed(() => {
  return missionName.value.trim() !== '' && waypoints.value.length > 0
})

onMounted(() => {
  // Check if editing existing plan
  const id = route.query.edit as string
  if (id) {
    const plan = missionsStore.missionPlans.find(p => p.id === id)
    if (plan) {
      planId.value = plan.id
      missionName.value = plan.name
      missionDescription.value = plan.description || ''
      waypoints.value = [...plan.waypoints]
      homePosition.value = plan.homePosition
      isEditing.value = true
      missionsStore.setCurrentMissionPlan(plan.id)
    }
  }
})

function handleWaypointsUpdate(updated: Waypoint[]) {
  waypoints.value = updated
}

function handleHomePositionUpdate(position: { latitude: number; longitude: number; altitude: number }) {
  homePosition.value = position
}

async function saveMissionPlan() {
  if (!canSave.value) {
    error('Please provide a mission name and at least one waypoint')
    return
  }

  if (isEditing.value && planId.value) {
    // Update existing plan
    missionsStore.updateMissionPlan(planId.value, {
      name: missionName.value,
      description: missionDescription.value,
      waypoints: waypoints.value,
      homePosition: homePosition.value,
    })
    success(`Mission "${missionName.value}" updated`)
  } else {
    // Create new plan
    const plan = missionsStore.createMissionPlan(missionName.value, missionDescription.value)
    missionsStore.updateMissionPlan(plan.id, {
      waypoints: waypoints.value,
      homePosition: homePosition.value,
    })
    planId.value = plan.id
    isEditing.value = true
    success(`Mission "${missionName.value}" created`)
  }

  showPreview.value = true
}

async function handleUpload() {
  if (!currentPlan.value) {
    error('Please save the mission before uploading')
    return
  }

  const confirmed = await dialog.confirm(
    `Upload mission "${currentPlan.value.name}" to vehicle?\n\nThis will replace any existing mission on the vehicle.`,
    'Upload Mission'
  )

  if (!confirmed) return

  const uploaded = await missionsStore.uploadMissionToVehicle(currentPlan.value)

  if (uploaded) {
    success(`Mission uploaded to vehicle successfully`)
  } else {
    error('Failed to upload mission to vehicle')
  }
}

function handleExport() {
  if (!currentPlan.value) {
    error('Please save the mission before exporting')
    return
  }

  missionsStore.exportMissionPlan(currentPlan.value)
  success('Mission exported successfully')
}

async function handleNew() {
  if (waypoints.value.length > 0) {
    const confirmed = await dialog.confirm('Create a new mission? Any unsaved changes will be lost.', 'New Mission')
    if (!confirmed) return
  }

  missionName.value = ''
  missionDescription.value = ''
  waypoints.value = []
  homePosition.value = vehicleStore.vehicleState.latitude && vehicleStore.vehicleState.longitude
    ? {
        latitude: vehicleStore.vehicleState.latitude,
        longitude: vehicleStore.vehicleState.longitude,
        altitude: vehicleStore.vehicleState.altitude
      }
    : undefined
  planId.value = null
  isEditing.value = false
  showPreview.value = false
  missionsStore.setCurrentMissionPlan(null)
}

async function handleDownload() {
  const confirmed = await dialog.confirm('Download mission from vehicle?\n\nThis will replace the current mission in the planner.', 'Download Mission')

  if (!confirmed) return

  const downloaded = await missionsStore.downloadMissionFromVehicle()

  if (downloaded) {
    missionName.value = downloaded.name
    missionDescription.value = downloaded.description || ''
    waypoints.value = [...downloaded.waypoints]
    homePosition.value = downloaded.homePosition
    success('Mission downloaded from vehicle')
  } else {
    info('No mission found on vehicle')
  }
}

async function goBack() {
  if (waypoints.value.length > 0 && !isEditing.value) {
    const confirmed = await dialog.confirm('Are you sure? Any unsaved changes will be lost.', 'Unsaved Changes')
    if (!confirmed) return
  }
  router.push('/missions')
}
</script>

<template>
  <div class="mission-planner-view">
    <!-- Header -->
    <div class="planner-header">
      <div class="header-content">
        <button class="back-button" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="header-info">
          <h1 class="view-title">Mission Planner</h1>
          <p class="view-description">Plan missions, configure geofences, and set rally points</p>
        </div>
      </div>

      <div class="header-actions" v-if="activeTab === 'waypoints'">
        <Button variant="outline" @click="handleNew">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
          New Mission
        </Button>

        <Button variant="outline" @click="handleDownload" :disabled="missionsStore.isDownloadingMission">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {{ missionsStore.isDownloadingMission ? 'Downloading...' : 'Download from Vehicle' }}
        </Button>

        <Button variant="primary" @click="saveMissionPlan" :disabled="!canSave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          {{ isEditing ? 'Update Mission' : 'Save Mission' }}
        </Button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        class="tab-button"
        :class="{ active: activeTab === 'waypoints' }"
        @click="activeTab = 'waypoints'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Waypoints
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === 'geofences' }"
        @click="activeTab = 'geofences'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
        Geofences
      </button>
      <button
        class="tab-button"
        :class="{ active: activeTab === 'rally-points' }"
        @click="activeTab = 'rally-points'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
        </svg>
        Rally Points
      </button>
    </div>

    <!-- Tab Content: Waypoints -->
    <div v-if="activeTab === 'waypoints'" class="tab-content">
      <!-- Mission Info -->
      <Card>
        <template #header>
          <div class="section-header">
            <div class="card-title">Mission Information</div>
          </div>
        </template>

        <div class="mission-info-form">
          <div class="form-row">
            <div class="form-group">
              <label>Mission Name *</label>
              <input
                v-model="missionName"
                type="text"
                class="form-input"
                placeholder="e.g., Front Yard Perimeter Patrol"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Description</label>
              <textarea
                v-model="missionDescription"
                class="form-input"
                rows="2"
                placeholder="Optional description..."
              ></textarea>
            </div>
          </div>
        </div>
      </Card>

      <!-- Waypoint Editor -->
      <WaypointEditor
        :waypoints="waypoints"
        :homePosition="homePosition"
        @update:waypoints="handleWaypointsUpdate"
        @update:homePosition="handleHomePositionUpdate"
      />
    </div>

    <!-- Tab Content: Geofences -->
    <div v-if="activeTab === 'geofences'" class="tab-content">
      <GeofenceManager />
    </div>

    <!-- Tab Content: Rally Points -->
    <div v-if="activeTab === 'rally-points'" class="tab-content">
      <RallyPointManager />
    </div>

    <!-- Preview Section -->
    <div v-if="showPreview && currentPlan" class="preview-section">
      <MissionPreview :plan="currentPlan" @upload="handleUpload" @export="handleExport" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.mission-planner-view {
  padding: var(--spacing-xl);
  max-width: 1800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.planner-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.header-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    color: var(--primary-green);
  }
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.view-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.view-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.section-header {
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.mission-info-form {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-row {
  display: flex;
  gap: var(--spacing-lg);
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
  }
}

.form-input {
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: inherit;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
  }

  &::placeholder {
    color: var(--text-light);
  }
}

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}

.preview-section {
  margin-top: var(--spacing-lg);
}

.tab-navigation {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: 2px solid var(--border-color);
  margin-bottom: var(--spacing-xl);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  bottom: -2px;

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.active {
    color: var(--primary-green);
    border-bottom-color: var(--primary-green);
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .planner-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;

    button {
      flex: 1;
    }
  }

  .tab-navigation {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-button {
    white-space: nowrap;
    flex-shrink: 0;
  }
}
</style>
