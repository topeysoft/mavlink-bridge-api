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

          <!-- Priority Indicator -->
          <div v-if="mission.priority !== 'normal'" class="priority-indicator">
            <span :class="`priority-${mission.priority}`">{{ mission.priority.toUpperCase() }}</span>
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
import { useMissionsStore } from '@/stores/missions'
import type { Mission } from '@/types'

const weatherStore = useWeatherStore()
const missionsStore = useMissionsStore()

const upcomingMissions = computed(() => {
  // Get upcoming missions from store (enabled missions sorted by next run time)
  return missionsStore.missions
    .filter(m => m.enabled)
    .slice(0, 5) // Show up to 5 upcoming missions
})

function getStatusText(mission: Mission): string {
  return mission.enabled ? 'Scheduled' : 'Disabled'
}

function getStatusColor(mission: Mission): string {
  return mission.enabled ? '#10b981' : '#6b7280'
}

function formatSchedule(schedule: Mission['schedule']): string {
  const startTime = new Date(schedule.startTime)
  const timeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const dateStr = startTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })

  return `${dateStr} at ${timeStr}`
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

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
