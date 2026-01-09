import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useYardStore } from '@/stores/yard'
import { useNotificationsStore } from '@/stores/notifications'
import { apiClient, API_ENDPOINTS } from '@/services'
import type { WeatherData } from '@/services/types/yard.types'

export interface WeatherAlert {
  type: 'storm' | 'rain' | 'wind' | 'temperature' | 'humidity'
  severity: 'minor' | 'moderate' | 'severe' | 'extreme'
  message: string
  startTime: string
  endTime: string
  recommendation: string
}

export interface OperationSafety {
  safe: boolean
  score: number // 0-100
  factors: {
    temperature: { safe: boolean; value: number; reason?: string }
    precipitation: { safe: boolean; value: number; reason?: string }
    wind: { safe: boolean; value: number; reason?: string }
    humidity: { safe: boolean; value: number; reason?: string }
    visibility: { safe: boolean; value: number; reason?: string }
  }
  warnings: string[]
  blockers: string[]
}

export interface WeatherPreferences {
  units: {
    temperature: 'celsius' | 'fahrenheit'
    wind: 'kmh' | 'mph' | 'ms'
    precipitation: 'mm' | 'inches'
  }
  operationLimits: {
    maxWindSpeed: number // km/h
    maxPrecipitation: number // mm/hr
    minTemperature: number // celsius
    maxTemperature: number // celsius
    minVisibility: number // km
    maxHumidity: number // percentage
  }
  alertThresholds: {
    temperature: { min: number; max: number }
    wind: number
    precipitation: number
  }
  autoRefresh: boolean
  refreshInterval: number // minutes
}

