<template>
  <q-card flat bordered class="weather-widget">
    <q-card-section class="weather-widget__header">
      <div class="row items-center justify-between">
        <h3 class="weather-widget__title">Weather</h3>

        <q-btn flat round dense icon="refresh" :loading="loading" @click="$emit('refresh')">
          <q-tooltip>Refresh Weather</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Current Weather -->
    <q-card-section class="weather-widget__current">
      <div v-if="weather" class="current-weather">
        <div class="current-weather__main">
          <div class="current-weather__icon">
            <q-icon :name="weatherIcon" size="48px" :color="weatherColor" />
          </div>

          <div class="current-weather__info">
            <div class="current-weather__temp">{{ Math.round(weather.temperature) }}°C</div>
            <div class="current-weather__condition">
              {{ weather.condition }}
            </div>
            <div class="current-weather__feels-like">
              Feels like {{ Math.round(weather.feelsLike) }}°C
            </div>
          </div>
        </div>

        <!-- Weather Details -->
        <div class="current-weather__details">
          <div class="weather-detail">
            <q-icon name="air" size="16px" class="weather-detail__icon" />
            <span class="weather-detail__label">Wind</span>
            <span class="weather-detail__value"> {{ weather.windSpeed }} km/h </span>
          </div>

          <div class="weather-detail">
            <q-icon name="water_drop" size="16px" class="weather-detail__icon" />
            <span class="weather-detail__label">Humidity</span>
            <span class="weather-detail__value"> {{ weather.humidity }}% </span>
          </div>

          <div class="weather-detail">
            <q-icon name="compress" size="16px" class="weather-detail__icon" />
            <span class="weather-detail__label">Pressure</span>
            <span class="weather-detail__value"> {{ weather.pressure }} hPa </span>
          </div>

          <div class="weather-detail">
            <q-icon name="visibility" size="16px" class="weather-detail__icon" />
            <span class="weather-detail__label">Visibility</span>
            <span class="weather-detail__value"> {{ weather.visibility }} km </span>
          </div>
        </div>

        <!-- Weather Alerts -->
        <div v-if="weather.alerts && weather.alerts.length > 0" class="weather-alerts">
          <q-banner
            v-for="alert in weather.alerts"
            :key="alert.id"
            :class="alertClass(alert.severity)"
            rounded
            dense
          >
            <template #avatar>
              <q-icon :name="alertIcon(alert.severity)" />
            </template>

            <div class="weather-alert__content">
              <div class="weather-alert__title">
                {{ alert.title }}
              </div>
              <div class="weather-alert__description">
                {{ alert.description }}
              </div>
            </div>
          </q-banner>
        </div>
      </div>

      <!-- Loading state -->
      <div v-else-if="loading" class="weather-widget__loading">
        <q-skeleton type="QAvatar" size="48px" />
        <div class="q-ml-md">
          <q-skeleton type="text" width="60px" />
          <q-skeleton type="text" width="100px" />
        </div>
      </div>

      <!-- Error state -->
      <div v-else class="weather-widget__error">
        <q-icon name="error" size="32px" color="negative" />
        <div class="q-mt-sm text-center">
          <div class="text-body2">Weather data unavailable</div>
          <q-btn flat size="sm" label="Retry" class="q-mt-xs" @click="$emit('refresh')" />
        </div>
      </div>
    </q-card-section>

    <!-- Forecast -->
    <q-separator v-if="forecast && forecast.length > 0" />
    <q-card-section v-if="forecast && forecast.length > 0" class="weather-widget__forecast">
      <div class="weather-widget__forecast-title">3-Day Forecast</div>

      <div class="forecast-list">
        <div v-for="day in forecast.slice(0, 3)" :key="day.date" class="forecast-item">
          <div class="forecast-item__day">
            {{ formatDay(day.date) }}
          </div>

          <div class="forecast-item__icon">
            <q-icon :name="getWeatherIcon(day.condition)" size="20px" color="primary" />
          </div>

          <div class="forecast-item__temps">
            <span class="forecast-item__high"> {{ Math.round(day.highTemp) }}° </span>
            <span class="forecast-item__low"> {{ Math.round(day.lowTemp) }}° </span>
          </div>

          <div class="forecast-item__rain">
            <q-icon name="water_drop" size="12px" class="q-mr-xs" />
            {{ day.rainChance }}%
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading" color="primary" />
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Types
interface WeatherAlert {
  id: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'severe'
}

