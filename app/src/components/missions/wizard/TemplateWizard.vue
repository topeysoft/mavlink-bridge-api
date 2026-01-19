<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ZoneSelectionStep from './steps/ZoneSelectionStep.vue'
import ScheduleStep from './steps/ScheduleStep.vue'
import ReviewStep from './steps/ReviewStep.vue'
import { useMissionTemplatesStore } from '@/stores/missionTemplates'
import { useFeaturesStore } from '@/stores/features'
import type { MissionTemplateDetail, MissionFromTemplateRequest } from '@client'

interface Props {
  templateId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  complete: [missionId: string]
  cancel: []
}>()

const templatesStore = useMissionTemplatesStore()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Wizard state
const currentStep = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const templateDetail = ref<MissionTemplateDetail | null>(null)

// Form data
const selectedZoneIds = ref<string[]>([])
const scheduledTime = ref<Date | null>(null)
const scheduleType = ref<'now' | 'scheduled'>('now')
const missionName = ref('')

const steps = computed(() => {
  const baseSteps = [
    {
      id: 'zones',
      title: isConsumerMode.value ? 'Select Areas' : 'Select Zones',
      description: isConsumerMode.value
        ? 'Choose where you want the job done'
        : 'Choose zones for this mission'
    },
    {
      id: 'schedule',
      title: isConsumerMode.value ? 'When' : 'Schedule',
      description: isConsumerMode.value
        ? 'Pick when to run the job'
        : 'Set mission schedule'
    },
    {
      id: 'review',
      title: isConsumerMode.value ? 'Confirm' : 'Review',
      description: isConsumerMode.value
        ? 'Review and start your job'
        : 'Review mission details'
    }
  ]
  return baseSteps
})

const currentStepData = computed(() => steps.value[currentStep.value])

const canGoNext = computed(() => {
  switch (currentStepData.value.id) {
    case 'zones':
      return selectedZoneIds.value.length > 0
    case 'schedule':
      return scheduleType.value === 'now' || scheduledTime.value !== null
    case 'review':
      return true
    default:
      return false
  }
})

const canGoBack = computed(() => currentStep.value > 0)

const isLastStep = computed(() => currentStep.value === steps.value.length - 1)

const templateName = computed(() => {
  if (!templateDetail.value) return ''
  return isConsumerMode.value
    ? templateDetail.value.template.consumer_name
    : templateDetail.value.template.name
})

const progressPercent = computed(() => {
  return ((currentStep.value + 1) / steps.value.length) * 100
})

