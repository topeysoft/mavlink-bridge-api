<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useZonesStore } from '@/stores/zones'
import { useMissionsStore } from '@/stores/missions'
import { useFeaturesStore } from '@/stores/features'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import type { Mission } from '@/types'

const router = useRouter()
const route = useRoute()
const zonesStore = useZonesStore()
const missionsStore = useMissionsStore()
const featuresStore = useFeaturesStore()
const { success, error, info } = useNotifications()
const dialog = useDialog()

// Get mission ID from route (if editing)
const missionId = computed(() => route.params.id as string | undefined)
const isEditMode = computed(() => !!missionId.value)

// Breadcrumb items
const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Missions', to: '/missions' },
  { label: isEditMode.value ? 'Edit Mission' : 'Create Mission' }
])

// Current step (1-3)
const currentStep = ref(1)

// Step 1: Mission Details
const missionName = ref('')
const missionType = ref('mowing')
const missionDescription = ref('')
const scheduleType = ref('now')
const scheduleTime = ref('')
const recurringFrequency = ref('daily')
const recurringTime = ref('09:00')

// Step 2: Zone Selection
const selectedZones = ref<string[]>([])
const zoneSearchQuery = ref('')

// Step 3: Additional Settings
const priority = ref('normal')
const notifyOnComplete = ref(true)
const autoReturn = ref(true)

// Computed
const filteredZones = computed(() => {
  if (!zoneSearchQuery.value) return zonesStore.zones
  const query = zoneSearchQuery.value.toLowerCase()
  return zonesStore.zones.filter(zone =>
    zone.name.toLowerCase().includes(query) ||
    zone.type.toLowerCase().includes(query)
  )
})

const totalSelectedArea = computed(() => {
  return selectedZones.value.reduce((sum, zoneId) => {
    const zone = zonesStore.zones.find(z => z.id === zoneId)
    return sum + (zone ? (zone as any).area || 0 : 0)
  }, 0)
})

const canProceedStep1 = computed(() => {
  return missionName.value.trim() !== '' && missionType.value !== ''
})

const canProceedStep2 = computed(() => {
  return selectedZones.value.length > 0
})

const formattedSchedule = computed(() => {
  if (scheduleType.value === 'now') return 'Start Immediately'
  if (scheduleType.value === 'later' && scheduleTime.value) {
    return `Scheduled for ${new Date(scheduleTime.value).toLocaleString()}`
  }
  if (scheduleType.value === 'recurring') {
    return `${recurringFrequency.value.charAt(0).toUpperCase() + recurringFrequency.value.slice(1)} at ${recurringTime.value}`
  }
  return 'Not configured'
})

