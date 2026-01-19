<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Button from '@/components/common/Button.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TypeSelectionStep from './steps/TypeSelectionStep.vue'
import ZoneSelectionStep from './steps/ZoneSelectionStep.vue'
import PathConfigurationStep from './steps/PathConfigurationStep.vue'
import ScheduleStep from './steps/ScheduleStep.vue'
import ReviewStep from './steps/ReviewStep.vue'
import { useMissionTemplatesStore } from '@/stores/missionTemplates'
import { useMissionsStore } from '@/stores/missions'
import { useZonesStore } from '@/stores/zones'
import { useFeaturesStore } from '@/stores/features'
import { DEFAULT_PATH_CONFIG, type PathConfiguration, type PatternType } from '@/composables/useMissionPathGeneration'
import type { TypeSpecificSettings } from '@/components/missions/path/controls'
import type { TemplateCategory } from '@/config/missionTypeConfig'
import type {
  MissionTemplateDetail,
  MissionFromTemplateRequest,
  WeatherCheckResult,
  PeripheralAvailabilityStatus,
  ZoneType
} from '@client'
import type { Mission } from '@/types'

interface Props {
  templateId?: string | null
  missionId?: string | null
  preSelectRecurring?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  templateId: null,
  missionId: null,
  preSelectRecurring: false
})

const emit = defineEmits<{
  complete: [missionId: string]
  cancel: []
}>()

const templatesStore = useMissionTemplatesStore()
const missionsStore = useMissionsStore()
const zonesStore = useZonesStore()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
const isEditMode = computed(() => !!props.missionId)

// Wizard state
const currentStep = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

// Step 1: Type selection
const selectedTemplateId = ref<string | null>(props.templateId || null)
const isCustomMission = ref(false)
const templateDetail = ref<MissionTemplateDetail | null>(null)

// Step 2: Zone selection
const selectedZoneIds = ref<string[]>([])

// Step 3: Schedule
const scheduleType = ref<'now' | 'scheduled'>('now')
const scheduledTime = ref<Date | null>(null)
const recurringType = ref<'once' | 'daily' | 'weekly' | 'monthly'>('once')
const daysOfWeek = ref<number[]>([1, 2, 3, 4, 5])
const dayOfMonth = ref(1)

// Step 3.5: Path Configuration
const pathConfig = ref<PathConfiguration>({ ...DEFAULT_PATH_CONFIG })
const typeSpecificSettings = ref<TypeSpecificSettings>({})

// Step 4: Review
const missionName = ref('')
const priority = ref<'low' | 'normal' | 'high' | 'critical'>('normal')

// Default weather and peripheral status for custom missions
const defaultWeatherStatus: WeatherCheckResult = {
  suitable: true,
  reasons: []
}

const defaultPeripheralStatus: PeripheralAvailabilityStatus = {
  all_required_available: true,
  required: [],
  optional: []
}

// Computed step configuration
const steps = computed(() => {
  const baseSteps = [
    {
      id: 'type',
      title: isConsumerMode.value ? 'Choose Job' : 'Select Type',
      description: isConsumerMode.value ? 'What would you like to do?' : 'Choose mission type'
    },
    {
      id: 'zones',
      title: isConsumerMode.value ? 'Select Areas' : 'Select Zones',
      description: isConsumerMode.value ? 'Where should we work?' : 'Choose zones for this mission'
    },
    {
      id: 'path',
      title: isConsumerMode.value ? 'Preview' : 'Configure Path',
      description: isConsumerMode.value ? 'See how we\'ll cover your areas' : 'Configure mowing pattern'
    },
    {
      id: 'schedule',
      title: isConsumerMode.value ? 'When' : 'Schedule',
      description: isConsumerMode.value ? 'Pick when to run' : 'Set mission schedule'
    },
    {
      id: 'review',
      title: isConsumerMode.value ? 'Confirm' : 'Review',
      description: isConsumerMode.value ? 'Check and start' : 'Review mission details'
    }
  ]

  // Skip type selection step when editing
  if (isEditMode.value) {
    return baseSteps.slice(1)
  }

  return baseSteps
})

