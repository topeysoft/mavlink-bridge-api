<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import { useFeaturesStore } from '@/stores/features'
import type { WeatherCheckResult, SuggestedTimeSlot } from '@client'

interface Props {
  weatherStatus: WeatherCheckResult
  suggestedTimes?: SuggestedTimeSlot[]
}

const props = defineProps<Props>()

const scheduleType = defineModel<'now' | 'scheduled'>('scheduleType', { required: true })
const scheduledTime = defineModel<Date | null>('scheduledTime', { required: true })

const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const title = computed(() => isConsumerMode.value ? 'When should we start?' : 'Schedule Mission')

const description = computed(() =>
  isConsumerMode.value
    ? 'Choose when you want the job to run'
    : 'Set the mission schedule'
)

// For the datetime input
const dateTimeValue = ref('')

// Convert Date to datetime-local input value
function dateToInputValue(date: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const localDate = new Date(d.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

// Convert datetime-local input value to Date
function inputValueToDate(value: string): Date | null {
  if (!value) return null
  return new Date(value)
}

// Initialize dateTimeValue from scheduledTime
watch(() => scheduledTime.value, (newDate) => {
  dateTimeValue.value = dateToInputValue(newDate)
}, { immediate: true })

// Update scheduledTime when input changes
function handleDateTimeChange(event: Event) {
  const target = event.target as HTMLInputElement
  scheduledTime.value = inputValueToDate(target.value)
}

// Get minimum datetime (now + 5 minutes)
const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 5)
  return dateToInputValue(now)
})

const weatherSuitable = computed(() => props.weatherStatus.suitable)

const weatherMessage = computed(() => {
  if (weatherSuitable.value) {
    return isConsumerMode.value
      ? 'Weather looks good for this job!'
      : 'Current conditions are suitable'
  }
  return isConsumerMode.value
    ? 'Weather might not be ideal right now'
    : 'Current conditions may not be suitable'
})

const weatherIcon = computed(() => weatherSuitable.value ? '☀️' : '⚠️')

function formatSuggestion(dateStr: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }
  return date.toLocaleDateString(undefined, options)
}

function selectSuggestion(dateStr: string) {
  scheduledTime.value = new Date(dateStr)
  scheduleType.value = 'scheduled'
}
</script>

<template>
  <div class="schedule-step" :class="{ 'consumer-step': isConsumerMode }">
    <div class="step-header">
      <h3 class="step-title">{{ title }}</h3>
      <p class="step-description">{{ description }}</p>
    </div>

    <!-- Weather Status -->
    <Card class="weather-card" :class="{ 'warning': !weatherSuitable }">
      <div class="weather-content">
        <span class="weather-icon">{{ weatherIcon }}</span>
        <div class="weather-info">
          <span class="weather-message">{{ weatherMessage }}</span>
          <span v-if="!weatherSuitable && weatherStatus.reasons.length > 0" class="weather-reason">
            {{ weatherStatus.reasons[0] }}
          </span>
        </div>
        <Badge :variant="weatherSuitable ? 'success' : 'warning'" size="small">
          {{ weatherSuitable ? (isConsumerMode ? 'Good' : 'Suitable') : (isConsumerMode ? 'Caution' : 'Warning') }}
        </Badge>
      </div>
    </Card>

    <!-- Schedule Options -->
    <div class="schedule-options">
      <Card
        class="schedule-option"
        :class="{ 'selected': scheduleType === 'now' }"
        @click="scheduleType = 'now'"
      >
        <div class="option-content">
          <div class="option-icon">🚀</div>
          <div class="option-info">
            <span class="option-title">
              {{ isConsumerMode ? 'Start Now' : 'Run Immediately' }}
            </span>
            <span class="option-description">
              {{ isConsumerMode ? 'Begin the job right away' : 'Execute mission as soon as possible' }}
            </span>
          </div>
          <div class="option-radio" :class="{ 'active': scheduleType === 'now' }"></div>
        </div>
      </Card>

      <Card
        class="schedule-option"
        :class="{ 'selected': scheduleType === 'scheduled' }"
        @click="scheduleType = 'scheduled'"
      >
        <div class="option-content">
          <div class="option-icon">📅</div>
          <div class="option-info">
            <span class="option-title">
              {{ isConsumerMode ? 'Schedule for Later' : 'Schedule' }}
            </span>
            <span class="option-description">
              {{ isConsumerMode ? 'Pick a date and time' : 'Set specific start time' }}
            </span>
          </div>
          <div class="option-radio" :class="{ 'active': scheduleType === 'scheduled' }"></div>
        </div>
      </Card>
    </div>

    <!-- DateTime Picker (when scheduled) -->
    <div v-if="scheduleType === 'scheduled'" class="datetime-picker">
      <label class="datetime-label">
        {{ isConsumerMode ? 'When?' : 'Start Time' }}
      </label>
      <input
        type="datetime-local"
        class="datetime-input"
        :value="dateTimeValue"
        :min="minDateTime"
        @input="handleDateTimeChange"
      />
    </div>

    <!-- Weather Suggestions (when unsuitable and scheduled) -->
    <div
      v-if="!weatherSuitable && suggestedTimes && suggestedTimes.length > 0"
      class="suggestions"
    >
      <span class="suggestions-label">
        {{ isConsumerMode ? 'Better times:' : 'Suggested times:' }}
      </span>
      <div class="suggestion-chips">
        <button
          v-for="(slot, index) in suggestedTimes.slice(0, 3)"
          :key="index"
          class="suggestion-chip"
          @click="selectSuggestion(slot.start_time)"
        >
          {{ formatSuggestion(slot.start_time) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.schedule-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.step-header {
  text-align: center;
}

.consumer-step .step-header {
  padding: var(--spacing-md) 0;
}

.step-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-step .step-title {
  font-size: var(--font-size-xl);
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.weather-card {
  border-left: 4px solid var(--positive);

  &.warning {
    border-left-color: var(--warning);
  }
}

.weather-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.weather-icon {
  font-size: 24px;
}

.weather-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.weather-message {
  font-weight: 500;
  color: var(--text-primary);
}

.weather-reason {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.schedule-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.schedule-option {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    border-color: var(--primary);
  }

  &.selected {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.05);
  }
}

.option-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.consumer-step .option-content {
  padding: var(--spacing-md);
}

.option-icon {
  font-size: 28px;
}

.consumer-step .option-icon {
  font-size: 36px;
}

.option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.option-title {
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.consumer-step .option-title {
  font-size: var(--font-size-lg);
}

.option-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.option-radio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  transition: all 0.2s ease;

  &.active {
    border-color: var(--primary);
    background: var(--primary);
    box-shadow: inset 0 0 0 4px white;
  }
}

.datetime-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.datetime-label {
  font-weight: 500;
  color: var(--text-primary);
}

.datetime-input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--bg-primary);
  color: var(--text-primary);

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
  }
}

.consumer-step .datetime-input {
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.suggestions-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.suggestion-chip {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }
}
</style>