// Methods
const goToStep = (step: number) => {
  if (step < 1 || step > 3) return
  currentStep.value = step
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const nextStep = () => {
  if (currentStep.value === 1 && !canProceedStep1.value) {
    error('Please fill in all required fields')
    return
  }
  if (currentStep.value === 2 && !canProceedStep2.value) {
    error('Please select at least one zone')
    return
  }
  if (currentStep.value < 3) {
    goToStep(currentStep.value + 1)
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    goToStep(currentStep.value - 1)
  }
}

const toggleZoneSelection = (zoneId: string) => {
  const index = selectedZones.value.indexOf(zoneId)
  if (index > -1) {
    selectedZones.value.splice(index, 1)
  } else {
    selectedZones.value.push(zoneId)
  }
}

const isZoneSelected = (zoneId: string) => {
  return selectedZones.value.includes(zoneId)
}

const removeSelectedZone = (zoneId: string) => {
  const index = selectedZones.value.indexOf(zoneId)
  if (index > -1) {
    selectedZones.value.splice(index, 1)
  }
}

const saveDraft = () => {
  const draft = {
    missionName: missionName.value,
    missionType: missionType.value,
    missionDescription: missionDescription.value,
    scheduleType: scheduleType.value,
    scheduleTime: scheduleTime.value,
    recurringFrequency: recurringFrequency.value,
    recurringTime: recurringTime.value,
    selectedZones: selectedZones.value,
    priority: priority.value,
    notifyOnComplete: notifyOnComplete.value,
    autoReturn: autoReturn.value
  }
  localStorage.setItem('mission_draft', JSON.stringify(draft))
  info('Draft saved')
}

const loadDraft = () => {
  const saved = localStorage.getItem('mission_draft')
  if (saved) {
    try {
      const draft = JSON.parse(saved)
      missionName.value = draft.missionName || ''
      missionType.value = draft.missionType || 'mowing'
      missionDescription.value = draft.missionDescription || ''
      scheduleType.value = draft.scheduleType || 'now'
      scheduleTime.value = draft.scheduleTime || ''
      recurringFrequency.value = draft.recurringFrequency || 'daily'
      recurringTime.value = draft.recurringTime || '09:00'
      selectedZones.value = draft.selectedZones || []
      priority.value = draft.priority || 'normal'
      notifyOnComplete.value = draft.notifyOnComplete !== false
      autoReturn.value = draft.autoReturn !== false
      info('Draft loaded')
    } catch (e) {
      console.error('Failed to load draft:', e)
    }
  }
}

const loadMissionForEditing = (mission: Mission) => {
  missionName.value = mission.name
  missionType.value = 'mowing' // Default to mowing since we don't store this separately yet
  missionDescription.value = '' // Not stored in mission object

  // Determine schedule type and values from mission
  if (mission.type === 'once') {
    scheduleType.value = 'later'
    scheduleTime.value = new Date(mission.schedule.startTime).toISOString().slice(0, 16)
  } else {
    scheduleType.value = 'recurring'
    if (mission.type === 'daily') {
      recurringFrequency.value = 'daily'
    } else if (mission.type === 'weekly') {
      recurringFrequency.value = 'weekly'
    } else if (mission.type === 'monthly') {
      recurringFrequency.value = 'monthly'
    }
    const time = new Date(mission.schedule.startTime)
    recurringTime.value = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
  }

  selectedZones.value = [...mission.zoneIds]
  priority.value = mission.priority
}

const createMission = async () => {
  if (!canProceedStep1.value || !canProceedStep2.value) {
    error('Please complete all required fields')
    return
  }

  // Determine mission type based on schedule type
  let missionType_: 'once' | 'daily' | 'weekly' | 'monthly'
  if (scheduleType.value === 'now' || scheduleType.value === 'later') {
    missionType_ = 'once'
  } else {
    // For recurring, use the frequency as the mission type
    if (recurringFrequency.value === 'daily') {
      missionType_ = 'daily'
    } else if (recurringFrequency.value === 'weekly') {
      missionType_ = 'weekly'
    } else if (recurringFrequency.value === 'monthly') {
      missionType_ = 'monthly'
    } else {
      missionType_ = 'daily' // Default
    }
  }

  // Determine start time
  let startTime: string
  if (scheduleType.value === 'now') {
    startTime = new Date().toISOString()
  } else if (scheduleType.value === 'later') {
    startTime = new Date(scheduleTime.value).toISOString()
  } else {
    // For recurring, use today's date with the specified time
    const today = new Date().toISOString().split('T')[0]
    startTime = new Date(`${today}T${recurringTime.value}`).toISOString()
  }

  // Build schedule object without undefined values
  const schedule: Mission['schedule'] = {
    startTime
  }

  if (missionType_ === 'weekly') {
    schedule.daysOfWeek = [1, 2, 3, 4, 5] // Default to weekdays
  }

  if (missionType_ === 'monthly') {
    schedule.dayOfMonth = 1 // Default to first day
  }

  const missionData: Mission = {
    id: isEditMode.value ? missionId.value! : crypto.randomUUID(),
    name: missionName.value,
    type: missionType_,
    zoneIds: [...selectedZones.value], // Clone the array
    schedule,
    priority: priority.value as 'low' | 'normal' | 'high' | 'critical',
    enabled: true,
    created: isEditMode.value
      ? missionsStore.getMissionById(missionId.value!)?.created || new Date().toISOString()
      : new Date().toISOString(),
    lastModified: new Date().toISOString()
  }

  try {
    if (isEditMode.value) {
      console.log('Updating mission with data:', JSON.stringify(missionData, null, 2))
      await missionsStore.updateMission(missionId.value!, missionData)
      success(`Mission "${missionData.name}" updated successfully`)
    } else {
      console.log('Creating mission with data:', JSON.stringify(missionData, null, 2))
      await missionsStore.addMission(missionData)
      success(`Mission "${missionData.name}" created successfully`)
    }

    // Clear draft
    localStorage.removeItem('mission_draft')

    // Navigate back to missions
    router.push('/missions')
  } catch (err) {
    console.error('Mission save error:', err)
    error(`Failed to ${isEditMode.value ? 'update' : 'create'} mission: ${(err as Error).message}`)
  }
}

const backToMissions = async () => {
  const confirmed = await dialog.confirm(
    'Are you sure you want to go back? Any unsaved changes will be lost.',
    'Unsaved Changes'
  )
  if (confirmed) {
    router.push('/missions')
  }
}

const goToCreateZone = () => {
  router.push('/zones')
}

// Auto-save draft every 30 seconds
let autoSaveInterval: number | null = null
onMounted(() => {
  // If editing, load the mission data
  if (isEditMode.value && missionId.value) {
    const mission = missionsStore.getMissionById(missionId.value)
    if (mission) {
      loadMissionForEditing(mission)
    } else {
      error('Mission not found')
      router.push('/missions')
      return
    }
  } else {
    // Only load draft when creating new mission
    loadDraft()
  }

  autoSaveInterval = window.setInterval(saveDraft, 30000)
})

// Cleanup
watch(() => currentStep.value, () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
  }
})