const currentStepData = computed(() => steps.value[currentStep.value])
const isLastStep = computed(() => currentStep.value === steps.value.length - 1)
const progressPercent = computed(() => ((currentStep.value + 1) / steps.value.length) * 100)

// Available zones based on template or all zones for custom
const availableZones = computed(() => {
  if (isCustomMission.value || !templateDetail.value) {
    return zonesStore.zones.map(z => ({
      id: z.id,
      name: z.name,
      type: z.type as ZoneType,
      area: (z as any).area_sqm || z.area || 0
    }))
  }
  return templateDetail.value.compatible_zones
})

const compatibleZoneTypes = computed(() => {
  if (isCustomMission.value || !templateDetail.value) {
    // Return all zone types for custom missions
    return ['mowing', 'exclusion', 'charging', 'patrol', 'snow_clearing', 'staging', 'spraying', 'watering', 'collection', 'monitoring'] as ZoneType[]
  }
  return templateDetail.value.template.compatible_zone_types
})

const weatherStatus = computed(() => {
  if (isCustomMission.value || !templateDetail.value) {
    return defaultWeatherStatus
  }
  return templateDetail.value.weather_status
})

const peripheralStatus = computed(() => {
  if (isCustomMission.value || !templateDetail.value) {
    return defaultPeripheralStatus
  }
  return templateDetail.value.peripheral_status
})

const templateForReview = computed((): MissionTemplateDetail['template'] => {
  if (templateDetail.value) {
    return templateDetail.value.template
  }
  // Provide a mock template for custom missions - matches MissionTemplate interface
  return {
    id: 'custom',
    name: 'Custom Mission',
    consumer_name: 'Custom Job',
    description: 'A custom mission with your settings',
    consumer_description: 'A custom job with your settings',
    emoji: '✏️',
    category: 'utility' as any,
    required_peripherals: [],
    optional_peripherals: [],
    compatible_zone_types: compatibleZoneTypes.value,
    weather_constraints: {
      max_wind_speed: 30,
      max_rain_rate: 0,
      max_snow_rate: 0,
      min_visibility: 100,
      min_temp: 0,
      max_temp: 40,
      avoid_conditions: [],
      require_dry_ground: false,
      dry_ground_hours: 0,
      require_daylight: false
    },
    default_settings: {
      overlap_percentage: 10,
      speed_mode: 'normal',
      collection_enabled: false,
      salt_application: false,
      motion_detection: false,
      recording: false
    },
    estimated_time_per_acre: 20,
    default_schedule_type: 'once',
    default_priority: 'normal',
    required_feature: null,
    min_user_mode: 'consumer',
    seasons: null
  } as MissionTemplateDetail['template']
})

const canGoNext = computed(() => {
  if (!currentStepData.value) return false
  const stepId = currentStepData.value.id
  switch (stepId) {
    case 'type':
      return selectedTemplateId.value !== null || isCustomMission.value
    case 'zones':
      return selectedZoneIds.value.length > 0
    case 'path':
      return true // Path config is always valid (has defaults)
    case 'schedule':
      return scheduleType.value === 'now' || scheduledTime.value !== null
    case 'review':
      return missionName.value.trim() !== ''
    default:
      return false
  }
})

const canGoBack = computed(() => currentStep.value > 0)

// Extract template defaults for path configuration
const templatePathDefaults = computed(() => {
  if (!templateDetail.value?.template.default_settings) return undefined

  const settings = templateDetail.value.template.default_settings
  return {
    mowing_pattern: settings.mowing_pattern as PatternType | undefined,
    edge_mode: settings.edge_mode as 'trim' | 'skip' | 'overlap' | undefined
  }
})

// Template category for type-specific controls
const templateCategory = computed((): TemplateCategory | undefined => {
  if (isCustomMission.value || !templateDetail.value?.template.category) return undefined
  return templateDetail.value.template.category as TemplateCategory
})

