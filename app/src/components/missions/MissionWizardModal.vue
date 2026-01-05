<template>
  <q-dialog
    v-model="isOpen"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="mission-wizard">
      <!-- Header with Progress -->
      <q-card-section class="wizard-header">
        <div class="row items-center q-mb-md">
          <div class="text-h6">Create New Mission</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="handleClose" />
        </div>

        <!-- Step Progress -->
        <q-stepper
          v-model="currentStep"
          ref="stepper"
          flat
          animated
          header-nav
          class="wizard-stepper"
        >
          <q-step
            v-for="(title, index) in stepTitles"
            :key="index + 1"
            :name="index + 1"
            :title="title"
            :icon="getStepIcon(index + 1)"
            :done="currentStep > index + 1"
          />
        </q-stepper>
      </q-card-section>

      <!-- Step Content -->
      <q-card-section class="wizard-body">
        <!-- Step 1: Mission Details -->
        <div v-show="currentStep === 1" class="wizard-step">
          <div class="step-content">
            <div class="text-h6 q-mb-md">Mission Information</div>

            <q-input
              v-model="missionData.name"
              label="Mission Name *"
              outlined
              :rules="[val => !!val || 'Mission name is required']"
              class="q-mb-md"
            />

            <q-select
              v-model="missionData.type"
              :options="missionTypes"
              label="Mission Type"
              outlined
              emit-value
              map-options
              class="q-mb-md"
            />

            <q-input
              v-model="missionData.description"
              label="Description (optional)"
              outlined
              type="textarea"
              rows="4"
              maxlength="500"
              counter
            />
          </div>
        </div>

        <!-- Step 2: Zone Selection -->
        <div v-show="currentStep === 2" class="wizard-step">
          <div class="step-content">
            <div class="text-h6 q-mb-md">Select Coverage Zones</div>
            <div class="text-caption text-grey-7 q-mb-lg">
              Choose one or more zones for this mission
            </div>

            <div v-if="availableZones.length === 0" class="empty-zones">
              <q-icon name="map" size="64px" color="grey-5" />
              <div class="text-subtitle1 q-mt-md">No Zones Available</div>
              <div class="text-caption text-grey-7 q-mb-md">
                Create zones first to use them in missions
              </div>
              <q-btn
                label="Create Zone"
                color="primary"
                outline
                @click="$emit('create-zone')"
              />
            </div>

            <div v-else class="zones-grid">
              <q-card
                v-for="zone in availableZones"
                :key="zone.id"
                flat
                bordered
                class="zone-select-card"
                :class="{ selected: isZoneSelected(zone.id) }"
                @click="toggleZone(zone.id)"
              >
                <q-card-section>
                  <div class="row items-start">
                    <q-checkbox
                      :model-value="isZoneSelected(zone.id)"
                      @update:model-value="toggleZone(zone.id)"
                      class="q-mr-sm"
                    />
                    <div class="col">
                      <div class="text-subtitle2">{{ zone.name }}</div>
                      <div class="text-caption text-grey-7">
                        {{ zone.type }} • {{ zone.area.toFixed(3) }} acres
                      </div>
                      <div v-if="zone.description" class="text-caption q-mt-xs">
                        {{ zone.description }}
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Selected Zones Summary -->
            <div v-if="missionData.selectedZones.length > 0" class="selected-summary q-mt-md">
              <q-separator class="q-mb-md" />
              <div class="text-subtitle2 q-mb-sm">
                Selected: {{ missionData.selectedZones.length }} zone(s)
              </div>
              <div class="text-body2">
                Total Area: {{ totalSelectedArea.toFixed(3) }} acres
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Schedule & Configure -->
        <div v-show="currentStep === 3" class="wizard-step">
          <div class="step-content">
            <div class="text-h6 q-mb-md">Schedule Mission</div>

            <!-- Schedule Type -->
            <q-option-group
              v-model="missionData.scheduleType"
              :options="scheduleOptions"
              color="primary"
              class="q-mb-lg"
            />

            <!-- Immediate (no additional options) -->
            <div v-if="missionData.scheduleType === 'immediate'" class="schedule-info">
              <q-icon name="info" color="primary" size="sm" class="q-mr-sm" />
              <span class="text-caption">Mission will start immediately upon creation</span>
            </div>

            <!-- Schedule for Later -->
            <div v-if="missionData.scheduleType === 'later'" class="schedule-later">
              <q-input
                v-model="missionData.scheduledDate"
                label="Date *"
                outlined
                type="date"
                :min="today"
                class="q-mb-md"
              />
              <q-input
                v-model="missionData.scheduledTime"
                label="Time *"
                outlined
                type="time"
                class="q-mb-md"
              />
            </div>

            <!-- Recurring Schedule -->
            <div v-if="missionData.scheduleType === 'recurring'" class="schedule-recurring">
              <q-select
                v-model="missionData.recurringPattern"
                :options="recurringPatterns"
                label="Frequency *"
                outlined
                emit-value
                map-options
                class="q-mb-md"
              />

              <q-input
                v-model="missionData.recurringTime"
                label="Time of Day *"
                outlined
                type="time"
                class="q-mb-md"
              />

              <!-- Days of week for weekly -->
              <div v-if="missionData.recurringPattern === 'weekly'" class="q-mb-md">
                <div class="text-caption q-mb-sm">Days of Week *</div>
                <q-option-group
                  v-model="missionData.recurringDays"
                  :options="daysOfWeek"
                  type="checkbox"
                  color="primary"
                  inline
                />
              </div>
            </div>

            <!-- Mission Summary -->
            <q-separator class="q-my-lg" />
            <div class="mission-summary">
              <div class="text-h6 q-mb-md">Mission Summary</div>
              <div class="summary-item">
                <span class="summary-label">Name:</span>
                <span class="summary-value">{{ missionData.name }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Type:</span>
                <span class="summary-value">{{ missionData.type }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Zones:</span>
                <span class="summary-value">{{ missionData.selectedZones.length }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Area:</span>
                <span class="summary-value">{{ totalSelectedArea.toFixed(3) }} acres</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Schedule:</span>
                <span class="summary-value">{{ scheduleDescription }}</span>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="wizard-actions">
        <q-btn
          v-if="!isFirstStep"
          label="Previous"
          outline
          @click="previousStep"
        />
        <q-space />
        <q-btn
          label="Cancel"
          outline
          @click="handleClose"
        />
        <q-btn
          v-if="!isLastStep"
          label="Next"
          color="primary"
          :disable="!canGoNext"
          @click="nextStep"
        />
        <q-btn
          v-else
          label="Create Mission"
          color="primary"
          :disable="!canGoNext"
          @click="handleFinish"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionWizard } from '@/composables/useMissionWizard'
import { useZonesStore } from '@/stores/zones'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'create', data: any): void
  (e: 'create-zone'): void
}>()