export function useWeather(yardId?: string) {
  const yardStore = useYardStore()
  const notificationsStore = useNotificationsStore()
  const { currentYard } = storeToRefs(yardStore)
  
  // State
  const weather = ref<WeatherData | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const lastUpdated = ref<string | null>(null)
  const refreshInterval = ref<number | null>(null)
  
  // Preferences
  const preferences = ref<WeatherPreferences>({
    units: {
      temperature: 'celsius',
      wind: 'kmh',
      precipitation: 'mm'
    },
    operationLimits: {
      maxWindSpeed: 25, // km/h
      maxPrecipitation: 2, // mm/hr
      minTemperature: -5, // celsius
      maxTemperature: 40, // celsius
      minVisibility: 1, // km
      maxHumidity: 90 // percentage
    },
    alertThresholds: {
      temperature: { min: 0, max: 35 },
      wind: 20,
      precipitation: 1
    },
    autoRefresh: true,
    refreshInterval: 30 // minutes
  })
  
  // Computed properties
  const targetYardId = computed(() => yardId || currentYard.value?.id)
  
  const currentConditions = computed(() => {
    if (!weather.value?.current) return null
    return weather.value.current
  })
  
  const forecast = computed(() => {
    if (!weather.value?.forecast) return []
    return weather.value.forecast
  })
  
  const alerts = computed((): WeatherAlert[] => {
    if (!weather.value?.alerts) return []
    
    return weather.value.alerts.map(alert => ({
      ...alert,
      recommendation: getAlertRecommendation(alert.type, alert.severity)
    }))
  })
  
  const operationSafety = computed((): OperationSafety => {
    if (!currentConditions.value) {
      return {
        safe: false,
        score: 0,
        factors: {
          temperature: { safe: false, value: 0, reason: 'No weather data' },
          precipitation: { safe: false, value: 0, reason: 'No weather data' },
          wind: { safe: false, value: 0, reason: 'No weather data' },
          humidity: { safe: false, value: 0, reason: 'No weather data' },
          visibility: { safe: false, value: 0, reason: 'No weather data' }
        },
        warnings: ['Weather data unavailable'],
        blockers: ['Cannot assess weather conditions']
      }
    }
    
    const conditions = currentConditions.value
    const limits = preferences.value.operationLimits
    const warnings: string[] = []
    const blockers: string[] = []
    let score = 100
    
    // Temperature check
    const temperatureSafe = conditions.temperature >= limits.minTemperature && 
                           conditions.temperature <= limits.maxTemperature
    let temperatureReason: string | undefined
    
    if (conditions.temperature < limits.minTemperature) {
      temperatureReason = `Too cold: ${conditions.temperature}°C (min: ${limits.minTemperature}°C)`
      blockers.push(temperatureReason)
      score -= 40
    } else if (conditions.temperature > limits.maxTemperature) {
      temperatureReason = `Too hot: ${conditions.temperature}°C (max: ${limits.maxTemperature}°C)`
      blockers.push(temperatureReason)
      score -= 30
    } else if (conditions.temperature < preferences.value.alertThresholds.temperature.min) {
      temperatureReason = 'Low temperature warning'
      warnings.push(`Cold conditions: ${conditions.temperature}°C`)
      score -= 15
    } else if (conditions.temperature > preferences.value.alertThresholds.temperature.max) {
      temperatureReason = 'High temperature warning'
      warnings.push(`Hot conditions: ${conditions.temperature}°C`)
      score -= 10
    }
    
    // Precipitation check
    const precipitationSafe = conditions.precipitation <= limits.maxPrecipitation
    let precipitationReason: string | undefined
    
    if (conditions.precipitation > limits.maxPrecipitation) {
      precipitationReason = `Heavy precipitation: ${conditions.precipitation}mm/hr (max: ${limits.maxPrecipitation}mm/hr)`
      blockers.push(precipitationReason)
      score -= 50
    } else if (conditions.precipitation > preferences.value.alertThresholds.precipitation) {
      precipitationReason = 'Light precipitation detected'
      warnings.push(`Light rain: ${conditions.precipitation}mm/hr`)
      score -= 20
    }
    
    // Wind check
    const windSafe = conditions.windSpeed <= limits.maxWindSpeed
    let windReason: string | undefined
    
    if (conditions.windSpeed > limits.maxWindSpeed) {
      windReason = `High wind: ${conditions.windSpeed}km/h (max: ${limits.maxWindSpeed}km/h)`
      blockers.push(windReason)
      score -= 35
    } else if (conditions.windSpeed > preferences.value.alertThresholds.wind) {
      windReason = 'Moderate wind warning'
      warnings.push(`Windy conditions: ${conditions.windSpeed}km/h`)
      score -= 15
    }
    
    // Visibility check
    const visibilitySafe = conditions.visibility >= limits.minVisibility
    let visibilityReason: string | undefined
    
    if (conditions.visibility < limits.minVisibility) {
      visibilityReason = `Poor visibility: ${conditions.visibility}km (min: ${limits.minVisibility}km)`
      blockers.push(visibilityReason)
      score -= 30
    }
    
    // Humidity check
    const humiditySafe = conditions.humidity <= limits.maxHumidity
    let humidityReason: string | undefined
    
    if (conditions.humidity > limits.maxHumidity) {
      humidityReason = `High humidity: ${conditions.humidity}% (max: ${limits.maxHumidity}%)`
      warnings.push(humidityReason)
      score -= 10
    }
    
    return {
      safe: blockers.length === 0,
      score: Math.max(0, score),
      factors: {
        temperature: { safe: temperatureSafe, value: conditions.temperature, reason: temperatureReason },
        precipitation: { safe: precipitationSafe, value: conditions.precipitation, reason: precipitationReason },
        wind: { safe: windSafe, value: conditions.windSpeed, reason: windReason },
        humidity: { safe: humiditySafe, value: conditions.humidity, reason: humidityReason },
        visibility: { safe: visibilitySafe, value: conditions.visibility, reason: visibilityReason }
      },
      warnings,
      blockers
    }
  })
  
  const weatherCondition = computed(() => {
    if (!currentConditions.value) return 'unknown'
    return currentConditions.value.conditions
  })
  
  const isDataStale = computed(() => {
    if (!lastUpdated.value) return true
    
    const staleThreshold = 60 * 60 * 1000 // 1 hour in milliseconds
    return Date.now() - new Date(lastUpdated.value).getTime() > staleThreshold
  })
  
  const nextForecastUpdate = computed(() => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    return nextHour.toISOString()
  })
  
  const todaysForecast = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return forecast.value.find(f => f.date === today) || null
  })
  
  const weeklyForecast = computed(() => {
    return forecast.value.slice(0, 7)
  })
  
  const suitableDays = computed(() => {
    return forecast.value.filter(day => day.suitable).length
  })
  
  // Weather fetching
  async function fetchWeather(forceRefresh = false): Promise<WeatherData | null> {
    const yId = targetYardId.value
    if (!yId) {
      error.value = new Error('No yard selected')
      return null
    }
    
    // Check if we need to refresh
    if (!forceRefresh && weather.value && !isDataStale.value) {
      return weather.value
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      const response = await apiClient.get(API_ENDPOINTS.YARD_WEATHER(yId))
      weather.value = response.data
      lastUpdated.value = new Date().toISOString()
      
      // Check for alerts and notify
      if (weather.value.alerts && weather.value.alerts.length > 0) {
        weather.value.alerts.forEach(alert => {
          if (alert.severity === 'severe' || alert.severity === 'extreme') {
            notificationsStore.addNotification({
              type: 'warning',
              title: `Weather Alert: ${alert.type.toUpperCase()}`,
              message: alert.message,
              timestamp: new Date().toISOString(),
              persistent: true
            })
          }
        })
      }
      
      // Check operation safety and warn if unsafe
      const safety = operationSafety.value
      if (!safety.safe && safety.blockers.length > 0) {
        notificationsStore.addNotification({
          type: 'warning',
          title: 'Unsafe Operating Conditions',
          message: `Operation not recommended: ${safety.blockers[0]}`,
          timestamp: new Date().toISOString()
        })
      }
      
      return weather.value
    } catch (err) {
      error.value = err as Error
      
      notificationsStore.addNotification({
        type: 'error',
        title: 'Weather Update Failed',
        message: (err as Error).message || 'Failed to fetch weather data',
        timestamp: new Date().toISOString()
      })
      
      return null
    } finally {
      isLoading.value = false
    }
  }
  
  // Auto-refresh management
  function startAutoRefresh() {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
    }
    
    if (preferences.value.autoRefresh) {
      const intervalMs = preferences.value.refreshInterval * 60 * 1000
      
      refreshInterval.value = window.setInterval(() => {
        fetchWeather(false)
      }, intervalMs)
    }
  }
  
  function stopAutoRefresh() {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }
  
  // Preferences management
  function updatePreferences(updates: Partial<WeatherPreferences>) {
    preferences.value = { ...preferences.value, ...updates }
    
    // Restart auto-refresh if interval changed
    if (updates.refreshInterval || updates.autoRefresh !== undefined) {
      startAutoRefresh()
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('yardrover_weather_preferences', JSON.stringify(preferences.value))
    } catch (err) {
      console.warn('Failed to save weather preferences:', err)
    }
  }
  
  function resetPreferences() {
    preferences.value = {
      units: {
        temperature: 'celsius',
        wind: 'kmh',
        precipitation: 'mm'
      },
      operationLimits: {
        maxWindSpeed: 25,
        maxPrecipitation: 2,
        minTemperature: -5,
        maxTemperature: 40,
        minVisibility: 1,
        maxHumidity: 90
      },
      alertThresholds: {
        temperature: { min: 0, max: 35 },
        wind: 20,
        precipitation: 1
      },
      autoRefresh: true,
      refreshInterval: 30
    }
    
    startAutoRefresh()
  }
  
  // Unit conversion utilities
  function convertTemperature(celsius: number, unit: 'celsius' | 'fahrenheit' = preferences.value.units.temperature): number {
    if (unit === 'fahrenheit') {
      return (celsius * 9/5) + 32
    }
    return celsius
  }
  
  function convertWindSpeed(kmh: number, unit: 'kmh' | 'mph' | 'ms' = preferences.value.units.wind): number {
    switch (unit) {
      case 'mph':
        return kmh * 0.621371
      case 'ms':
        return kmh / 3.6
      default:
        return kmh
    }
  }
  
  function convertPrecipitation(mm: number, unit: 'mm' | 'inches' = preferences.value.units.precipitation): number {
    if (unit === 'inches') {
      return mm * 0.0393701
    }
    return mm
  }
  
  // Utility functions
  function getAlertRecommendation(type: WeatherAlert['type'], severity: WeatherAlert['severity']): string {
    const recommendations = {
      storm: {
        minor: 'Monitor conditions closely',
        moderate: 'Consider postponing operations',
        severe: 'Suspend all operations immediately',
        extreme: 'Secure equipment and take shelter'
      },
      rain: {
        minor: 'Light precipitation - proceed with caution',
        moderate: 'Moderate rain - consider delaying operations',
        severe: 'Heavy rain - suspend operations',
        extreme: 'Extreme precipitation - emergency protocols'
      },
      wind: {
        minor: 'Light winds - normal operations',
        moderate: 'Moderate winds - exercise caution',
        severe: 'High winds - suspend operations',
        extreme: 'Extreme winds - emergency protocols'
      },
      temperature: {
        minor: 'Monitor temperature conditions',
        moderate: 'Adjust operation parameters',
        severe: 'Limit operation duration',
        extreme: 'Suspend operations immediately'
      },
      humidity: {
        minor: 'Monitor moisture levels',
        moderate: 'High humidity - proceed with caution',
        severe: 'Very high humidity - consider delays',
        extreme: 'Extreme humidity - suspend operations'
      }
    }
    
    return recommendations[type]?.[severity] || 'Monitor conditions'
  }
  
  function getConditionIcon(condition: string): string {
    const icons = {
      sunny: '☀️',
      cloudy: '☁️',
      rainy: '🌧️',
      snowy: '🌨️',
      stormy: '⛈️',
      foggy: '🌫️'
    }
    
    return icons[condition as keyof typeof icons] || '🌤️'
  }
  
  function getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    const index = Math.round(degrees / 22.5) % 16
    return directions[index]
  }
  
  // Initialize preferences from localStorage
  function loadPreferences() {
    try {
      const saved = localStorage.getItem('yardrover_weather_preferences')
      if (saved) {
        const parsed = JSON.parse(saved)
        preferences.value = { ...preferences.value, ...parsed }
      }
    } catch (err) {
      console.warn('Failed to load weather preferences:', err)
    }
  }
  
  // Watch for yard changes
  watch(targetYardId, (newYardId) => {
    if (newYardId) {
      fetchWeather(true)
    }
  })
  
  // Lifecycle
  onMounted(() => {
    loadPreferences()
    
    if (targetYardId.value) {
      fetchWeather()
    }
    
    startAutoRefresh()
  })
  
  onUnmounted(() => {
    stopAutoRefresh()
  })
  
  return {
    // State
    weather: computed(() => weather.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    lastUpdated: computed(() => lastUpdated.value),
    preferences: computed(() => preferences.value),
    
    // Computed weather data
    currentConditions,
    forecast,
    alerts,
    operationSafety,
    weatherCondition,
    isDataStale,
    nextForecastUpdate,
    todaysForecast,
    weeklyForecast,
    suitableDays,
    
    // Methods
    fetchWeather,
    startAutoRefresh,
    stopAutoRefresh,
    updatePreferences,
    resetPreferences,
    
    // Utility methods
    convertTemperature,
    convertWindSpeed,
    convertPrecipitation,
    getAlertRecommendation,
    getConditionIcon,
    getWindDirection,
    
    // Convenience getters
    isSafeToOperate: computed(() => operationSafety.value.safe),
    operationWarnings: computed(() => operationSafety.value.warnings),
    operationBlockers: computed(() => operationSafety.value.blockers),
    safetyScore: computed(() => operationSafety.value.score),
    
    // Refresh method alias
    refresh: () => fetchWeather(true)
  }
}