// Load template details when template is selected
async function loadTemplateDetail() {
  if (!selectedTemplateId.value) {
    templateDetail.value = null
    return
  }

  loading.value = true
  error.value = null

  try {
    templateDetail.value = await templatesStore.getTemplateDetails(selectedTemplateId.value)
    if (templateDetail.value && !missionName.value) {
      missionName.value = isConsumerMode.value
        ? templateDetail.value.template.consumer_name
        : templateDetail.value.template.name
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load template'
  } finally {
    loading.value = false
  }
}

// Load mission for editing
async function loadMissionForEditing() {
  if (!props.missionId) return

  const mission = missionsStore.getMissionById(props.missionId)
  if (!mission) {
    error.value = 'Mission not found'
    return
  }

  // Populate form from existing mission
  missionName.value = mission.name
  selectedZoneIds.value = [...mission.zoneIds]
  priority.value = mission.priority
  recurringType.value = mission.type

  if (mission.type === 'once') {
    const startDate = new Date(mission.schedule.startTime)
    if (startDate > new Date()) {
      scheduleType.value = 'scheduled'
      scheduledTime.value = startDate
    } else {
      scheduleType.value = 'now'
    }
  } else {
    scheduleType.value = 'scheduled'
    scheduledTime.value = new Date(mission.schedule.startTime)
  }

  if (mission.schedule.daysOfWeek) {
    daysOfWeek.value = mission.schedule.daysOfWeek
  }
  if (mission.schedule.dayOfMonth) {
    dayOfMonth.value = mission.schedule.dayOfMonth
  }

  // Mark as custom mission since we're editing
  isCustomMission.value = true
}

function goNext() {
  if (canGoNext.value && currentStep.value < steps.value.length - 1) {
    // When moving from type selection, load template details
    if (currentStepData.value?.id === 'type' && selectedTemplateId.value && !isCustomMission.value) {
      loadTemplateDetail()
    }
    currentStep.value++
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

async function handleComplete() {
  loading.value = true
  error.value = null

  try {
    let missionId: string

    if (isCustomMission.value || isEditMode.value) {
      // Create/update custom mission directly
      const startTime = scheduleType.value === 'scheduled' && scheduledTime.value
        ? scheduledTime.value.toISOString()
        : new Date().toISOString()

      const schedule: Mission['schedule'] = { startTime }

      if (recurringType.value === 'weekly') {
        schedule.daysOfWeek = daysOfWeek.value
      }
      if (recurringType.value === 'monthly') {
        schedule.dayOfMonth = dayOfMonth.value
      }

      const missionData: Mission = {
        id: isEditMode.value ? props.missionId! : crypto.randomUUID(),
        name: missionName.value,
        type: scheduleType.value === 'now' ? 'once' : recurringType.value,
        zoneIds: [...selectedZoneIds.value],
        schedule,
        priority: priority.value,
        enabled: true,
        created: isEditMode.value
          ? missionsStore.getMissionById(props.missionId!)?.created || new Date().toISOString()
          : new Date().toISOString(),
        lastModified: new Date().toISOString()
      }

      if (isEditMode.value) {
        await missionsStore.updateMission(props.missionId!, missionData)
        missionId = props.missionId!
      } else {
        await missionsStore.addMission(missionData)
        missionId = missionData.id
      }
    } else {
      // Create mission from template
      const startTime = scheduleType.value === 'scheduled' && scheduledTime.value
        ? scheduledTime.value.toISOString()
        : new Date().toISOString()

      const request: MissionFromTemplateRequest = {
        zone_ids: selectedZoneIds.value,
        name: missionName.value || undefined,
        schedule_type: scheduleType.value === 'now' ? 'once' : recurringType.value,
        start_time: startTime,
        priority: priority.value,
        settings_overrides: {
          path_config: pathConfig.value,
          ...typeSpecificSettings.value
        }
      }

      if (recurringType.value === 'weekly') {
        request.days_of_week = daysOfWeek.value
      }
      if (recurringType.value === 'monthly') {
        request.day_of_month = dayOfMonth.value
      }

      const result = await templatesStore.createMissionFromTemplate(selectedTemplateId.value!, request)
      if (!result) {
        throw new Error('Failed to create mission')
      }
      missionId = result
    }

    emit('complete', missionId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create mission'
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  emit('cancel')
}

// Watch for template selection changes
watch([selectedTemplateId, isCustomMission], ([templateId, isCustom]) => {
  if (isCustom) {
    templateDetail.value = null
    pathConfig.value = { ...DEFAULT_PATH_CONFIG }
    if (!missionName.value) {
      missionName.value = isConsumerMode.value ? 'My Custom Job' : 'Custom Mission'
    }
  } else if (templateId) {
    pathConfig.value = { ...DEFAULT_PATH_CONFIG }
    loadTemplateDetail()
  }
})

// Handle pre-select recurring from query param
watch(() => props.preSelectRecurring, (preSelect) => {
  if (preSelect) {
    scheduleType.value = 'scheduled'
    recurringType.value = 'weekly'
  }
}, { immediate: true })

onMounted(() => {
  if (props.missionId) {
    loadMissionForEditing()
  } else if (props.templateId) {
    selectedTemplateId.value = props.templateId
    loadTemplateDetail()
  }
})
</script>

<template>
  <div class="unified-wizard" :class="{ 'consumer-wizard': isConsumerMode }">
    <!-- Header -->
    <div class="wizard-header">
      <button class="back-button" @click="handleCancel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>{{ isConsumerMode ? 'Back to Jobs' : 'Back to Missions' }}</span>
      </button>

      <div class="wizard-title">
        <h2>{{ isEditMode
          ? (isConsumerMode ? 'Edit Job' : 'Edit Mission')
          : (isConsumerMode ? 'New Job' : 'New Mission')
        }}</h2>
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
      <LoadingSpinner v-if="loading && currentStep === 0 && !isCustomMission" size="large" />

      <div v-else-if="error && currentStep === 0" class="error-state">
        <div class="error-icon">&#9888;</div>
        <p class="error-message">{{ error }}</p>
        <Button variant="primary" @click="loadTemplateDetail">Try Again</Button>
      </div>

      <template v-else>
        <!-- Step 1: Type Selection (not shown in edit mode) -->
        <TypeSelectionStep
          v-if="currentStepData?.id === 'type'"
          v-model:selected-template-id="selectedTemplateId"
          v-model:is-custom-mission="isCustomMission"
          @proceed="goNext"
        />

        <!-- Step 2: Zone Selection -->
        <ZoneSelectionStep
          v-else-if="currentStepData?.id === 'zones'"
          v-model:selected-zones="selectedZoneIds"
          :compatible-zone-types="compatibleZoneTypes"
          :available-zones="availableZones"
        />

        <!-- Step 3: Path Configuration -->
        <PathConfigurationStep
          v-else-if="currentStepData?.id === 'path'"
          v-model:path-config="pathConfig"
          v-model:type-settings="typeSpecificSettings"
          :selected-zone-ids="selectedZoneIds"
          :available-zones="availableZones"
          :template-defaults="templatePathDefaults"
          :template-category="templateCategory"
        />

        <!-- Step 4: Schedule -->
        <ScheduleStep
          v-else-if="currentStepData?.id === 'schedule'"
          v-model:schedule-type="scheduleType"
          v-model:scheduled-time="scheduledTime"
          :weather-status="weatherStatus"
          :suggested-times="templateDetail?.suggested_schedule?.alternative_times"
        />

        <!-- Step 5: Review -->
        <ReviewStep
          v-else-if="currentStepData?.id === 'review'"
          v-model:mission-name="missionName"
          :template="templateForReview"
          :selected-zones="selectedZoneIds"
          :schedule-type="scheduleType"
          :scheduled-time="scheduledTime"
          :weather-status="weatherStatus"
          :peripheral-status="peripheralStatus"
          :path-config="pathConfig"
        />
      </template>
    </div>

    <!-- Error Banner -->
    <div v-if="error && currentStep > 0" class="error-banner">
      <span class="error-text">{{ error }}</span>
      <button class="dismiss-btn" @click="error = null">&times;</button>
    </div>

    <!-- Footer -->
    <div class="wizard-footer">
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
        {{ isEditMode
          ? (isConsumerMode ? 'Save Changes' : 'Update Mission')
          : (isConsumerMode ? 'Start Job' : 'Create Mission')
        }}
      </Button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.unified-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 600px;
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

.wizard-title h2 {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.consumer-wizard .wizard-title h2 {
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
