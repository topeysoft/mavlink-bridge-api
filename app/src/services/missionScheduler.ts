import type { Mission } from '@/types'
import type { WeatherTaskCheck } from '@/types/weather'

export interface MissionExecutionCheck {
  canExecute: boolean
  reasons: string[]
  mission: Mission
  weatherCheck?: WeatherTaskCheck
  batteryCheck?: {
    safe: boolean
    level: number
    minRequired: number
  }
}

export interface PostponementDecision {
  shouldPostpone: boolean
  reason: string
  retryAt?: Date
  severity: 'info' | 'warning' | 'critical'
}

export class MissionScheduler {
  /**
   * Check if a mission can execute based on weather, battery, and other conditions
   */
  static checkMissionExecution(
    mission: Mission,
    weatherCheck?: WeatherTaskCheck,
    batteryLevel?: number
  ): MissionExecutionCheck {
    const reasons: string[] = []

    // Check weather safety if enabled
    if (mission.weatherSafetyEnabled && weatherCheck && !weatherCheck.safe) {
      reasons.push(...weatherCheck.reasons.map(r => `Weather: ${r}`))
    }

    // Check battery level (require at least 20% for safety)
    const minBatteryRequired = 20
    if (batteryLevel !== undefined && batteryLevel < minBatteryRequired) {
      reasons.push(`Battery too low: ${batteryLevel}% (minimum: ${minBatteryRequired}%)`)
    }

    const batteryCheck = batteryLevel !== undefined ? {
      safe: batteryLevel >= minBatteryRequired,
      level: batteryLevel,
      minRequired: minBatteryRequired
    } : undefined

    return {
      canExecute: reasons.length === 0,
      reasons,
      mission,
      weatherCheck,
      batteryCheck
    }
  }

  /**
   * Determine if and when a mission should be postponed
   */
  static determinePostponement(
    executionCheck: MissionExecutionCheck
  ): PostponementDecision {
    if (executionCheck.canExecute) {
      return {
        shouldPostpone: false,
        reason: 'All conditions met',
        severity: 'info'
      }
    }

    const { reasons, weatherCheck, batteryCheck } = executionCheck

    // Determine severity and retry time based on blocking reason
    let retryAt: Date | undefined
    let severity: 'info' | 'warning' | 'critical' = 'warning'

    // Weather-based postponement
    if (weatherCheck && !weatherCheck.safe) {
      // Retry in 30 minutes for weather checks
      retryAt = new Date(Date.now() + 30 * 60 * 1000)
      severity = 'warning'
    }

    // Battery-based postponement
    if (batteryCheck && !batteryCheck.safe) {
      // Critical if battery is very low (< 10%)
      if (batteryCheck.level < 10) {
        severity = 'critical'
        retryAt = new Date(Date.now() + 60 * 60 * 1000) // Retry in 1 hour
      } else {
        severity = 'warning'
        retryAt = new Date(Date.now() + 30 * 60 * 1000) // Retry in 30 minutes
      }
    }

    return {
      shouldPostpone: true,
      reason: reasons.join('; '),
      retryAt,
      severity
    }
  }

  /**
   * Calculate next retry time for a postponed mission
   */
  static calculateRetryTime(postponementReason: string): Date {
    const now = Date.now()

    // Weather-related postponements: retry in 30 minutes
    if (postponementReason.toLowerCase().includes('weather')) {
      return new Date(now + 30 * 60 * 1000)
    }

    // Battery-related postponements: retry in 1 hour
    if (postponementReason.toLowerCase().includes('battery')) {
      return new Date(now + 60 * 60 * 1000)
    }

    // Default: retry in 15 minutes
    return new Date(now + 15 * 60 * 1000)
  }

  /**
   * Format postponement reason for user display
   */
  static formatPostponementReason(reasons: string[]): string {
    if (reasons.length === 0) return 'Unknown reason'
    if (reasons.length === 1) return reasons[0]

    const weatherReasons = reasons.filter(r => r.startsWith('Weather:'))
    const otherReasons = reasons.filter(r => !r.startsWith('Weather:'))

    if (weatherReasons.length > 0 && otherReasons.length === 0) {
      return `Unsafe weather conditions (${weatherReasons.length} issues)`
    }

    if (weatherReasons.length > 0 && otherReasons.length > 0) {
      return `Multiple issues: ${weatherReasons.length} weather, ${otherReasons.length} other`
    }

    return reasons.join('; ')
  }

  /**
   * Check if it's time to retry a postponed mission
   */
  static shouldRetryPostponedMission(mission: Mission): boolean {
    if (!mission.postponedUntil) return true

    const retryTime = new Date(mission.postponedUntil)
    return Date.now() >= retryTime.getTime()
  }

  /**
   * Get user-friendly status text for a mission
   */
  static getMissionStatusText(mission: Mission): string {
    switch (mission.status) {
      case 'pending':
        return 'Scheduled'
      case 'active':
        return 'Running'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'postponed':
        if (mission.postponedUntil) {
          const retryTime = new Date(mission.postponedUntil)
          const now = new Date()

          if (retryTime <= now) {
            return 'Ready to retry'
          }

          const diffMinutes = Math.round((retryTime.getTime() - now.getTime()) / 60000)
          if (diffMinutes < 60) {
            return `Postponed (retry in ${diffMinutes}m)`
          }

          const diffHours = Math.round(diffMinutes / 60)
          return `Postponed (retry in ${diffHours}h)`
        }
        return 'Postponed'
      default:
        return 'Unknown'
    }
  }

  /**
   * Get status color for mission display
   */
  static getMissionStatusColor(mission: Mission): string {
    switch (mission.status) {
      case 'pending':
        return '#3b82f6' // blue
      case 'active':
        return '#10b981' // green
      case 'completed':
        return '#6b7280' // gray
      case 'failed':
        return '#ef4444' // red
      case 'postponed':
        return '#f59e0b' // amber/warning
      default:
        return '#9ca3af' // gray
    }
  }
}
