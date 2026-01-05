import type { Activity } from '@/types'
import type { Mission } from '@/types'
import type { WeatherTaskCheck } from '@/types/weather'

export class ActivityLogger {
  /**
   * Create an activity log entry for a mission postponed due to weather
   */
  static logMissionPostponedWeather(
    mission: Mission,
    weatherCheck: WeatherTaskCheck
  ): Activity {
    const reasons = weatherCheck.reasons.slice(0, 2).join('; ')
    const moreCount = weatherCheck.reasons.length - 2

    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'warning',
      title: `Mission Postponed: ${mission.name}`,
      description: moreCount > 0
        ? `${reasons}... and ${moreCount} more issue${moreCount > 1 ? 's' : ''}`
        : reasons,
      icon: 'cloud'
    }
  }

  /**
   * Create an activity log entry for a mission postponed due to battery
   */
  static logMissionPostponedBattery(
    mission: Mission,
    batteryLevel: number,
    minRequired: number
  ): Activity {
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'warning',
      title: `Mission Postponed: ${mission.name}`,
      description: `Battery too low: ${batteryLevel}% (minimum required: ${minRequired}%)`,
      icon: 'battery'
    }
  }

  /**
   * Create an activity log entry for a mission starting after postponement
   */
  static logMissionResumedAfterPostponement(
    mission: Mission,
    previousReason: string
  ): Activity {
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'success',
      title: `Mission Resumed: ${mission.name}`,
      description: `Conditions improved. Previously postponed due to: ${previousReason}`,
      icon: 'check'
    }
  }

  /**
   * Create an activity log entry for weather becoming unsafe
   */
  static logWeatherUnsafe(weatherCheck: WeatherTaskCheck): Activity {
    const primaryReason = weatherCheck.reasons[0] || 'Unknown weather conditions'

    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'warning',
      title: 'Weather Conditions Unsafe',
      description: `Operations postponed: ${primaryReason}`,
      icon: 'cloud'
    }
  }

  /**
   * Create an activity log entry for weather becoming safe
   */
  static logWeatherSafe(): Activity {
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'info',
      title: 'Weather Conditions Safe',
      description: 'All weather parameters within safe operating range',
      icon: 'check'
    }
  }

  /**
   * Create an activity log entry for mission execution check
   */
  static logMissionExecutionCheck(
    mission: Mission,
    canExecute: boolean,
    reasons: string[]
  ): Activity {
    if (canExecute) {
      return {
        id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'success',
        title: `Mission Ready: ${mission.name}`,
        description: 'All safety checks passed, mission can proceed',
        icon: 'check'
      }
    }

    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'warning',
      title: `Mission Blocked: ${mission.name}`,
      description: reasons.join('; '),
      icon: 'warning'
    }
  }

  /**
   * Create an activity log entry for automatic retry attempt
   */
  static logMissionRetryAttempt(mission: Mission, attemptNumber: number): Activity {
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'info',
      title: `Retry Attempt ${attemptNumber}: ${mission.name}`,
      description: 'Checking if conditions have improved for mission execution',
      icon: 'refresh'
    }
  }

  /**
   * Format activity description for weather-related events
   */
  static formatWeatherDescription(reasons: string[]): string {
    if (reasons.length === 0) return 'Unknown conditions'
    if (reasons.length === 1) return reasons[0]

    const weatherReasons = reasons.filter(r => r.toLowerCase().includes('weather'))
    const otherReasons = reasons.filter(r => !r.toLowerCase().includes('weather'))

    if (weatherReasons.length > 0) {
      const summary = `${weatherReasons.length} weather issue${weatherReasons.length > 1 ? 's' : ''}`
      if (otherReasons.length > 0) {
        return `${summary}, ${otherReasons.length} other issue${otherReasons.length > 1 ? 's' : ''}`
      }
      return summary
    }

    return reasons.slice(0, 2).join('; ')
  }

  /**
   * Determine icon for weather-related activity
   */
  static getWeatherActivityIcon(safe: boolean, hasRain: boolean, hasWind: boolean): string {
    if (!safe) {
      if (hasRain) return 'rainy'
      if (hasWind) return 'wind'
      return 'cloud'
    }
    return 'check'
  }
}
