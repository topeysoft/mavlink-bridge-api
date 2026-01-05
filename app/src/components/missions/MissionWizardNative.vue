<template>
  <Modal v-model="isOpen" size="lg" :persistent="hasChanges">
    <ModalHeader @close="handleClose">
      Create New Mission
    </ModalHeader>

    <ModalBody>
      <div class="mission-wizard">
        <!-- Progress Stepper -->
        <div class="stepper">
          <div
            v-for="(step, index) in stepTitles"
            :key="index"
            class="step"
            :class="{
              active: currentStep === index + 1,
              completed: currentStep > index + 1
            }"
            @click="canNavigateToStep(index + 1) && goToStep(index + 1)"
          >
            <div class="step-number">
              <span v-if="currentStep > index + 1">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="step-title">{{ step }}</div>
          </div>
        </div>

        <!-- Step Content -->
        <div class="step-content">
          <!-- Step 1: Mission Details -->
          <div v-if="currentStep === 1" class="step-panel">
            <h3>Mission Information</h3>

            <div class="form-group">
              <label for="missionName">Mission Name *</label>
              <input
                id="missionName"
                v-model="missionData.name"
                type="text"
                class="form-input"
                placeholder="Enter mission name"
                required
              />
            </div>

            <div class="form-group">
              <label for="missionType">Mission Type</label>
              <select id="missionType" v-model="missionData.type" class="form-input">
                <option value="mowing">Mowing</option>
                <option value="snow">Snow Removal</option>
                <option value="blowing">Leaf Blowing</option>
                <option value="patrol">Patrol</option>
                <option value="transport">Transport</option>
              </select>
            </div>

            <div class="form-group">
              <label for="missionDescription">Description (optional)</label>
              <textarea
                id="missionDescription"
                v-model="missionData.description"
                class="form-input"
                rows="4"
                maxlength="500"
                placeholder="Describe this mission..."
              ></textarea>
              <div class="char-count">{{ missionData.description.length }}/500</div>
            </div>
          </div>

          <!-- Step 2: Zone Selection -->
          <div v-if="currentStep === 2" class="step-panel">
            <h3>Select Coverage Zones</h3>
            <p class="help-text">Choose one or more zones for this mission</p>

            <div v-if="availableZones.length === 0" class="empty-zones">
              <div class="empty-icon">🗺️</div>
              <h4>No Zones Available</h4>
              <p>Create zones first to use them in missions</p>
              <button class="btn btn-secondary" @click="$emit('create-zone')">
                Create Zone
              </button>
            </div>

            <div v-else class="zones-grid">
              <div
                v-for="zone in availableZones"
                :key="zone.id"
                class="zone-select-card"
                :class="{ selected: isZoneSelected(zone.id) }"
                @click="toggleZone(zone.id)"
              >
                <div class="zone-checkbox">
                  <input
                    type="checkbox"
                    :checked="isZoneSelected(zone.id)"
                    @change="toggleZone(zone.id)"
                  />
                </div>
                <div class="zone-info">
                  <div class="zone-name">{{ zone.name }}</div>
                  <div class="zone-meta">
                    {{ zone.type }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="missionData.selectedZones.length > 0" class="selected-summary">
              <div class="summary-title">
                Selected: {{ missionData.selectedZones.length }} zone(s)
              </div>
            </div>
          </div>

          <!-- Step 3: Schedule & Configure -->
          <div v-if="currentStep === 3" class="step-panel">
            <h3>Schedule Mission</h3>

            <!-- Schedule Type -->
            <div class="form-group">
              <label class="radio-group-label">When should this mission run?</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input
                    type="radio"
                    v-model="missionData.scheduleType"
                    value="immediate"
                  />
                  <span class="radio-label">
                    <strong>Start Immediately</strong>
                    <small>Begin as soon as created</small>
                  </span>
                </label>

                <label class="radio-option">
                  <input
                    type="radio"
                    v-model="missionData.scheduleType"
                    value="later"
                  />
                  <span class="radio-label">
                    <strong>Schedule for Later</strong>
                    <small>Run once at a specific time</small>
                  </span>
                </label>

                <label class="radio-option">
                  <input
                    type="radio"
                    v-model="missionData.scheduleType"
                    value="recurring"
                  />
                  <span class="radio-label">
                    <strong>Recurring Schedule</strong>
                    <small>Repeat on a regular basis</small>
                  </span>
                </label>
              </div>
            </div>

            <!-- Schedule for Later Options -->
            <div v-if="missionData.scheduleType === 'later'" class="schedule-options">
              <div class="form-row">
                <div class="form-group">
                  <label for="scheduleDate">Date *</label>
                  <input
                    id="scheduleDate"
                    v-model="missionData.scheduledDate"
                    type="date"
                    class="form-input"
                    :min="today"
                  />
                </div>
                <div class="form-group">
                  <label for="scheduleTime">Time *</label>
                  <input
                    id="scheduleTime"
                    v-model="missionData.scheduledTime"
                    type="time"
                    class="form-input"
                  />
                </div>
              </div>
            </div>

            <!-- Recurring Schedule Options -->
            <div v-if="missionData.scheduleType === 'recurring'" class="schedule-options">
              <div class="form-group">
                <label for="recurringPattern">Frequency *</label>
                <select id="recurringPattern" v-model="missionData.recurringPattern" class="form-input">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div class="form-group">
                <label for="recurringTime">Time of Day *</label>
                <input
                  id="recurringTime"
                  v-model="missionData.recurringTime"
                  type="time"
                  class="form-input"
                />
              </div>

              <div v-if="missionData.recurringPattern === 'weekly'" class="form-group">
                <label>Days of Week *</label>
                <div class="days-grid">
                  <label
                    v-for="day in daysOfWeek"
                    :key="day.value"
                    class="day-option"
                    :class="{ selected: isDaySelected(day.value) }"
                  >
                    <input
                      type="checkbox"
                      :value="day.value"
                      v-model="missionData.recurringDays"
                    />
                    <span>{{ day.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Mission Summary -->
            <div class="mission-summary">
              <h4>Mission Summary</h4>
              <div class="summary-row">
                <span class="summary-label">Name:</span>
                <span class="summary-value">{{ missionData.name || '-' }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Type:</span>
                <span class="summary-value">{{ missionData.type }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Zones:</span>
                <span class="summary-value">{{ missionData.selectedZones.length }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Schedule:</span>
                <span class="summary-value">{{ scheduleDescription }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalBody>

    <ModalActions align="space-between">
      <button
        v-if="!isFirstStep"
        class="btn btn-secondary"
        @click="previousStep"
      >
        ← Previous
      </button>
      <div v-else></div>

      <div class="action-group">
        <button class="btn btn-secondary" @click="handleClose">
          Cancel
        </button>
        <button
          v-if="!isLastStep"
          class="btn btn-primary"
          :disabled="!canGoNext"
          @click="nextStep"
        >
          Next →
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="!canGoNext"
          @click="handleFinish"
        >
          Create Mission
        </button>
      </div>
    </ModalActions>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import ModalHeader from '@/components/common/ModalHeader.vue'
import ModalBody from '@/components/common/ModalBody.vue'
import ModalActions from '@/components/common/ModalActions.vue'
import { useMissionWizard } from '@/composables/useMissionWizard'
import { useZonesStore } from '@/stores/zones'
import { useDialog } from '@/composables/useDialog'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'create', data: any): void
  (e: 'create-zone'): void
}>()

const zonesStore = useZonesStore()
const dialog = useDialog()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const {
  currentStep,
  missionData,
  stepTitles,
  canGoNext,
  isFirstStep,
  isLastStep,
  nextStep,
  previousStep,
  goToStep,
  reset,
  loadDraft
} = useMissionWizard()

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

const hasChanges = computed(() => {
  return missionData.value.name.trim() !== '' || missionData.value.selectedZones.length > 0
})

const scheduleDescription = computed(() => {
  if (missionData.value.scheduleType === 'immediate') {
    return 'Immediate'
  }
  if (missionData.value.scheduleType === 'later') {
    if (missionData.value.scheduledDate && missionData.value.scheduledTime) {
      return `${missionData.value.scheduledDate} at ${missionData.value.scheduledTime}`
    }
    return 'Not configured'
  }
  if (missionData.value.scheduleType === 'recurring') {
    if (missionData.value.recurringPattern && missionData.value.recurringTime) {
      return `${missionData.value.recurringPattern} at ${missionData.value.recurringTime}`
    }
    return 'Not configured'
  }
  return '-'
})

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

const isDaySelected = (day: number) => {
  return missionData.value.recurringDays?.includes(day) || false
}

const canNavigateToStep = (step: number) => {
  // Can always go back
  if (step < currentStep.value) return true

  // Can't skip ahead
  if (step > currentStep.value + 1) return false

  // Can go to next if current is valid
  return canGoNext.value
}

const handleClose = async () => {
  if (hasChanges.value) {
    const confirmed = await dialog.confirm(
      'Discard mission? Your progress will be saved as a draft.'
    )
    if (confirmed) {
      isOpen.value = false
    }
  } else {
    isOpen.value = false
  }
}

const handleFinish = () => {
  if (!canGoNext.value) return

  emit('create', {
    ...missionData.value,
    created: new Date().toISOString()
  })
  reset()
  isOpen.value = false
}

// Load draft when opening
watch(isOpen, (newValue) => {
  if (newValue) {
    const hasDraft = loadDraft()
    if (hasDraft) {
      // Optionally notify user about draft
      console.log('Loaded mission draft')
    }
  }
})
</script>

<style scoped lang="scss">
.mission-wizard {
  min-height: 500px;
}

.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-2xl);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 10%;
    right: 10%;
    height: 2px;
    background: var(--border-color);
    z-index: 0;
  }
}

.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  position: relative;
  z-index: 1;

  &.active .step-number {
    background: var(--primary-green);
    color: white;
    border-color: var(--primary-green);
  }

  &.completed .step-number {
    background: var(--primary-green);
    color: white;
    border-color: var(--primary-green);
  }
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: all 0.3s;
}

.step-title {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  text-align: center;
}

.step-content {
  min-height: 400px;
}

.step-panel {
  animation: slideIn 0.3s ease;

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--text-primary);
  }

  .help-text {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.form-group {
  margin-bottom: var(--spacing-lg);

  label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    margin-bottom: var(--spacing-xs);
    color: var(--text-secondary);
  }
}

