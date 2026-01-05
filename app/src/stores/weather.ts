import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  WeatherData,
  WeatherForecast,
  WeatherAlert,
  WeatherSettings,
  WeatherTaskCheck,
  WeatherCondition,
  DEFAULT_WEATHER_SETTINGS
} from '@/types/weather'
import { DEFAULT_WEATHER_SETTINGS as defaultSettings } from '@/types/weather'

const WEATHER_STORAGE_KEY = 'yardrover_weather_settings'
const WEATHER_CACHE_KEY = 'yardrover_weather_cache'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

interface WeatherCache {
  data: WeatherData | null
  forecast: WeatherForecast[]
  alerts: WeatherAlert[]
  timestamp: number
}

export const useWeatherStore = defineStore('weather', () => {
  // State
  const settings = ref<WeatherSettings>(loadSettings())
  const currentWeather = ref<WeatherData | null>(null)
  const forecast = ref<WeatherForecast[]>([])
  const alerts = ref<WeatherAlert[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdate = ref<number>(0)
  const updateTimer = ref<number | null>(null)

  // Computed
  const isConfigured = computed(() => {
    return settings.value.enabled &&
           settings.value.apiKey.length > 0 &&
           settings.value.location.lat !== 0 &&
           settings.value.location.lon !== 0
  })

  const isSafeForOperations = computed(() => {
    if (!currentWeather.value) return true // Default to safe if no data
    const check = checkWeatherSafety(currentWeather.value)
    return check.safe
  })

  const currentConditionIcon = computed(() => {
    if (!currentWeather.value || currentWeather.value.conditions.length === 0) {
      return '❓'
    }
    const main = currentWeather.value.conditions[0].main
    const icons: Record<string, string> = {
      Clear: '☀️',
      Clouds: '☁️',
      Rain: '🌧️',
      Drizzle: '🌦️',
      Thunderstorm: '⛈️',
      Snow: '🌨️',
      Mist: '🌫️',
      Smoke: '💨',
      Haze: '🌫️',
      Dust: '💨',
      Fog: '🌫️',
      Sand: '💨',
      Ash: '💨',
      Squall: '💨',
      Tornado: '🌪️'
    }
    return icons[main] || '❓'
  })

  const hasActiveAlerts = computed(() => {
    const now = Date.now() / 1000
    return alerts.value.some(alert => alert.start <= now && alert.end >= now)
  })

  // Functions
  function loadSettings(): WeatherSettings {
    try {
      const stored = localStorage.getItem(WEATHER_STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load weather settings:', e)
    }
    return defaultSettings
  }

  function saveSettings() {
    try {
      localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save weather settings:', e)
    }
  }

  function loadCache(): WeatherCache | null {
    try {
      const stored = localStorage.getItem(WEATHER_CACHE_KEY)
      if (stored) {
        const cache: WeatherCache = JSON.parse(stored)
        if (Date.now() - cache.timestamp < CACHE_DURATION) {
          return cache
        }
      }
    } catch (e) {
      console.error('Failed to load weather cache:', e)
    }
    return null
  }

  function saveCache() {
    try {
      const cache: WeatherCache = {
        data: currentWeather.value,
        forecast: forecast.value,
        alerts: alerts.value,
        timestamp: Date.now()
      }
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache))
    } catch (e) {
      console.error('Failed to save weather cache:', e)
    }
  }

  async function fetchWeather() {
    if (!isConfigured.value) {
      error.value = 'Weather service not configured'
      return
    }

    // Check cache first
    const cache = loadCache()
    if (cache && cache.data) {
      currentWeather.value = cache.data
      forecast.value = cache.forecast
      alerts.value = cache.alerts
      lastUpdate.value = cache.timestamp
      return
    }

    loading.value = true
    error.value = null

    try {
      const { lat, lon } = settings.value.location
      const apiKey = settings.value.apiKey

      // Fetch current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      const currentResponse = await fetch(currentUrl)

      if (!currentResponse.ok) {
        throw new Error(`Weather API error: ${currentResponse.statusText}`)
      }

      const currentData = await currentResponse.json()
      currentWeather.value = parseCurrentWeather(currentData)

      // Fetch forecast
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      const forecastResponse = await fetch(forecastUrl)

      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json()
        forecast.value = parseForecast(forecastData)
      }

      // Fetch alerts (if available in API plan)
      try {
        const alertsUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&exclude=current,minutely,hourly,daily`
        const alertsResponse = await fetch(alertsUrl)

        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json()
          alerts.value = alertsData.alerts || []
        }
      } catch (e) {
        // Alerts might not be available in all API plans
        alerts.value = []
      }

      lastUpdate.value = Date.now()
      saveCache()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch weather'
      console.error('Weather fetch error:', e)
    } finally {
      loading.value = false
    }
  }

  function parseCurrentWeather(data: any): WeatherData {
    return {
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      temp_min: data.main.temp_min,
      temp_max: data.main.temp_max,
      pressure: data.main.pressure,
      humidity: data.main.humidity,
      visibility: data.visibility,
      wind_speed: data.wind.speed,
      wind_deg: data.wind.deg,
      wind_gust: data.wind.gust,
      clouds: data.clouds.all,
      rain_1h: data.rain?.['1h'],
      rain_3h: data.rain?.['3h'],
      snow_1h: data.snow?.['1h'],
      snow_3h: data.snow?.['3h'],
      conditions: data.weather.map((w: any) => ({
        id: w.id,
        main: w.main,
        description: w.description,
        icon: w.icon
      })),
      timestamp: data.dt,
      sunrise: data.sys.sunrise,
      sunset: data.sys.sunset
    }
  }

  function parseForecast(data: any): WeatherForecast[] {
    return data.list.slice(0, 8).map((item: any) => ({
      dt: item.dt,
      temp: item.main.temp,
      feels_like: item.main.feels_like,
      temp_min: item.main.temp_min,
      temp_max: item.main.temp_max,
      pressure: item.main.pressure,
      humidity: item.main.humidity,
      wind_speed: item.wind.speed,
      wind_deg: item.wind.deg,
      clouds: item.clouds.all,
      pop: item.pop,
      rain: item.rain?.['3h'],
      snow: item.snow?.['3h'],
      conditions: item.weather.map((w: any) => ({
        id: w.id,
        main: w.main,
        description: w.description,
        icon: w.icon
      }))
    }))
  }

  function checkWeatherSafety(weather: WeatherData): WeatherTaskCheck {
    const reasons: string[] = []
    const conds = settings.value.conditions

    // Check wind speed
    if (weather.wind_speed > conds.maxWindSpeed) {
      reasons.push(`Wind speed too high: ${weather.wind_speed.toFixed(1)} m/s (max: ${conds.maxWindSpeed} m/s)`)
    }

    // Check rain
    const rainRate = weather.rain_1h || 0
    if (rainRate > conds.maxRainRate) {
      reasons.push(`Rain rate too high: ${rainRate.toFixed(1)} mm/h (max: ${conds.maxRainRate} mm/h)`)
    }

    // Check snow
    const snowRate = weather.snow_1h || 0
    if (snowRate > conds.maxSnowRate) {
      reasons.push(`Snow rate too high: ${snowRate.toFixed(1)} mm/h (max: ${conds.maxSnowRate} mm/h)`)
    }

    // Check visibility
    if (weather.visibility < conds.minVisibility) {
      reasons.push(`Visibility too low: ${weather.visibility} m (min: ${conds.minVisibility} m)`)
    }

    // Check temperature
    if (weather.temp < conds.minTemp) {
      reasons.push(`Temperature too low: ${weather.temp.toFixed(1)}°C (min: ${conds.minTemp}°C)`)
    }
    if (weather.temp > conds.maxTemp) {
      reasons.push(`Temperature too high: ${weather.temp.toFixed(1)}°C (max: ${conds.maxTemp}°C)`)
    }

    // Check weather conditions
    for (const condition of weather.conditions) {
      if (conds.avoidConditions.includes(condition.main)) {
        reasons.push(`Unsafe weather condition: ${condition.main} (${condition.description})`)
      }
    }

    return {
      safe: reasons.length === 0,
      reasons,
      weather,
      timestamp: Date.now()
    }
  }

  function updateSettings(newSettings: Partial<WeatherSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()

    // Restart auto-update if interval changed
    if (newSettings.updateInterval !== undefined || newSettings.enabled !== undefined) {
      stopAutoUpdate()
      if (settings.value.enabled) {
        startAutoUpdate()
      }
    }
  }

  function startAutoUpdate() {
    if (!isConfigured.value) return

    stopAutoUpdate()

    // Initial fetch
    fetchWeather()

    // Set up periodic updates
    const intervalMs = settings.value.updateInterval * 60 * 1000
    updateTimer.value = window.setInterval(() => {
      fetchWeather()
    }, intervalMs)
  }

  function stopAutoUpdate() {
    if (updateTimer.value !== null) {
      clearInterval(updateTimer.value)
      updateTimer.value = null
    }
  }

  async function setLocation(lat: number, lon: number, name?: string) {
    settings.value.location = { lat, lon, name, country: settings.value.location.country }
    saveSettings()
    await fetchWeather()
  }

  function getHourlyForecast(hours: number = 24) {
    const hoursToShow = Math.min(hours / 3, forecast.value.length) // Forecast is every 3 hours
    return forecast.value.slice(0, hoursToShow)
  }

  // Initialize
  if (isConfigured.value && settings.value.enabled) {
    startAutoUpdate()
  }

  return {
    // State
    settings,
    currentWeather,
    forecast,
    alerts,
    loading,
    error,
    lastUpdate,

    // Computed
    isConfigured,
    isSafeForOperations,
    currentConditionIcon,
    hasActiveAlerts,

    // Actions
    fetchWeather,
    checkWeatherSafety,
    updateSettings,
    startAutoUpdate,
    stopAutoUpdate,
    setLocation,
    getHourlyForecast
  }
})