// Watch schedule type to show/hide conditional fields
watch(scheduleType, (newValue) => {
  if (newValue === 'now') {
    scheduleTime.value = ''
  }
})
</script>

<template>
  <div class="mission-editor-view">
    <Breadcrumb :items="breadcrumbItems" />

    <div class="mission-editor-container">
      <!-- Editor Header -->
      <div class="mission-editor-header">
        <div class="header-left">
          <h1 class="editor-title">{{ isEditMode ? 'Edit Mission' : 'Create Mission' }}</h1>
        </div>
        <div class="editor-actions">
          <button v-if="!isEditMode" class="btn btn-secondary" @click="saveDraft">Save Draft</button>
          <button class="btn btn-primary" @click="createMission">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {{ isEditMode ? 'Update Mission' : 'Create Mission' }}
          </button>
        </div>
      </div>

      <!-- Progress Steps -->
      <div class="mission-editor-progress">
        <div
          class="progress-step"
          :class="{ active: currentStep === 1, completed: currentStep > 1 }"
          @click="goToStep(1)"
        >
          <div class="step-indicator">
            <span class="step-number">1</span>
            <svg class="step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span class="step-title">Mission Details</span>
        </div>
        <div class="progress-connector"></div>
        <div
          class="progress-step"
          :class="{ active: currentStep === 2, completed: currentStep > 2 }"
          @click="canProceedStep1 && goToStep(2)"
        >
          <div class="step-indicator">
            <span class="step-number">2</span>
            <svg class="step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span class="step-title">Select Zones</span>
        </div>
        <div class="progress-connector"></div>
        <div
          class="progress-step"
          :class="{ active: currentStep === 3 }"
          @click="canProceedStep1 && canProceedStep2 && goToStep(3)"
        >
          <div class="step-indicator">
            <span class="step-number">3</span>
            <svg class="step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span class="step-title">Configure & Review</span>
        </div>
      </div>

      <!-- Editor Content -->
      <div class="mission-editor-content">
        <!-- Step 1: Mission Details -->
        <div v-show="currentStep === 1" class="editor-step">
          <div class="editor-section">
            <h2>Mission Information</h2>
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label>Mission Name *</label>
                <input
                  v-model="missionName"
                  type="text"
                  class="form-input"
                  placeholder="e.g., Front Yard Weekly Mowing"
                >
              </div>
              <div class="form-group" style="flex: 1;">
                <label>Mission Type *</label>
                <select v-model="missionType" class="form-select">
                  <option value="mowing">Lawn Mowing</option>
                  <option value="snow">Snow Removal</option>
                  <option value="blowing">Leaf Blowing</option>
                  <option value="patrol">Patrol</option>
                  <option value="transport">Cart Transport</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea
                v-model="missionDescription"
                class="form-input"
                rows="3"
                placeholder="Optional description of this mission..."
              ></textarea>
            </div>
          </div>

          <div class="editor-section">
            <h2>Scheduling</h2>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label>When to Run *</label>
                <select v-model="scheduleType" class="form-select">
                  <option value="now">Start Immediately</option>
                  <option value="later">Schedule for Later</option>
                  <option value="recurring">Recurring Schedule</option>
                </select>
              </div>
              <div v-if="scheduleType === 'later'" class="form-group" style="flex: 1;">
                <label>Start Time</label>
                <input v-model="scheduleTime" type="datetime-local" class="form-input">
              </div>
            </div>
            <div v-if="scheduleType === 'recurring'" class="recurring-options">
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label>Frequency</label>
                  <select v-model="recurringFrequency" class="form-select">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div class="form-group" style="flex: 1;">
                  <label>Time of Day</label>
                  <input v-model="recurringTime" type="time" class="form-input">
                </div>
              </div>
            </div>
          </div>

          <div class="editor-step-footer">
            <button class="btn btn-primary" @click="nextStep">
              Next: Select Zones
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- Step 2: Zone Selection -->
        <div v-show="currentStep === 2" class="editor-step">
          <div class="editor-section">
            <div class="editor-section-header">
              <h2>Coverage Zones</h2>
              <button class="btn btn-primary" @click="goToCreateZone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create New Zone
              </button>
            </div>

            <input
              v-model="zoneSearchQuery"
              type="text"
              class="form-input"
              placeholder="Search zones..."
              style="margin-bottom: 1.5rem;"
            >

            <div class="editor-zone-grid">
              <div
                v-for="zone in filteredZones"
                :key="zone.id"
                class="zone-card"
                :class="{ selected: isZoneSelected(zone.id) }"
                @click="toggleZoneSelection(zone.id)"
              >
                <div class="zone-card-header">
                  <input
                    type="checkbox"
                    :checked="isZoneSelected(zone.id)"
                    @click.stop="toggleZoneSelection(zone.id)"
                  >
                  <span class="zone-name">{{ zone.name }}</span>
                </div>
                <div class="zone-card-body">
                  <div class="zone-type">{{ zone.type }}</div>
                  <div class="zone-area">{{ (zone as any).area || 0 }} acres</div>
                </div>
              </div>
            </div>

            <div v-if="selectedZones.length > 0" class="editor-selected-zones">
              <h3>Selected Zones ({{ selectedZones.length }})</h3>
              <div class="selected-zones-container">
                <div
                  v-for="zoneId in selectedZones"
                  :key="zoneId"
                  class="selected-zone-chip"
                >
                  {{ zonesStore.zones.find(z => z.id === zoneId)?.name }}
                  <button @click="removeSelectedZone(zoneId)">×</button>
                </div>
              </div>
              <div class="mission-zone-summary">
                <strong>Total Coverage Area:</strong> {{ totalSelectedArea.toFixed(2) }} acres
              </div>
            </div>
          </div>

          <div class="editor-step-footer">
            <button class="btn btn-secondary" @click="previousStep">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Back
            </button>
            <button class="btn btn-primary" @click="nextStep">
              Next: Review
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- Step 3: Review & Configure -->
        <div v-show="currentStep === 3" class="editor-step">
          <div class="editor-review-grid">
            <div class="editor-section">
              <h2>Mission Summary</h2>
              <div class="review-item">
                <span class="review-label">Name:</span>
                <span class="review-value">{{ missionName || '-' }}</span>
              </div>
              <div class="review-item">
                <span class="review-label">Type:</span>
                <span class="review-value">{{ missionType }}</span>
              </div>
              <div class="review-item">
                <span class="review-label">Schedule:</span>
                <span class="review-value">{{ formattedSchedule }}</span>
              </div>
              <div class="review-item">
                <span class="review-label">Description:</span>
                <span class="review-value">{{ missionDescription || 'None' }}</span>
              </div>
            </div>

            <div class="editor-section">
              <h2>Coverage Zones</h2>
              <div class="review-zones-list">
                <div
                  v-for="zoneId in selectedZones"
                  :key="zoneId"
                  class="review-zone-item"
                >
                  {{ zonesStore.zones.find(z => z.id === zoneId)?.name }}
                </div>
              </div>
              <div class="review-item">
                <span class="review-label">Total Area:</span>
                <span class="review-value">{{ totalSelectedArea.toFixed(2) }} acres</span>
              </div>
            </div>

            <div class="editor-section">
              <h2>Additional Settings</h2>
              <div class="form-group">
                <label>Priority Level</label>
                <select v-model="priority" class="form-select">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input v-model="notifyOnComplete" type="checkbox">
                  Notify when mission completes
                </label>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input v-model="autoReturn" type="checkbox">
                  Return to home after completion
                </label>
              </div>
            </div>
          </div>

          <div class="editor-step-footer">
            <button class="btn btn-secondary" @click="previousStep">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Back
            </button>
            <button class="btn btn-primary" @click="createMission">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {{ isEditMode ? 'Update Mission' : 'Create Mission' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.mission-editor-view {
  min-height: 100vh;
  padding: var(--spacing-xl);
  background: var(--bg-primary);
}

.mission-editor-container {
  max-width: 1200px;
  margin: 0 auto;
}

.mission-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-2xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  gap: var(--spacing-lg);

  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .editor-title {
    margin: 0;
  }

  .switch-mode-link {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-secondary);
      border-color: var(--primary-green);
      color: var(--primary-green);
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .editor-actions {
    display: flex;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .btn svg {
    width: 18px;
    height: 18px;
    margin-right: 8px;
  }
}

.mission-editor-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-2xl);
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);

  .progress-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    transition: all var(--transition-normal);
    opacity: 0.5;

    &.active,
    &.completed {
      opacity: 1;
    }

    &.active .step-indicator {
      background: var(--primary-green);
      border-color: var(--primary-green);
      color: white;
    }

    &.completed .step-indicator {
      background: var(--status-success);
      border-color: var(--status-success);
      color: white;

      .step-number {
        display: none;
      }

      .step-check {
        display: block;
      }
    }

    .step-indicator {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid var(--border-color);
      background: var(--bg-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--font-size-lg);
      transition: all var(--transition-normal);

      .step-check {
        display: none;
        width: 24px;
        height: 24px;
      }
    }

    .step-title {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    &.active .step-title {
      color: var(--text-primary);
      font-weight: 600;
    }
  }

  .progress-connector {
    width: 80px;
    height: 2px;
    background: var(--border-color);
    margin: 0 var(--spacing-md);
    margin-bottom: 24px;
  }
}

