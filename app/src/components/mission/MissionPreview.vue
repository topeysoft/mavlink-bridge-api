<script setup lang="ts">
import { computed } from 'vue'
import { useMissionsStore } from '@/stores/missions'
import type { MissionPlan } from '@/types/waypoint'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

interface Props {
  plan: MissionPlan
}

interface Emits {
  (e: 'upload'): void
  (e: 'export'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const missionsStore = useMissionsStore()

const validation = computed(() => missionsStore.validateMission(props.plan))
const statistics = computed(() => missionsStore.calculateMissionStatistics(props.plan))

const isValid = computed(() => validation.value.valid)
const hasWarnings = computed(() => validation.value.warnings.length > 0)

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (minutes === 0) {
    return `${secs}s`
  }
  return `${minutes}m ${secs}s`
}
</script>

<template>
  <div class="mission-preview">
    <!-- Validation Results -->
    <Card>
      <template #header>
        <div class="preview-header">
          <div>
            <div class="card-title">Mission Validation</div>
            <div class="card-subtitle">Pre-flight checks and warnings</div>
          </div>
          <div class="validation-status" :class="{ valid: isValid, invalid: !isValid }">
            <svg v-if="isValid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {{ isValid ? 'Ready' : 'Invalid' }}
          </div>
        </div>
      </template>

      <div class="validation-content">
        <!-- Errors -->
        <div v-if="validation.errors.length > 0" class="validation-section errors">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Errors ({{ validation.errors.length }})
          </div>
          <ul class="validation-list">
            <li v-for="(error, index) in validation.errors" :key="`error-${index}`">
              {{ error }}
            </li>
          </ul>
        </div>

        <!-- Warnings -->
        <div v-if="validation.warnings.length > 0" class="validation-section warnings">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Warnings ({{ validation.warnings.length }})
          </div>
          <ul class="validation-list">
            <li v-for="(warning, index) in validation.warnings" :key="`warning-${index}`">
              {{ warning }}
            </li>
          </ul>
        </div>

        <!-- Success state -->
        <div v-if="isValid && !hasWarnings" class="validation-section success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <p>Mission validation passed with no errors or warnings.</p>
        </div>
      </div>
    </Card>

    <!-- Mission Statistics -->
    <Card>
      <template #header>
        <div class="card-header">
          <div class="card-title">Mission Statistics</div>
          <div class="card-subtitle">Estimated values</div>
        </div>
      </template>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Total Waypoints</div>
            <div class="stat-value">{{ statistics.totalWaypoints }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Total Distance</div>
            <div class="stat-value">{{ formatDistance(statistics.totalDistance) }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Estimated Time</div>
            <div class="stat-value">{{ formatDuration(statistics.estimatedTime) }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Navigation Commands</div>
            <div class="stat-value">{{ statistics.navigationCommands }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Action Commands</div>
            <div class="stat-value">{{ statistics.doCommands }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">Altitude Range</div>
            <div class="stat-value">
              {{ statistics.minAltitude.toFixed(1) }}m - {{ statistics.maxAltitude.toFixed(1) }}m
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Action Buttons -->
    <div class="preview-actions">
      <Button variant="outline" @click="$emit('export')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export Mission
      </Button>

      <Button variant="success" @click="$emit('upload')" :disabled="!isValid">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Upload to Vehicle
      </Button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mission-preview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.preview-header,
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.validation-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;

  svg {
    width: 18px;
    height: 18px;
  }

  &.valid {
    background: rgba(16, 185, 129, 0.1);
    color: var(--status-success);
  }

  &.invalid {
    background: rgba(239, 68, 68, 0.1);
    color: var(--status-error);
  }
}

.validation-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.validation-section {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border-left: 4px solid;

  &.errors {
    background: rgba(239, 68, 68, 0.05);
    border-color: var(--status-error);

    .section-title {
      color: var(--status-error);
    }
  }

  &.warnings {
    background: rgba(245, 158, 11, 0.05);
    border-color: var(--status-warning);

    .section-title {
      color: var(--status-warning);
    }
  }

  &.success {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    background: rgba(16, 185, 129, 0.05);
    border-color: var(--status-success);
    color: var(--status-success);

    svg {
      width: 24px;
      height: 24px;
    }

    p {
      margin: 0;
      font-weight: 500;
    }
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-sm);

  svg {
    width: 16px;
    height: 16px;
  }
}

.validation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);

  li {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-green);
  color: white;
  border-radius: var(--radius-md);
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
  }
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.preview-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
</style>
