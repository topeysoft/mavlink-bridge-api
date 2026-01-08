<script setup lang="ts">
import { computed } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import SimpleCalibration from './SimpleCalibration.vue'
import CompassCalibration from './CompassCalibration.vue'
import AccelerometerCalibration from './AccelerometerCalibration.vue'

const calibrationStore = useCalibrationStore()

const calibrationTypes = [
  { id: 'level' as const, name: 'Level Horizon', priority: 1 },
  { id: 'gyro' as const, name: 'Gyroscope', priority: 2 },
  { id: 'compass' as const, name: 'Compass', priority: 2 },
  { id: 'accelerometer' as const, name: 'Accelerometer', priority: 3 },
  { id: 'radio' as const, name: 'Radio/RC', priority: 3 },
  { id: 'pressure' as const, name: 'Barometer', priority: 4 }
]

const overallHealth = computed(() => calibrationStore.overallHealth)
const recommendations = computed(() => calibrationStore.recommendations)
const needsCalibration = computed(() => calibrationStore.needsCalibration)

function getHealthColor(health: number): string {
  if (health >= 80) return 'var(--status-success)'
  if (health >= 60) return 'var(--primary-green)'
  if (health >= 40) return 'var(--status-warning)'
  return 'var(--status-danger)'
}

function getStatusColor(type: string): string {
  const state = calibrationStore.calibrationStates[type as keyof typeof calibrationStore.calibrationStates]
  if (state.status === 'success') return 'var(--status-success)'
  if (state.status === 'in_progress') return 'var(--primary-green)'
  if (state.status === 'failed') return 'var(--status-danger)'
  return 'var(--text-tertiary)'
}
</script>

