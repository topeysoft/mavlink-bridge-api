<script setup lang="ts">
/**
 * PathStatistics - Display mission path statistics
 *
 * Shows estimated distance, time, waypoint count, and coverage.
 * Adapts display format for consumer vs power user mode.
 */

import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import type { GeneratedPath } from '@/composables/useMissionPathGeneration'

interface Props {
  statistics: GeneratedPath | null
  showDetails?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: true,
  compact: false
})

const featuresStore = useFeaturesStore()
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// ============================================================================
// Computed
// ============================================================================

const hasData = computed(() => props.statistics !== null)

const formattedDistance = computed(() => {
  if (!props.statistics) return '--'

  const meters = props.statistics.totalDistance

  if (isConsumerMode.value) {
    // Convert to miles for consumer
    const miles = meters / 1609.34
    if (miles < 0.1) {
      const feet = meters * 3.28084
      return `${Math.round(feet)} ft`
    }
    return `${miles.toFixed(1)} mi`
  }

  // Technical mode uses metric
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
})

const formattedTime = computed(() => {
  if (!props.statistics) return '--'

  const seconds = props.statistics.estimatedTime
  const minutes = Math.ceil(seconds / 60)

  if (isConsumerMode.value) {
    if (minutes < 60) {
      return `About ${minutes} minutes`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    if (remainingMins === 0) {
      return `About ${hours} hour${hours > 1 ? 's' : ''}`
    }
    return `About ${hours}h ${remainingMins}m`
  }

  // Technical mode - more precise
  if (minutes < 60) {
    return `~${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `~${hours}h ${remainingMins}m`
})

const formattedWaypoints = computed(() => {
  if (!props.statistics) return '--'
  return props.statistics.waypointCount.toLocaleString()
})

const formattedCoverage = computed(() => {
  if (!props.statistics) return '--'
  return `${Math.round(props.statistics.coverage)}%`
})

const consumerSummary = computed(() => {
  if (!props.statistics) return 'No path configured'

  const minutes = Math.ceil(props.statistics.estimatedTime / 60)

  if (minutes < 15) {
    return 'Quick job - under 15 minutes'
  } else if (minutes < 30) {
    return 'Should take about half an hour'
  } else if (minutes < 60) {
    return `Will take about ${minutes} minutes`
  } else {
    const hours = Math.floor(minutes / 60)
    return `Will take about ${hours} hour${hours > 1 ? 's' : ''}`
  }
})
</script>

<template>
  <div
    class="path-statistics"
    :class="{
      'consumer-mode': isConsumerMode,
      'compact': compact,
      'no-data': !hasData
    }"
  >
    <!-- Consumer Mode: Simple Summary -->
    <template v-if="isConsumerMode && !showDetails">
      <div class="consumer-summary">
        <span class="summary-icon">⏱️</span>
        <span class="summary-text">{{ consumerSummary }}</span>
      </div>
    </template>

    <!-- Detailed Statistics -->
    <template v-else>
      <div class="stats-grid">
        <!-- Estimated Time -->
        <div class="stat-item">
          <span class="stat-icon">⏱️</span>
          <div class="stat-content">
            <span class="stat-label">
              {{ isConsumerMode ? 'Time' : 'Est. Time' }}
            </span>
            <span class="stat-value">{{ formattedTime }}</span>
          </div>
        </div>

        <!-- Distance -->
        <div class="stat-item">
          <span class="stat-icon">📏</span>
          <div class="stat-content">
            <span class="stat-label">
              {{ isConsumerMode ? 'Distance' : 'Total Distance' }}
            </span>
            <span class="stat-value">{{ formattedDistance }}</span>
          </div>
        </div>

        <!-- Waypoints (Power User only) -->
        <div v-if="!isConsumerMode && showDetails" class="stat-item">
          <span class="stat-icon">📍</span>
          <div class="stat-content">
            <span class="stat-label">Waypoints</span>
            <span class="stat-value">{{ formattedWaypoints }}</span>
          </div>
        </div>

        <!-- Coverage -->
        <div v-if="showDetails" class="stat-item">
          <span class="stat-icon">✓</span>
          <div class="stat-content">
            <span class="stat-label">
              {{ isConsumerMode ? 'Coverage' : 'Est. Coverage' }}
            </span>
            <span class="stat-value">{{ formattedCoverage }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.path-statistics {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);

  &.compact {
    padding: var(--spacing-sm);
  }

  &.no-data {
    opacity: 0.6;
  }
}

.consumer-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
}

.summary-icon {
  font-size: 24px;
}

.summary-text {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 500;
}

.consumer-mode .summary-text {
  font-size: var(--font-size-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.compact .stats-grid {
  gap: var(--spacing-sm);
}

.consumer-mode .stats-grid {
  grid-template-columns: 1fr;
  gap: var(--spacing-lg);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.stat-icon {
  font-size: 16px;
  opacity: 0.7;
}

.consumer-mode .stat-icon {
  font-size: 20px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.consumer-mode .stat-label {
  font-size: var(--font-size-sm);
}

.stat-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.consumer-mode .stat-value {
  font-size: var(--font-size-lg);
}
</style>
