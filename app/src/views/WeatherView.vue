<template>
  <div class="weather-page">
    <div class="page-header">
      <h4>Weather Monitoring</h4>
      <div class="header-actions">
        <button class="btn-secondary" :disabled="weatherStore.loading" @click="weatherStore.fetchWeather()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Refresh
        </button>
        <button class="btn-secondary" @click="showSettings = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
      </div>
    </div>

    <div v-if="!weatherStore.isConfigured" class="config-prompt">
      <div class="card">
        <div class="card-body text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="large-icon">
            <path d="M19.35 10.04A19.35 10.04 0 0 0 19.35 10.04"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
          <h3>Weather Integration Not Configured</h3>
          <p>Configure weather settings to enable automatic task postponement based on weather conditions.</p>
          <button class="btn-primary" @click="showSettings = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Configure Weather Settings
          </button>
        </div>
      </div>
    </div>

    <div v-else class="weather-content">
      <!-- Current Weather -->
      <div class="card">
        <div class="card-header">
          <h3>Current Conditions</h3>
        </div>
        <div class="card-body">
          <div v-if="weatherStore.currentWeather" class="current-conditions">
            <div class="main-condition">
              <div class="weather-icon-large">{{ weatherStore.currentConditionIcon }}</div>
              <div class="temperature-large">{{ Math.round(weatherStore.currentWeather.temp) }}°C</div>
              <div class="condition-description">
                {{ weatherStore.currentWeather.conditions[0]?.description || 'Unknown' }}
              </div>
              <div class="feels-like">
                Feels like {{ Math.round(weatherStore.currentWeather.feels_like) }}°C
              </div>
              <div class="temp-range">
                H: {{ Math.round(weatherStore.currentWeather.temp_max) }}°
                L: {{ Math.round(weatherStore.currentWeather.temp_min) }}°
              </div>
            </div>

            <div class="weather-metrics">
              <div class="metric-card">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>
                </svg>
                <div class="metric-details">
                  <div class="metric-label">Wind Speed</div>
                  <div class="metric-value">{{ weatherStore.currentWeather.wind_speed.toFixed(1) }} m/s</div>
                  <div class="metric-extra">
                    Direction: {{ weatherStore.currentWeather.wind_deg }}°
                    <span v-if="weatherStore.currentWeather.wind_gust">
                      | Gusts: {{ weatherStore.currentWeather.wind_gust.toFixed(1) }} m/s
                    </span>
                  </div>
                </div>
              </div>

              <div class="metric-card">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
                <div class="metric-details">
                  <div class="metric-label">Humidity</div>
                  <div class="metric-value">{{ weatherStore.currentWeather.humidity }}%</div>
                  <div class="metric-extra">
                    Pressure: {{ weatherStore.currentWeather.pressure }} hPa
                  </div>
                </div>
              </div>

              <div class="metric-card">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <div class="metric-details">
                  <div class="metric-label">Visibility</div>
                  <div class="metric-value">{{ (weatherStore.currentWeather.visibility / 1000).toFixed(1) }} km</div>
                  <div class="metric-extra">
                    Cloud Cover: {{ weatherStore.currentWeather.clouds }}%
                  </div>
                </div>
              </div>

              <div class="metric-card" v-if="weatherStore.currentWeather.rain_1h || weatherStore.currentWeather.snow_1h">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="19" x2="8" y2="21"></line>
                  <line x1="8" y1="13" x2="8" y2="15"></line>
                  <line x1="16" y1="19" x2="16" y2="21"></line>
                  <line x1="16" y1="13" x2="16" y2="15"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="12" y1="15" x2="12" y2="17"></line>
                  <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>
                </svg>
                <div class="metric-details">
                  <div class="metric-label">
                    {{ weatherStore.currentWeather.rain_1h ? 'Rain' : 'Snow' }}
                  </div>
                  <div class="metric-value">
                    {{ (weatherStore.currentWeather.rain_1h || weatherStore.currentWeather.snow_1h || 0).toFixed(1) }} mm/h
                  </div>
                  <div class="metric-extra">Last hour</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="weatherStore.error" class="error-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="error-text">{{ weatherStore.error }}</div>
          </div>

          <div v-else class="loading-state">
            <div class="spinner"></div>
          </div>
        </div>
      </div>

      <!-- Safety Status -->
      <div class="card" v-if="weatherStore.currentWeather">
        <div class="card-header">
          <h3>Operations Safety Status</h3>
        </div>
        <div class="card-body">
          <div :class="['safety-banner', safetyCheck.safe ? 'safe' : 'warning']">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="!safetyCheck.safe" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <path v-else d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <line v-if="!safetyCheck.safe" x1="12" y1="9" x2="12" y2="13"></line>
              <line v-if="!safetyCheck.safe" x1="12" y1="17" x2="12.01" y2="17"></line>
              <polyline v-else points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div>
              <h4>{{ safetyCheck.safe ? 'Safe for Operations' : 'Unsafe for Operations' }}</h4>
              <div v-if="!safetyCheck.safe">
                <div v-for="(reason, index) in safetyCheck.reasons" :key="index" class="reason">
                  • {{ reason }}
                </div>
              </div>
              <div v-else>
                All weather conditions are within safe operating parameters.
              </div>
            </div>
          </div>

          <div class="thresholds-grid">
            <h4>Current Safety Thresholds</h4>
            <div class="threshold-items">
              <div class="threshold-item">
                <div class="threshold-label">Max Wind Speed</div>
                <div class="threshold-value">{{ weatherStore.settings.conditions.maxWindSpeed }} m/s</div>
                <div :class="['threshold-current', isThresholdExceeded('wind') ? 'exceeded' : 'safe']">
                  Current: {{ weatherStore.currentWeather.wind_speed.toFixed(1) }} m/s
                </div>
              </div>
              <div class="threshold-item">
                <div class="threshold-label">Max Rain Rate</div>
                <div class="threshold-value">{{ weatherStore.settings.conditions.maxRainRate }} mm/h</div>
                <div :class="['threshold-current', isThresholdExceeded('rain') ? 'exceeded' : 'safe']">
                  Current: {{ (weatherStore.currentWeather.rain_1h || 0).toFixed(1) }} mm/h
                </div>
              </div>
              <div class="threshold-item">
                <div class="threshold-label">Min Visibility</div>
                <div class="threshold-value">{{ (weatherStore.settings.conditions.minVisibility / 1000).toFixed(1) }} km</div>
                <div :class="['threshold-current', isThresholdExceeded('visibility') ? 'exceeded' : 'safe']">
                  Current: {{ (weatherStore.currentWeather.visibility / 1000).toFixed(1) }} km
                </div>
              </div>
              <div class="threshold-item">
                <div class="threshold-label">Temperature Range</div>
                <div class="threshold-value">
                  {{ weatherStore.settings.conditions.minTemp }}°C - {{ weatherStore.settings.conditions.maxTemp }}°C
                </div>
                <div :class="['threshold-current', isThresholdExceeded('temp') ? 'exceeded' : 'safe']">
                  Current: {{ Math.round(weatherStore.currentWeather.temp) }}°C
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <weather-settings-dialog v-model="showSettings" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import WeatherSettingsDialog from '@/components/weather/WeatherSettingsDialog.vue'

