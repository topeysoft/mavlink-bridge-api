export interface WeatherCondition {
  id: number
  main: string // Rain, Snow, Clear, Clouds, etc.
  description: string
  icon: string
}

export interface WeatherData {
  temp: number // Current temperature in Celsius
  feels_like: number
  temp_min: number
  temp_max: number
  pressure: number // hPa
  humidity: number // %
  visibility: number // meters
  wind_speed: number // m/s
  wind_deg: number // degrees
  wind_gust?: number // m/s
  clouds: number // % cloudiness
  rain_1h?: number // Rain volume for last 1 hour, mm
  rain_3h?: number // Rain volume for last 3 hours, mm
  snow_1h?: number // Snow volume for last 1 hour, mm
  snow_3h?: number // Snow volume for last 3 hours, mm
  conditions: WeatherCondition[]
  timestamp: number
  sunrise: number
  sunset: number
}

export interface WeatherForecast {
  dt: number // Time of data forecasted
  temp: number
  feels_like: number
  temp_min: number
  temp_max: number
  pressure: number
  humidity: number
  wind_speed: number
  wind_deg: number
  clouds: number
  pop: number // Probability of precipitation (0-1)
  rain?: number // Rain volume, mm
  snow?: number // Snow volume, mm
  conditions: WeatherCondition[]
}

export interface WeatherAlert {
  sender_name: string
  event: string
  start: number
  end: number
  description: string
  tags: string[]
}

export interface WeatherLocation {
  lat: number
  lon: number
  name?: string
  country?: string
}

export interface WeatherSettings {
  enabled: boolean
  apiKey: string
  location: WeatherLocation
  updateInterval: number // minutes
  conditions: WeatherSafetyConditions
}

export interface WeatherSafetyConditions {
  maxWindSpeed: number // m/s - postpone if wind exceeds this
  maxRainRate: number // mm/h - postpone if rain exceeds this
  maxSnowRate: number // mm/h - postpone if snow exceeds this
  minVisibility: number // meters - postpone if visibility below this
  minTemp: number // Celsius - postpone if temp below this
  maxTemp: number // Celsius - postpone if temp above this
  avoidConditions: string[] // Weather conditions to avoid (e.g., ['Thunderstorm', 'Tornado'])
}

export interface WeatherTaskCheck {
  safe: boolean
  reasons: string[]
  weather: WeatherData
  timestamp: number
}

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  enabled: false,
  apiKey: '',
  location: {
    lat: 0,
    lon: 0,
    name: 'Unknown',
    country: ''
  },
  updateInterval: 30,
  conditions: {
    maxWindSpeed: 10, // 10 m/s (~22 mph)
    maxRainRate: 2, // 2mm/h light rain
    maxSnowRate: 1, // 1mm/h
    minVisibility: 1000, // 1km
    minTemp: 0, // 0°C (32°F)
    maxTemp: 40, // 40°C (104°F)
    avoidConditions: ['Thunderstorm', 'Tornado', 'Hurricane', 'Squall']
  }
}

export const WEATHER_CONDITION_ICONS: Record<string, string> = {
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
