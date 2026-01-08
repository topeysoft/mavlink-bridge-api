<template>
  <div class="weather-widget">
    <div class="widget-header">
      <div class="widget-title">Weather</div>
      <button
        class="refresh-button"
        :disabled="weatherStore.loading"
        @click="weatherStore.fetchWeather()"
        title="Refresh weather"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: weatherStore.loading }">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    </div>

    <div class="widget-content">
      <div v-if="!weatherStore.isConfigured" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19.35 10.04A19.35 10.04 0 0 0 19.35 10.04"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
        <div class="empty-text">Weather not configured</div>
        <button class="link-button" @click="$router.push('/settings')">Configure</button>
      </div>

      <div v-else-if="weatherStore.error" class="error-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="error-text">{{ weatherStore.error }}</div>
        <button class="link-button" @click="weatherStore.fetchWeather()">Retry</button>
      </div>

      <div v-else-if="weatherStore.currentWeather" class="weather-content">
        <!-- Current Condition -->
        <div class="current-weather">
          <div class="weather-icon">{{ weatherStore.currentConditionIcon }}</div>
          <div class="temperature">{{ Math.round(weatherStore.currentWeather.temp) }}°C</div>
          <div class="condition-text">
            {{ weatherStore.currentWeather.conditions[0]?.description || 'Unknown' }}
          </div>
          <div class="feels-like">
            Feels like {{ Math.round(weatherStore.currentWeather.feels_like) }}°C
          </div>
        </div>

        <!-- Safety Status -->
        <div v-if="!weatherStore.isSafeForOperations" class="safety-banner warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <div class="banner-title">Unsafe for operations</div>
            <div class="banner-caption">{{ safetyCheck.reasons[0] }}</div>
          </div>
        </div>

        <div v-else class="safety-banner safe">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div>
            <div class="banner-title">Safe for operations</div>
          </div>
        </div>

        <!-- Weather Details -->
        <div class="weather-details">
          <div class="detail-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>
            </svg>
            <span class="detail-label">Wind:</span>
            <span class="detail-value">{{ weatherStore.currentWeather.wind_speed.toFixed(1) }} m/s</span>
          </div>
          <div class="detail-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
            <span class="detail-label">Humidity:</span>
            <span class="detail-value">{{ weatherStore.currentWeather.humidity }}%</span>
          </div>
          <div class="detail-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span class="detail-label">Visibility:</span>
            <span class="detail-value">{{ (weatherStore.currentWeather.visibility / 1000).toFixed(1) }} km</span>
          </div>
          <div class="detail-row" v-if="weatherStore.currentWeather.rain_1h">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="19" x2="8" y2="21"></line>
              <line x1="8" y1="13" x2="8" y2="15"></line>
              <line x1="16" y1="19" x2="16" y2="21"></line>
              <line x1="16" y1="13" x2="16" y2="15"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="12" y1="15" x2="12" y2="17"></line>
              <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
            </svg>
            <span class="detail-label">Rain:</span>
            <span class="detail-value">{{ weatherStore.currentWeather.rain_1h.toFixed(1) }} mm/h</span>
          </div>
        </div>

        <!-- Alerts -->
        <div v-if="weatherStore.hasActiveAlerts" class="safety-banner alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <div class="banner-title">Active Weather Alerts</div>
            <div class="banner-caption">{{ weatherStore.alerts[0]?.event }}</div>
          </div>
        </div>

        <!-- Last Update -->
        <div class="last-update">
          Updated {{ formatLastUpdate() }}
        </div>
      </div>

      <div v-else class="loading-state">
        <div class="spinner"></div>
        <div class="loading-text">Loading weather...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'

const weatherStore = useWeatherStore()

const safetyCheck = computed(() => {
  if (!weatherStore.currentWeather) {
    return { safe: true, reasons: [] }
  }
  return weatherStore.checkWeatherSafety(weatherStore.currentWeather)
})

function formatLastUpdate(): string {
  if (!weatherStore.lastUpdate) return 'Never'

  const now = Date.now()
  const diff = now - weatherStore.lastUpdate
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  return `${hours} hours ago`
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.weather-widget {
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

.refresh-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #f3f4f6;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 20px;
    height: 20px;
    color: #6b7280;

    &.spinning {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.widget-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.empty-state,
.error-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;

  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
  }
}

.empty-state svg {
  color: #9ca3af;
}

.error-state svg {
  color: #ef4444;
}

.empty-text,
.loading-text {
  color: #6b7280;
  margin-bottom: 8px;
  font-size: 14px;
}

.error-text {
  color: #ef4444;
  margin-bottom: 8px;
  font-size: 14px;
}

.link-button {
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

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: $primary;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.weather-content {
  .current-weather {
    text-align: center;
    margin-bottom: 16px;

    .weather-icon {
      font-size: 64px;
      line-height: 1;
      margin-bottom: 8px;
    }

    .temperature {
      font-size: 36px;
      font-weight: 600;
      color: $primary;
      line-height: 1;
      margin-bottom: 4px;
    }

    .condition-text {
      font-size: 14px;
      color: #6b7280;
      text-transform: capitalize;
    }

    .feels-like {
      font-size: 12px;
      color: #9ca3af;
    }
  }

  .safety-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;

    svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    &.warning {
      background: #fef3c7;
      color: #92400e;
    }

    &.safe {
      background: #d1fae5;
      color: #065f46;
    }

    &.alert {
      background: #fee2e2;
      color: #991b1b;
    }

    .banner-title {
      font-weight: 600;
      font-size: 14px;
    }

    .banner-caption {
      font-size: 12px;
      margin-top: 2px;
    }
  }

  .weather-details {
    .detail-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-size: 13px;

      svg {
        width: 16px;
        height: 16px;
        color: $primary;
        flex-shrink: 0;
      }

      .detail-label {
        color: #6b7280;
        min-width: 70px;
      }

      .detail-value {
        font-weight: 500;
        margin-left: auto;
      }
    }
  }

  .last-update {
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
    margin-top: 16px;
  }
}
</style>