interface Weather {
  temperature: number
  feelsLike: number
  condition: string
  humidity: number
  windSpeed: number
  pressure: number
  visibility: number
  alerts?: WeatherAlert[]
}

interface ForecastDay {
  date: string
  condition: string
  highTemp: number
  lowTemp: number
  rainChance: number
}

interface Props {
  weather?: Weather
  forecast?: ForecastDay[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
defineEmits<{
  refresh: []
}>()

// Computed properties
const weatherIcon = computed(() => {
  if (!props.weather) return 'wb_sunny'
  return getWeatherIcon(props.weather.condition)
})

const weatherColor = computed(() => {
  if (!props.weather) return 'primary'

  const temp = props.weather.temperature
  if (temp > 30) return 'negative'
  if (temp > 20) return 'warning'
  if (temp > 10) return 'positive'
  return 'info'
})

// Methods
const getWeatherIcon = (condition: string) => {
  const conditionLower = condition.toLowerCase()

  if (conditionLower.includes('rain') || conditionLower.includes('shower')) {
    return 'rainy'
  } else if (conditionLower.includes('snow')) {
    return 'ac_unit'
  } else if (conditionLower.includes('cloud')) {
    return 'cloud'
  } else if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
    return 'thunderstorm'
  } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
    return 'foggy'
  } else if (conditionLower.includes('wind')) {
    return 'air'
  } else {
    return 'wb_sunny'
  }
}

const alertClass = (severity: string) => {
  switch (severity) {
    case 'severe':
      return 'bg-negative text-white'
    case 'warning':
      return 'bg-warning text-dark'
    case 'info':
    default:
      return 'bg-info text-white'
  }
}

const alertIcon = (severity: string) => {
  switch (severity) {
    case 'severe':
      return 'dangerous'
    case 'warning':
      return 'warning'
    case 'info':
    default:
      return 'info'
  }
}

const formatDay = (dateString: string) => {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
}
</script>

<style lang="scss" scoped>
.weather-widget {
  border-radius: 12px;
}

.weather-widget__header {
  padding: 20px 24px 16px;
}

.weather-widget__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.weather-widget__current {
  padding: 24px;
}

.current-weather__main {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.current-weather__icon {
  margin-right: 16px;
}

.current-weather__info {
  flex: 1;
}

.current-weather__temp {
  font-size: 2rem;
  font-weight: 700;
  color: var(--q-dark);
  line-height: 1;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.current-weather__condition {
  font-size: 1rem;
  font-weight: 500;
  color: var(--q-grey-7);
  margin-bottom: 4px;
  text-transform: capitalize;
}

.current-weather__feels-like {
  font-size: 0.875rem;
  color: var(--q-grey-6);
}

.current-weather__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.weather-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.weather-detail__icon {
  color: var(--q-primary);
}

.weather-detail__label {
  color: var(--q-grey-6);
  min-width: 60px;
}

.weather-detail__value {
  font-weight: 600;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.weather-alerts {
  margin-top: 16px;

  .q-banner + .q-banner {
    margin-top: 8px;
  }
}

.weather-alert__title {
  font-weight: 600;
  margin-bottom: 4px;
}

.weather-alert__description {
  font-size: 0.875rem;
  opacity: 0.9;
}

.weather-widget__loading {
  display: flex;
  align-items: center;
  padding: 24px;
}

.weather-widget__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.weather-widget__forecast {
  padding: 16px 24px 24px;
}

.weather-widget__forecast-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--q-dark);
  margin-bottom: 12px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.forecast-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forecast-item {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .body--dark & {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }
}

.forecast-item__day {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.forecast-item__temps {
  display: flex;
  gap: 8px;
  font-size: 0.875rem;
  min-width: 60px;
}

.forecast-item__high {
  font-weight: 600;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.forecast-item__low {
  color: var(--q-grey-6);
}

.forecast-item__rain {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: var(--q-info);
  min-width: 40px;
}

// Responsive adjustments
@media (max-width: 599px) {
  .weather-widget__header {
    padding: 16px 20px 12px;
  }

  .weather-widget__current {
    padding: 20px;
  }

  .current-weather__main {
    margin-bottom: 16px;
  }

  .current-weather__temp {
    font-size: 1.75rem;
  }

  .current-weather__details {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .weather-widget__forecast {
    padding: 12px 20px 20px;
  }
}
</style>
