<template>
  <div class="upcoming-missions-widget">
    <div class="widget-header">
      <div class="widget-title">Upcoming Missions</div>
      <button class="view-all-button" @click="$router.push('/missions')">
        View All
      </button>
    </div>

    <div class="widget-content">
      <div v-if="upcomingMissions.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <div class="empty-text">No upcoming missions scheduled</div>
      </div>

      <div v-else class="missions-list">
        <div
          v-for="mission in upcomingMissions"
          :key="mission.id"
          class="mission-item"
          @click="$router.push(`/missions/${mission.id}`)"
        >
          <div class="mission-header">
            <div class="mission-name">{{ mission.name }}</div>
            <div class="mission-status" :style="{ color: getStatusColor(mission) }">
              {{ getStatusText(mission) }}
            </div>
          </div>

          <div v-if="mission.schedule" class="mission-schedule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{{ formatSchedule(mission.schedule) }}</span>
          </div>

          <!-- Weather Safety Indicator -->
          <div v-if="mission.weatherSafetyEnabled && weatherStore.isConfigured" class="weather-indicator">
            <template v-if="mission.status === 'postponed'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-warning">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span class="text-warning">{{ mission.postponedReason || 'Postponed due to conditions' }}</span>
            </template>
            <template v-else-if="!isWeatherSafe">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-warning">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span class="text-warning">Weather conditions unsafe</span>
            </template>
            <template v-else>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-safe">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span class="text-safe">Weather safe</span>
            </template>
          </div>

          <div v-if="mission.postponedUntil" class="retry-time">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Retry: {{ formatRetryTime(mission.postponedUntil) }}</span>
          </div>
        </div>
      </div>

      <!-- Weather Summary -->
      <div v-if="weatherStore.isConfigured && weatherStore.currentWeather" class="weather-summary">
        <div class="weather-summary-header">Current Weather</div>
        <div class="weather-summary-content">
          <div class="weather-icon">{{ weatherStore.currentConditionIcon }}</div>
          <div class="weather-details">
            <div class="weather-temp">{{ Math.round(weatherStore.currentWeather.temp) }}°C</div>
            <div class="weather-condition">{{ weatherStore.currentWeather.conditions[0]?.description }}</div>
          </div>
          <div class="weather-safety" :class="weatherStore.isSafeForOperations ? 'safe' : 'unsafe'">
            {{ weatherStore.isSafeForOperations ? 'Safe' : 'Unsafe' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { MissionScheduler } from '@/services/missionScheduler'
import type { Mission } from '@/types'

// Mock missions for demonstration - in real app, this would come from a missions store
const mockMissions: Mission[] = [
  {
    id: '1',
    name: 'Front Yard Mowing',
    zones: ['zone-1'],
    attachment: 'mower-1',
    schedule: {
      type: 'recurring',
      startTime: '2024-01-15T08:00:00',
      days: ['Monday', 'Wednesday', 'Friday']
    },
    status: 'pending',
    created: '2024-01-01',
    weatherSafetyEnabled: true
  },
  {
    id: '2',
    name: 'Back Yard Maintenance',
    zones: ['zone-2'],
    attachment: 'mower-1',
    schedule: {
      type: 'once',
      startTime: '2024-01-15T14:00:00'
    },
    status: 'pending',
    created: '2024-01-01',
    weatherSafetyEnabled: true
  }
]

const weatherStore = useWeatherStore()

const upcomingMissions = computed(() => {
  // In real app, filter and sort missions from store
  return mockMissions.filter(m => m.status === 'pending' || m.status === 'postponed')
})

const isWeatherSafe = computed(() => {
  return weatherStore.isSafeForOperations
})

function getStatusText(mission: Mission): string {
  return MissionScheduler.getMissionStatusText(mission)
}

function getStatusColor(mission: Mission): string {
  return MissionScheduler.getMissionStatusColor(mission)
}

function formatSchedule(schedule: Mission['schedule']): string {
  if (!schedule) return 'Not scheduled'

  const startTime = new Date(schedule.startTime)
  const timeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  if (schedule.type === 'once') {
    const dateStr = startTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
    return `${dateStr} at ${timeStr}`
  }

  if (schedule.days && schedule.days.length > 0) {
    const daysStr = schedule.days.map(d => d.substring(0, 3)).join(', ')
    return `${daysStr} at ${timeStr}`
  }

  return `Daily at ${timeStr}`
}

function formatRetryTime(retryTime: string): string {
  const date = new Date(retryTime)
  const now = new Date()

  const diffMs = date.getTime() - now.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes <= 0) {
    return 'Ready now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`
  }

  const diffHours = Math.round(diffMinutes / 60)
  return `${diffHours}h`
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.upcoming-missions-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.widget-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.view-all-button {
  background: none;
  border: none;
  color: $primary;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;

  &:hover {
    text-decoration: underline;
  }
}

.widget-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;

  svg {
    width: 48px;
    height: 48px;
    color: #9ca3af;
    margin-bottom: 12px;
  }

  .empty-text {
    color: #6b7280;
    font-size: 14px;
  }
}

.missions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mission-item {
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    border-color: $primary;
  }

  .mission-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .mission-name {
      font-weight: 600;
      font-size: 14px;
      color: #111827;
    }

    .mission-status {
      font-size: 12px;
      font-weight: 500;
    }
  }

  .mission-schedule {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .weather-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    margin-top: 8px;
    padding: 6px 8px;
    background: white;
    border-radius: 4px;

    svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .icon-warning {
      color: #f59e0b;
    }

    .icon-safe {
      color: #10b981;
    }

    .text-warning {
      color: #92400e;
    }

    .text-safe {
      color: #065f46;
    }
  }

  .retry-time {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
    margin-top: 8px;
    font-style: italic;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.weather-summary {
  margin-top: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;

  .weather-summary-header {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .weather-summary-content {
    display: flex;
    align-items: center;
    gap: 12px;

    .weather-icon {
      font-size: 32px;
      line-height: 1;
    }

    .weather-details {
      flex: 1;

      .weather-temp {
        font-size: 18px;
        font-weight: 600;
        color: $primary;
        line-height: 1.2;
      }

      .weather-condition {
        font-size: 12px;
        color: #6b7280;
        text-transform: capitalize;
      }
    }

    .weather-safety {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;

      &.safe {
        background: #d1fae5;
        color: #065f46;
      }

      &.unsafe {
        background: #fee2e2;
        color: #991b1b;
      }
    }
  }
}
</style>