const zonesStore = useZonesStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const {
  currentStep,
  missionData,
  stepTitles,
  canGoNext,
  canGoPrevious,
  isFirstStep,
  isLastStep,
  nextStep,
  previousStep,
  reset,
  updateMissionData,
  getMissionSummary
} = useMissionWizard()

const missionTypes = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Snow Removal', value: 'snow' },
  { label: 'Leaf Blowing', value: 'blowing' },
  { label: 'Patrol', value: 'patrol' },
  { label: 'Transport', value: 'transport' }
]

const scheduleOptions = [
  { label: 'Start Immediately', value: 'immediate' },
  { label: 'Schedule for Later', value: 'later' },
  { label: 'Recurring Schedule', value: 'recurring' }
]

const recurringPatterns = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' }
]

const daysOfWeek = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 }
]

const availableZones = computed(() => zonesStore.zones)

const today = computed(() => new Date().toISOString().split('T')[0])

const totalSelectedArea = computed(() => {
  return missionData.value.selectedZones.reduce((sum, zoneId) => {
    const zone = zonesStore.getZoneById(zoneId)
    return sum + (zone?.area || 0)
  }, 0)
})

const scheduleDescription = computed(() => {
  if (missionData.value.scheduleType === 'immediate') {
    return 'Immediate'
  }
  if (missionData.value.scheduleType === 'later') {
    return `${missionData.value.scheduledDate} at ${missionData.value.scheduledTime}`
  }
  if (missionData.value.scheduleType === 'recurring') {
    return `${missionData.value.recurringPattern} at ${missionData.value.recurringTime}`
  }
  return '-'
})

const getStepIcon = (step: number) => {
  const icons = ['description', 'map', 'schedule']
  return icons[step - 1]
}

const isZoneSelected = (zoneId: string) => {
  return missionData.value.selectedZones.includes(zoneId)
}

const toggleZone = (zoneId: string) => {
  const index = missionData.value.selectedZones.indexOf(zoneId)
  if (index > -1) {
    missionData.value.selectedZones.splice(index, 1)
  } else {
    missionData.value.selectedZones.push(zoneId)
  }
}

const handleClose = () => {
  if (missionData.value.name || missionData.value.selectedZones.length > 0) {
    if (confirm('Discard mission? Your progress will be saved as a draft.')) {
      isOpen.value = false
    }
  } else {
    isOpen.value = false
  }
}

const handleFinish = () => {
  const summary = getMissionSummary()
  emit('create', summary)
  reset()
  isOpen.value = false
}
</script>

<style scoped lang="scss">
.mission-wizard {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.wizard-header {
  border-bottom: 1px solid var(--q-separator-color);
}

.wizard-stepper {
  :deep(.q-stepper__header) {
    border: none;
  }
}

.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
}

.wizard-step {
  max-width: 800px;
  margin: 0 auto;
}

.step-content {
  padding: var(--spacing-md);
}

.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.zone-select-card {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--q-primary);
  }

  &.selected {
    border-color: var(--q-primary);
    background: rgba(var(--q-primary-rgb), 0.05);
  }
}

.empty-zones {
  text-align: center;
  padding: var(--spacing-xxl);
}

.schedule-info {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background: rgba(var(--q-primary-rgb), 0.1);
  border-radius: var(--border-radius);
}

.mission-summary {
  padding: var(--spacing-md);
  background: var(--q-dark-page);
  border-radius: var(--border-radius);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;

  .summary-label {
    color: var(--q-text-secondary);
  }

  .summary-value {
    font-weight: 600;
  }
}

.wizard-actions {
  border-top: 1px solid var(--q-separator-color);
  padding: var(--spacing-md) var(--spacing-xl);
}
</style>