.mission-editor-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
}

.editor-step {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.editor-section {
  margin-bottom: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-lg);
  }

  .editor-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
}

.form-row {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;

  label {
    font-weight: 500;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
  }
}

.form-input,
.form-select {
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  transition: border-color var(--transition-normal);

  &:focus {
    outline: none;
    border-color: var(--primary-green);
  }
}

.editor-zone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  .zone-card {
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    cursor: pointer;
    transition: all var(--transition-normal);
    background: var(--bg-primary);

    &:hover {
      border-color: var(--primary-green);
      transform: translateY(-2px);
    }

    &.selected {
      border-color: var(--primary-green);
      background: rgba(44, 95, 45, 0.1);
    }

    .zone-card-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);

      .zone-name {
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .zone-card-body {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }
}

.editor-selected-zones {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--border-color);

  h3 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-md);
  }

  .selected-zones-container {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }

  .selected-zone-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--primary-green);
    color: white;
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);

    button {
      background: none;
      border: none;
      color: white;
      font-size: var(--font-size-lg);
      cursor: pointer;
      padding: 0;
      line-height: 1;

      &:hover {
        opacity: 0.8;
      }
    }
  }

  .mission-zone-summary {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
}

.editor-review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);

  .review-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);

    .review-label {
      font-weight: 500;
      color: var(--text-secondary);
    }

    .review-value {
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .review-zones-list {
    margin-bottom: var(--spacing-md);

    .review-zone-item {
      padding: var(--spacing-sm);
      background: var(--bg-primary);
      border-radius: var(--radius-sm);
      margin-bottom: var(--spacing-sm);
    }
  }
}

.editor-step-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  margin-top: var(--spacing-2xl);

  .btn svg {
    width: 18px;
    height: 18px;

    &:first-child {
      margin-right: 8px;
    }

    &:last-child {
      margin-left: 8px;
    }
  }
}

.recurring-options {
  margin-top: var(--spacing-md);
}
</style>