<template>
  <div class="expert-calibration-panel">
    <!-- Health Dashboard -->
    <div class="health-dashboard">
      <h2>Calibration Health Dashboard</h2>

      <div class="health-overview">
        <div class="health-score">
          <div class="score-circle" :style="{ '--health-color': getHealthColor(overallHealth) }">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="var(--bg-secondary)" stroke-width="20"/>
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="var(--health-color)"
                stroke-width="20"
                stroke-linecap="round"
                :stroke-dasharray="`${(overallHealth / 100) * 565} 565`"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div class="score-value">
              <span class="value">{{ overallHealth }}</span>
              <span class="label">Health</span>
            </div>
          </div>
        </div>

        <div class="health-stats">
          <div class="stat-card">
            <div class="stat-icon calibrated">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ Object.values(calibrationStore.calibrationStates).filter(s => s.status === 'success').length }}
              </div>
              <div class="stat-label">Calibrated</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon pending">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ Object.values(calibrationStore.calibrationStates).filter(s => s.status === 'not_started').length }}
              </div>
              <div class="stat-label">Not Calibrated</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon warning">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ recommendations.filter(r => r.priority === 'high').length }}</div>
              <div class="stat-label">Needs Attention</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div v-if="recommendations.length > 0" class="recommendations">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Recommendations
        </h3>
        <div class="recommendations-list">
          <div
            v-for="rec in recommendations"
            :key="rec.type"
            class="recommendation-item"
            :class="rec.priority"
          >
            <div class="rec-priority">
              <span v-if="rec.priority === 'high'">!</span>
              <span v-else-if="rec.priority === 'medium'">⚠</span>
              <span v-else>ℹ</span>
            </div>
            <div class="rec-content">
              <div class="rec-type">{{ rec.type.toUpperCase() }}</div>
              <div class="rec-reason">{{ rec.reason }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Individual Calibrations -->
    <div class="calibrations-grid">
      <h2>Individual Calibrations</h2>

      <div class="calibration-cards">
        <!-- Level -->
        <SimpleCalibration type="level" mode="expert" />

        <!-- Gyro -->
        <SimpleCalibration type="gyro" mode="expert" />

        <!-- Compass -->
        <CompassCalibration mode="expert" />

        <!-- Accelerometer -->
        <AccelerometerCalibration mode="expert" />

        <!-- Radio -->
        <SimpleCalibration type="radio" mode="expert" />

        <!-- Pressure -->
        <SimpleCalibration type="pressure" mode="expert" />
      </div>
    </div>

    <!-- Calibration History -->
    <div v-if="calibrationStore.calibrationHistory.length > 0" class="calibration-history">
      <div class="history-header">
        <h2>Calibration History</h2>
        <button class="btn btn-secondary btn-sm" @click="calibrationStore.clearHistory()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Clear History
        </button>
      </div>

      <div class="history-list">
        <div
          v-for="(item, index) in calibrationStore.calibrationHistory.slice().reverse().slice(0, 10)"
          :key="index"
          class="history-item"
          :class="{ success: item.success, failed: !item.success }"
        >
          <div class="history-icon">
            <svg v-if="item.success" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
          <div class="history-content">
            <div class="history-type">{{ item.type.toUpperCase() }}</div>
            <div class="history-time">{{ new Date(item.timestamp).toLocaleString() }}</div>
          </div>
          <div class="history-quality" :class="{
            good: item.quality >= 70,
            fair: item.quality >= 40 && item.quality < 70,
            poor: item.quality < 40
          }">
            {{ item.quality }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.expert-calibration-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.health-dashboard {
  @include card;
  padding: var(--spacing-xl);

  h2 {
    margin: 0 0 var(--spacing-xl) 0;
    color: var(--text-primary);
    font-size: var(--font-size-xl);
  }

  .health-overview {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--spacing-2xl);
    margin-bottom: var(--spacing-2xl);

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .health-score {
    display: flex;
    justify-content: center;

    .score-circle {
      position: relative;
      width: 200px;
      height: 200px;

      svg {
        width: 100%;
        height: 100%;
      }

      .score-value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;

        .value {
          display: block;
          font-size: 48px;
          font-weight: 700;
          color: var(--health-color);
          line-height: 1;
        }

        .label {
          display: block;
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
      }
    }
  }

  .health-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 28px;
        height: 28px;
      }

      &.calibrated {
        background: rgba(34, 197, 94, 0.1);
        color: var(--status-success);
      }

      &.pending {
        background: rgba(239, 68, 68, 0.1);
        color: var(--status-danger);
      }

      &.warning {
        background: rgba(251, 191, 36, 0.1);
        color: var(--status-warning);
      }
    }

    .stat-content {
      .stat-value {
        font-size: var(--font-size-2xl);
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
      }
    }
  }

  .recommendations {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);

    h3 {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
      font-size: var(--font-size-base);

      svg {
        width: 20px;
        height: 20px;
        color: var(--status-warning);
      }
    }

    .recommendations-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .recommendation-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: var(--bg-primary);
      border-left: 4px solid transparent;
      border-radius: var(--border-radius);

      &.high {
        border-left-color: var(--status-danger);

        .rec-priority {
          background: rgba(239, 68, 68, 0.1);
          color: var(--status-danger);
        }
      }

      &.medium {
        border-left-color: var(--status-warning);

        .rec-priority {
          background: rgba(251, 191, 36, 0.1);
          color: var(--status-warning);
        }
      }

      &.low {
        border-left-color: var(--primary-green);

        .rec-priority {
          background: rgba(44, 95, 45, 0.1);
          color: var(--primary-green);
        }
      }

      .rec-priority {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 18px;
      }

      .rec-content {
        flex: 1;

        .rec-type {
          font-weight: 600;
          color: var(--text-primary);
          font-size: var(--font-size-sm);
          margin-bottom: 2px;
        }

        .rec-reason {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
        }
      }
    }
  }
}

.calibrations-grid {
  h2 {
    margin: 0 0 var(--spacing-xl) 0;
    color: var(--text-primary);
    font-size: var(--font-size-xl);
  }

  .calibration-cards {
    display: grid;
    gap: var(--spacing-lg);
  }
}

.calibration-history {
  @include card;
  padding: var(--spacing-xl);

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-size: var(--font-size-xl);
    }
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);

    .history-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 20px;
        height: 20px;
      }
    }

    &.success .history-icon {
      background: rgba(34, 197, 94, 0.1);
      color: var(--status-success);
    }

    &.failed .history-icon {
      background: rgba(239, 68, 68, 0.1);
      color: var(--status-danger);
    }

    .history-content {
      flex: 1;

      .history-type {
        font-weight: 600;
        color: var(--text-primary);
        font-size: var(--font-size-sm);
      }

      .history-time {
        font-size: var(--font-size-xs);
        color: var(--text-tertiary);
      }
    }

    .history-quality {
      font-weight: 600;
      font-size: var(--font-size-sm);

      &.good { color: var(--status-success); }
      &.fair { color: var(--status-warning); }
      &.poor { color: var(--status-danger); }
    }
  }
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
}
</style>
