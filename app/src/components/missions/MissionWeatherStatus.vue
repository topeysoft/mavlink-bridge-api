<template>
  <div v-if="showStatus" class="mission-weather-status" :class="statusClass">
    <div class="status-icon">
      <svg v-if="isPostponed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <svg v-else-if="isSafe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <div v-else class="weather-icon">{{ weatherStore.currentConditionIcon }}</div>
    </div>

    <div class="status-content">
      <div class="status-title">{{ statusTitle }}</div>
      <div class="status-description">{{ statusDescription }}</div>
      <div v-if="mission.postponedUntil" class="status-retry">
        Retry scheduled: {{ formatRetryTime(mission.postponedUntil) }}
      </div>
    </div>

    <button v-if="showRefresh" class="refresh-button" @click="weatherStore.fetchWeather()" :disabled="weatherStore.loading">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: weatherStore.loading }">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { MissionScheduler } from '@/services/missionScheduler'
import type { Mission } from '@/types'

const props = defineProps<{
  mission: Mission
}>()

const weatherStore = useWeatherStore()

const showStatus = computed(() => {
  return props.mission.weatherSafetyEnabled && weatherStore.isConfigured
})

const weatherCheck = computed(() => {
  if (!weatherStore.currentWeather) return null
  return weatherStore.checkWeatherSafety(weatherStore.currentWeather)
})

const isPostponed = computed(() => {
  return props.mission.status === 'postponed'
})

const isSafe = computed(() => {
  return weatherCheck.value?.safe ?? true
})

const statusClass = computed(() => {
  if (isPostponed.value) return 'status-postponed'
  if (!isSafe.value) return 'status-unsafe'
  return 'status-safe'
})

const statusTitle = computed(() => {
  if (isPostponed.value) {
    return 'Mission Postponed'
  }
  if (!isSafe.value) {
    return 'Unsafe Weather Conditions'
  }
  return 'Weather Conditions Safe'
})

const statusDescription = computed(() => {
  if (isPostponed.value && props.mission.postponedReason) {
    return props.mission.postponedReason
  }
  if (!isSafe.value && weatherCheck.value) {
    return MissionScheduler.formatPostponementReason(weatherCheck.value.reasons)
  }
  if (weatherStore.currentWeather) {
    const temp = Math.round(weatherStore.currentWeather.temp)
    const desc = weatherStore.currentWeather.conditions[0]?.description || 'Unknown'
    return `${temp}°C, ${desc}`
  }
  return 'All conditions within safe parameters'
})

const showRefresh = computed(() => {
  return !isPostponed.value
})

function formatRetryTime(retryTime: string): string {
  const date = new Date(retryTime)
  const now = new Date()

  const diffMs = date.getTime() - now.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes <= 0) {
    return 'Now (ready to retry)'
  }

  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
  }

  const diffHours = Math.round(diffMinutes / 60)
  return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.mission-weather-status {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  border-left: 4px solid;
  margin-bottom: 16px;

  &.status-safe {
    background: #d1fae5;
    border-color: #10b981;
    color: #065f46;

    svg {
      color: #10b981;
    }
  }

  &.status-unsafe {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;

    svg {
      color: #f59e0b;
    }
  }

  &.status-postponed {
    background: #fee2e2;
    border-color: #ef4444;
    color: #991b1b;

    svg {
      color: #ef4444;
    }
  }

  .status-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 24px;
      height: 24px;
    }

    .weather-icon {
      font-size: 24px;
      line-height: 1;
    }
  }

  .status-content {
    flex: 1;
    min-width: 0;

    .status-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .status-description {
      font-size: 13px;
      opacity: 0.9;
    }

    .status-retry {
      font-size: 12px;
      margin-top: 4px;
      font-style: italic;
      opacity: 0.8;
    }
  }

  .refresh-button {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 18px;
      height: 18px;

      &.spinning {
        animation: spin 1s linear infinite;
      }
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