const weatherStore = useWeatherStore()
const showSettings = ref(false)

const safetyCheck = computed(() => {
  if (!weatherStore.currentWeather) {
    return { safe: true, reasons: [] }
  }
  return weatherStore.checkWeatherSafety(weatherStore.currentWeather)
})

function isThresholdExceeded(type: string): boolean {
  if (!weatherStore.currentWeather) return false

  const weather = weatherStore.currentWeather
  const conds = weatherStore.settings.conditions

  switch (type) {
    case 'wind':
      return weather.wind_speed > conds.maxWindSpeed
    case 'rain':
      return (weather.rain_1h || 0) > conds.maxRainRate
    case 'visibility':
      return weather.visibility < conds.minVisibility
    case 'temp':
      return weather.temp < conds.minTemp || weather.temp > conds.maxTemp
    default:
      return false
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.weather-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h4 {
    margin: 0;
    color: $primary;
    font-size: 24px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;

  svg {
    width: 18px;
    height: 18px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: $primary;
  color: white;

  &:hover:not(:disabled) {
    background: darken($primary, 5%);
  }
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;

  &:hover:not(:disabled) {
    background: #e5e7eb;
  }
}

.card {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  margin-bottom: 20px;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }
}

.card-body {
  padding: 20px;

  &.text-center {
    text-align: center;
    padding: 48px 20px;

    .large-icon {
      width: 96px;
      height: 96px;
      color: #9ca3af;
      margin-bottom: 16px;
    }

    h3 {
      margin: 0 0 12px;
      color: #111827;
    }

    p {
      color: #6b7280;
      margin-bottom: 24px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
  }
}

.current-conditions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.main-condition {
  text-align: center;

  .weather-icon-large {
    font-size: 96px;
    line-height: 1;
    margin-bottom: 16px;
  }

  .temperature-large {
    font-size: 48px;
    font-weight: 600;
    color: $primary;
    line-height: 1;
    margin-bottom: 8px;
  }

  .condition-description {
    font-size: 18px;
    color: #6b7280;
    text-transform: capitalize;
    margin-bottom: 4px;
  }

  .feels-like {
    color: #9ca3af;
    font-size: 14px;
  }

  .temp-range {
    color: #9ca3af;
    font-size: 12px;
    margin-top: 4px;
  }
}

.weather-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.metric-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;

  svg {
    width: 24px;
    height: 24px;
    color: $primary;
    flex-shrink: 0;
  }

  .metric-details {
    flex: 1;

    .metric-label {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 600;
      color: $primary;
      line-height: 1.2;
    }

    .metric-extra {
      margin-top: 4px;
      font-size: 12px;
      color: #9ca3af;
    }
  }
}

.safety-banner {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;

  svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  h4 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  .reason {
    margin-top: 4px;
    font-size: 14px;
  }

  &.safe {
    background: #d1fae5;
    color: #065f46;
  }

  &.warning {
    background: #fef3c7;
    color: #92400e;
  }
}

.thresholds-grid {
  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #111827;
  }

  .threshold-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .threshold-item {
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;

    .threshold-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .threshold-value {
      font-size: 16px;
      font-weight: 600;
      color: $primary;
      margin-bottom: 4px;
    }

    .threshold-current {
      font-size: 13px;
      font-weight: 500;

      &.safe {
        color: #059669;
      }

      &.exceeded {
        color: #dc2626;
      }
    }
  }
}

.error-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;

  svg {
    width: 64px;
    height: 64px;
    color: #ef4444;
    margin-bottom: 16px;
  }

  .error-text {
    color: #ef4444;
    font-size: 16px;
  }
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: $primary;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
