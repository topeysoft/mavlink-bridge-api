<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'

interface JobTemplate {
  id: number
  name: string
  emoji: string
  description: string
}

interface Zone {
  id: string
  name: string
  type: string
  area: number
}

interface Props {
  modelValue: boolean
  templates: JobTemplate[]
  zones: Zone[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'complete': [job: any]
}>()

const currentStep = ref(1)
const selectedTemplate = ref<JobTemplate | null>(null)
const selectedZones = ref<string[]>([])
const scheduleType = ref<'now' | 'later'>('now')
const scheduledTime = ref('')
const jobName = ref('')

const totalSteps = 4

const stepTitle = computed(() => {
  switch (currentStep.value) {
    case 1: return 'What job would you like to do?'
    case 2: return 'Which area(s)?'
    case 3: return 'When should it run?'
    case 4: return 'Review & Confirm'
    default: return ''
  }
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1: return !!selectedTemplate.value
    case 2: return selectedZones.value.length > 0
    case 3: return scheduleType.value === 'now' || !!scheduledTime.value
    case 4: return !!jobName.value
    default: return false
  }
})

function selectTemplate(template: JobTemplate) {
  selectedTemplate.value = template
  jobName.value = template.name
}

function toggleZone(zoneId: string) {
  const index = selectedZones.value.indexOf(zoneId)
  if (index > -1) {
    selectedZones.value.splice(index, 1)
  } else {
    selectedZones.value.push(zoneId)
  }
}

function nextStep() {
  if (canProceed.value && currentStep.value < totalSteps) {
    currentStep.value++
  }
}

function previousStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function completeWizard() {
  if (canProceed.value) {
    emit('complete', {
      name: jobName.value,
      template: selectedTemplate.value,
      zones: selectedZones.value,
      scheduleType: scheduleType.value,
      scheduledTime: scheduledTime.value
    })
    closeWizard()
  }
}

function closeWizard() {
  emit('update:modelValue', false)
  // Reset wizard state
  setTimeout(() => {
    currentStep.value = 1
    selectedTemplate.value = null
    selectedZones.value = []
    scheduleType.value = 'now'
    scheduledTime.value = ''
    jobName.value = ''
  }, 300)
}

const selectedZonesData = computed(() => {
  return props.zones.filter(z => selectedZones.value.includes(z.id))
})