.form-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);

  &:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 0;
  }
}

.char-count {
  text-align: right;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.empty-zones {
  text-align: center;
  padding: var(--spacing-2xl);

  .empty-icon {
    font-size: 64px;
    margin-bottom: var(--spacing-md);
  }

  h4 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }
}

.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.zone-select-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
    background: var(--bg-secondary);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.1);
  }
}

.zone-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.zone-name {
  font-weight: 500;
  color: var(--text-primary);
}

.zone-meta {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.selected-summary {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  margin-top: var(--spacing-md);
}

.summary-title {
  font-weight: 600;
  color: var(--primary-green);
}

.radio-group-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin-bottom: var(--spacing-md);
  color: var(--text-secondary);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
    background: var(--bg-secondary);
  }

  input[type="radio"] {
    margin-top: 2px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  input[type="radio"]:checked + .radio-label {
    color: var(--primary-green);
  }
}

.radio-label {
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-weight: 600;
  }

  small {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
}

.schedule-options {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-lg);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--spacing-xs);
}

.day-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.1);
  }

  input {
    display: none;
  }

  span {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }
}

.mission-summary {
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  margin-top: var(--spacing-xl);

  h4 {
    font-size: var(--font-size-md);
    font-weight: 600;
    margin-bottom: var(--spacing-md);
  }
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);

  .summary-label {
    color: var(--text-secondary);
  }

  .summary-value {
    font-weight: 600;
    color: var(--text-primary);
  }
}

.action-group {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--border-radius);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-green-dark, #245a25);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-secondary);
  }
}
</style>