async function loadTemplateDetail() {
  loading.value = true
  error.value = null

  try {
    templateDetail.value = await templatesStore.getTemplateDetails(props.templateId)

    // Set default mission name
    if (templateDetail.value) {
      missionName.value = templateName.value
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load template'
  } finally {
    loading.value = false
  }
}

function goNext() {
  if (canGoNext.value && currentStep.value < steps.value.length - 1) {
    currentStep.value++
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function handleComplete() {
  if (!templateDetail.value) return

  loading.value = true
  error.value = null

  try {
    const startTime = scheduleType.value === 'scheduled' && scheduledTime.value
      ? scheduledTime.value.toISOString()
      : new Date().toISOString()

    const request: MissionFromTemplateRequest = {
      zone_ids: selectedZoneIds.value,
      name: missionName.value || undefined,
      schedule_type: scheduleType.value === 'now' ? 'once' : 'once',
      start_time: startTime
    }

    const missionId = await templatesStore.createMissionFromTemplate(props.templateId, request)

    if (missionId) {
      emit('complete', missionId)
    } else {
      error.value = 'Failed to create mission'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create mission'
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  emit('cancel')
}

onMounted(() => {
  loadTemplateDetail()
})

watch(() => props.templateId, () => {
  currentStep.value = 0
  selectedZoneIds.value = []
  scheduledTime.value = null
  scheduleType.value = 'now'
  missionName.value = ''
  loadTemplateDetail()
})
</script>

<template>
  <div class="template-wizard" :class="{ 'consumer-wizard': isConsumerMode }">
    <!-- Header -->
    <div class="wizard-header">
      <button class="back-button" @click="handleCancel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>{{ isConsumerMode ? 'Back to Jobs' : 'Back to Templates' }}</span>
      </button>

      <div class="template-info" v-if="templateDetail">
        <span class="template-emoji">{{ templateDetail.template.emoji }}</span>
        <h2 class="template-name">{{ templateName }}</h2>
      </div>
    </div>

    <!-- Progress -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      <div class="step-indicators">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="step-indicator"
          :class="{
            'active': index === currentStep,
            'completed': index < currentStep
          }"
        >
          <div class="step-dot">
            <svg v-if="index < currentStep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span class="step-label">{{ step.title }}</span>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="wizard-content">
      <LoadingSpinner v-if="loading && !templateDetail" size="large" />

      <div v-else-if="error && !templateDetail" class="error-state">
        <div class="error-icon">⚠️</div>
        <p class="error-message">{{ error }}</p>
        <Button variant="primary" @click="loadTemplateDetail">Try Again</Button>
      </div>

      <template v-else-if="templateDetail">
        <!-- Step: Zone Selection -->
        <ZoneSelectionStep
          v-if="currentStepData.id === 'zones'"
          v-model:selected-zones="selectedZoneIds"
          :compatible-zone-types="templateDetail.template.compatible_zone_types"
          :available-zones="templateDetail.compatible_zones"
        />

        <!-- Step: Schedule -->
        <ScheduleStep
          v-else-if="currentStepData.id === 'schedule'"
          v-model:schedule-type="scheduleType"
          v-model:scheduled-time="scheduledTime"
          :weather-status="templateDetail.weather_status"
          :suggested-times="templateDetail.suggested_schedule?.alternative_times"
        />

        <!-- Step: Review -->
        <ReviewStep
          v-else-if="currentStepData.id === 'review'"
          v-model:mission-name="missionName"
          :template="templateDetail.template"
          :selected-zones="selectedZoneIds"
          :schedule-type="scheduleType"
          :scheduled-time="scheduledTime"
          :weather-status="templateDetail.weather_status"
          :peripheral-status="templateDetail.peripheral_status"
        />
      </template>
    </div>

    <!-- Error Banner -->
    <div v-if="error && templateDetail" class="error-banner">
      <span class="error-text">{{ error }}</span>
      <button class="dismiss-btn" @click="error = null">×</button>
    </div>

    <!-- Footer -->
    <div class="wizard-footer" v-if="templateDetail">
      <Button
        variant="secondary"
        :disabled="!canGoBack || loading"
        @click="goBack"
      >
        {{ isConsumerMode ? 'Back' : 'Previous' }}
      </Button>

      <Button
        v-if="!isLastStep"
        variant="primary"
        :disabled="!canGoNext || loading"
        @click="goNext"
      >
        {{ isConsumerMode ? 'Next' : 'Continue' }}
      </Button>

      <Button
        v-else
        variant="primary"
        :disabled="!canGoNext || loading"
        :loading="loading"
        @click="handleComplete"
      >
        {{ isConsumerMode ? 'Start Job' : 'Create Mission' }}
      </Button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.wizard-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--text-primary);
  }
}

.template-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.template-emoji {
  font-size: 32px;
}

.consumer-wizard .template-emoji {
  font-size: 40px;
}

.template-name {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.consumer-wizard .template-name {
  font-size: var(--font-size-2xl);
}

.progress-container {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-primary);
}

.progress-bar {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--spacing-md);
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.step-indicators {
  display: flex;
  justify-content: space-between;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: all 0.2s ease;

  svg {
    width: 14px;
    height: 14px;
  }
}

.step-indicator.active .step-dot {
  background: var(--primary);
  color: white;
}

.step-indicator.completed .step-dot {
  background: var(--positive);
  color: white;
}

.step-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-align: center;
}

.step-indicator.active .step-label {
  color: var(--text-primary);
  font-weight: 600;
}

.wizard-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.consumer-wizard .wizard-content {
  padding: var(--spacing-xl);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-md);
  text-align: center;
}

.error-icon {
  font-size: 48px;
}

.error-message {
  color: var(--negative);
  font-size: var(--font-size-base);
  max-width: 400px;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: rgba(var(--negative-rgb), 0.1);
  border-top: 1px solid var(--negative);
}

.error-text {
  color: var(--negative);
  font-size: var(--font-size-sm);
}

.dismiss-btn {
  background: none;
  border: none;
  color: var(--negative);
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: var(--spacing-xs);
  line-height: 1;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.consumer-wizard .wizard-footer {
  padding: var(--spacing-lg) var(--spacing-xl);
}
</style>