const totalArea = computed(() => {
  return selectedZonesData.value.reduce((sum, z) => sum + z.area, 0).toFixed(2)
})
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="stepTitle"
    size="lg"
    :close-on-backdrop="false"
  >
    <!-- Progress Indicator -->
    <div class="wizard-progress">
      <div
        v-for="step in totalSteps"
        :key="step"
        class="progress-step"
        :class="{ active: step === currentStep, completed: step < currentStep }"
      >
        <div class="step-number">
          <span v-if="step < currentStep">✓</span>
          <span v-else>{{ step }}</span>
        </div>
        <div class="step-label">
          {{ step === 1 ? 'Job' : step === 2 ? 'Area' : step === 3 ? 'When' : 'Review' }}
        </div>
      </div>
    </div>

    <!-- Step 1: Select Job Template -->
    <div v-if="currentStep === 1" class="wizard-step">
      <div class="templates-grid">
        <button
          v-for="template in templates"
          :key="template.id"
          class="template-option"
          :class="{ selected: selectedTemplate?.id === template.id }"
          @click="selectTemplate(template)"
        >
          <div class="template-emoji">{{ template.emoji }}</div>
          <div class="template-info">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
          </div>
          <div v-if="selectedTemplate?.id === template.id" class="selected-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </button>
      </div>
    </div>

    <!-- Step 2: Select Zones -->
    <div v-if="currentStep === 2" class="wizard-step">
      <p class="step-help">Select one or more areas where this job should run:</p>
      <div class="zones-list">
        <label
          v-for="zone in zones"
          :key="zone.id"
          class="zone-option"
          :class="{ selected: selectedZones.includes(zone.id) }"
        >
          <input
            type="checkbox"
            :checked="selectedZones.includes(zone.id)"
            @change="toggleZone(zone.id)"
          />
          <div class="zone-info">
            <div class="zone-name">{{ zone.name }}</div>
            <div class="zone-meta">{{ zone.type }} • {{ zone.area.toFixed(2) }} acres</div>
          </div>
        </label>
      </div>
      <div v-if="selectedZones.length > 0" class="zone-summary">
        Total area: {{ totalArea }} acres
      </div>
    </div>

    <!-- Step 3: Schedule -->
    <div v-if="currentStep === 3" class="wizard-step">
      <p class="step-help">When would you like this job to run?</p>
      <div class="schedule-options">
        <label class="schedule-option" :class="{ selected: scheduleType === 'now' }">
          <input type="radio" value="now" v-model="scheduleType" />
          <div class="option-content">
            <div class="option-emoji">▶️</div>
            <div class="option-info">
              <div class="option-title">Start Now</div>
              <div class="option-desc">Begin this job immediately</div>
            </div>
          </div>
        </label>

        <label class="schedule-option" :class="{ selected: scheduleType === 'later' }">
          <input type="radio" value="later" v-model="scheduleType" />
          <div class="option-content">
            <div class="option-emoji">📅</div>
            <div class="option-info">
              <div class="option-title">Schedule for Later</div>
              <div class="option-desc">Choose a specific date and time</div>
            </div>
          </div>
        </label>
      </div>

      <div v-if="scheduleType === 'later'" class="schedule-picker">
        <label class="input-label">When?</label>
        <input
          type="datetime-local"
          v-model="scheduledTime"
          class="time-input"
          :min="new Date().toISOString().slice(0, 16)"
        />
      </div>
    </div>

    <!-- Step 4: Review -->
    <div v-if="currentStep === 4" class="wizard-step">
      <div class="review-section">
        <label class="input-label">Job Name</label>
        <input
          type="text"
          v-model="jobName"
          class="name-input"
          placeholder="e.g., Weekly Front Lawn Mowing"
        />
      </div>

      <div class="review-summary">
        <h3 class="summary-title">Summary</h3>

        <div class="summary-item">
          <div class="summary-label">Job Type</div>
          <div class="summary-value">
            <span class="summary-emoji">{{ selectedTemplate?.emoji }}</span>
            {{ selectedTemplate?.name }}
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-label">Areas ({{ selectedZones.length }})</div>
          <div class="summary-value">
            {{ selectedZonesData.map(z => z.name).join(', ') }}
            <div class="summary-meta">Total: {{ totalArea }} acres</div>
          </div>
        </div>

        <div class="summary-item">
          <div class="summary-label">Schedule</div>
          <div class="summary-value">
            {{ scheduleType === 'now' ? 'Start immediately' : new Date(scheduledTime).toLocaleString() }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="wizard-actions">
        <Button
          v-if="currentStep > 1"
          variant="outline"
          @click="previousStep"
        >
          ← Back
        </Button>
        <Button variant="outline" @click="closeWizard">
          Cancel
        </Button>
        <Button
          v-if="currentStep < totalSteps"
          variant="primary"
          @click="nextStep"
          :disabled="!canProceed"
        >
          Next →
        </Button>
        <Button
          v-else
          variant="primary"
          @click="completeWizard"
          :disabled="!canProceed"
        >
          Create Job
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.wizard-progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-2xl);
  padding: 0 var(--spacing-lg);
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  position: relative;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 16px;
    left: 50%;
    width: 100%;
    height: 2px;
    background: var(--border-color);
    z-index: -1;
  }

  &.completed::after {
    background: var(--primary-green);
  }
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.3s;

  .completed & {
    background: var(--primary-green);
    border-color: var(--primary-green);
    color: white;
  }

  .active & {
    background: var(--primary-green);
    border-color: var(--primary-green);
    color: white;
    transform: scale(1.1);
  }
}

.step-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 600;

  .active & {
    color: var(--primary-green);
  }
}

.wizard-step {
  min-height: 300px;
  padding: var(--spacing-md);
}

.step-help {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
  text-align: center;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.template-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;

  &:hover {
    border-color: var(--primary-green);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }
}

.template-emoji {
  font-size: 40px;
  line-height: 1;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.template-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.selected-check {
  width: 24px;
  height: 24px;
  background: var(--primary-green);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 14px;
    height: 14px;
  }
}

.zones-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.zone-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
}

.zone-info {
  flex: 1;
}

.zone-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.zone-meta {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.zone-summary {
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: 600;
  color: var(--text-primary);
}

.schedule-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.schedule-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
  }

  &.selected {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }

  input[type="radio"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
}

.option-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.option-emoji {
  font-size: 32px;
  line-height: 1;
}

.option-info {
  flex: 1;
}

.option-title {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.option-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.schedule-picker {
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.input-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.time-input,
.name-input {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  color: var(--text-primary);
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
  }
}

.review-section {
  margin-bottom: var(--spacing-xl);
}

.review-summary {
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.summary-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.summary-item {
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }
}

.summary-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.summary-value {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 600;
}

.summary-emoji {
  font-size: 20px;
  margin-right: var(--spacing-xs);
}

.summary-meta {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 400;
  margin-top: var(--spacing-xs);
}

.wizard-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  width: 100%;
}
</style>
