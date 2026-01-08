<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import { useImuStore } from '@/stores/imu'

const props = defineProps<{
  mode: 'consumer' | 'expert'
}>()

const calibrationStore = useCalibrationStore()
const imuStore = useImuStore()

const state = computed(() => calibrationStore.calibrationStates.accelerometer)
const isActive = computed(() => state.value.status === 'in_progress')

// Accelerometer data
const tiltAngle = computed(() => imuStore.tiltAngle)
const isLevel = computed(() => imuStore.isLevel)
const totalAcceleration = computed(() => imuStore.totalAcceleration)

// Position stages for calibration
const positions = [
  { name: 'Level', icon: '⬜', description: 'Place vehicle level on flat surface' },
  { name: 'Nose Down', icon: '🔽', description: 'Tilt nose down 90°' },
  { name: 'Nose Up', icon: '🔼', description: 'Tilt nose up 90°' },
  { name: 'Left Side', icon: '◀️', description: 'Tilt left side down 90°' },
  { name: 'Right Side', icon: '▶️', description: 'Tilt right side down 90°' },
  { name: 'Upside Down', icon: '🔄', description: 'Turn vehicle upside down' }
]

const currentPosition = computed(() => {
  const progress = state.value.progress
  if (progress < 17) return 0
  if (progress < 34) return 1
  if (progress < 51) return 2
  if (progress < 68) return 3
  if (progress < 85) return 4
  return 5
})

async function startCalibration() {
  await calibrationStore.startCalibration('accelerometer')
}

function cancelCalibration() {
  calibrationStore.cancelCalibration('accelerometer')
}
</script>

<template>
  <div class="accelerometer-calibration" :class="{ active: isActive }">
    <div class="calibration-header">
      <div class="header-content">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          Accelerometer Calibration
        </h3>
        <p v-if="mode === 'consumer'" class="subtitle">
          Calibrate the accelerometer for accurate orientation sensing
        </p>
      </div>

      <div class="status-badge" :class="state.status">
        {{ state.status === 'success' ? 'Calibrated' : state.status === 'in_progress' ? 'Calibrating...' : 'Not Calibrated' }}
      </div>
    </div>

    <!-- Consumer Mode View -->
    <div v-if="mode === 'consumer'" class="consumer-view">
      <div class="visual-guide">
        <!-- Position indicator -->
        <div v-if="isActive" class="position-guide">
          <h4>Position {{ currentPosition + 1 }} of {{ positions.length }}</h4>
          <div class="position-icon">{{ positions[currentPosition].icon }}</div>
          <h3>{{ positions[currentPosition].name }}</h3>
          <p>{{ positions[currentPosition].description }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
          </div>
          <p class="progress-text">{{ state.progress }}% Complete</p>
        </div>

        <!-- Success view -->
        <div v-else-if="state.status === 'success'" class="success-message">
          <svg viewBox="0 0 24 24" fill="currentColor" class="success-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <h4>Calibration Complete!</h4>
          <p>Quality: {{ state.quality }}%</p>
        </div>

        <!-- Ready view -->
        <div v-else class="ready-message">
          <p>{{ state.message || 'Ready to calibrate accelerometer' }}</p>
          <div class="positions-preview">
            <h4>You will need to position the vehicle in {{ positions.length }} orientations:</h4>
            <div class="positions-grid">
              <div v-for="(pos, index) in positions" :key="index" class="position-item">
                <div class="pos-icon">{{ pos.icon }}</div>
                <div class="pos-name">{{ pos.name }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Level indicator -->
        <div class="level-indicator">
          <h4>Current Orientation</h4>
          <div class="level-display">
            <div class="bubble" :class="{ centered: isLevel }" :style="{
              transform: `translate(${Math.sin(tiltAngle * Math.PI / 180) * 30}px, 0)`
            }"></div>
          </div>
          <p>Tilt: {{ Math.round(tiltAngle) }}° {{ isLevel ? '(Level ✓)' : '' }}</p>
        </div>
      </div>

      <div class="action-buttons">
        <button v-if="!isActive && state.status !== 'success'" class="btn btn-primary" @click="startCalibration">
          Start Calibration
        </button>
        <button v-if="isActive" class="btn btn-secondary" @click="cancelCalibration">
          Cancel
        </button>
        <button v-if="state.status === 'success'" class="btn btn-secondary" @click="startCalibration">
          Re-calibrate
        </button>
      </div>
    </div>

    <!-- Expert Mode View -->
    <div v-else class="expert-view">
      <div class="metrics-grid">
        <div class="metric-card">
          <label>Total Acceleration</label>
          <div class="value">{{ totalAcceleration.toFixed(2) }}</div>
          <div class="sublabel">m/s²</div>
        </div>

        <div class="metric-card">
          <label>Tilt Angle</label>
          <div class="value" :class="{
            'text-success': tiltAngle < 15,
            'text-warning': tiltAngle >= 15 && tiltAngle < 30,
            'text-danger': tiltAngle >= 30
          }">
            {{ Math.round(tiltAngle) }}°
          </div>
        </div>

        <div class="metric-card">
          <label>Level Status</label>
          <div class="value" :class="{ 'text-success': isLevel, 'text-warning': !isLevel }">
            {{ isLevel ? 'LEVEL' : 'TILTED' }}
          </div>
        </div>

        <div class="metric-card">
          <label>Health</label>
          <div class="value" :class="{
            'text-success': imuStore.health === 'excellent' || imuStore.health === 'good',
            'text-warning': imuStore.health === 'fair' || imuStore.health === 'poor',
            'text-danger': imuStore.health === 'error'
          }">
            {{ imuStore.health.toUpperCase() }}
          </div>
        </div>
      </div>

      <div v-if="isActive" class="calibration-progress">
        <h4>Calibration Progress</h4>
        <div class="positions-status">
          <div v-for="(pos, index) in positions" :key="index" class="position-status" :class="{
            active: currentPosition === index,
            complete: currentPosition > index
          }">
            <div class="pos-icon">{{ pos.icon }}</div>
            <div class="pos-name">{{ pos.name }}</div>
            <svg v-if="currentPosition > index" viewBox="0 0 24 24" fill="currentColor" class="check-icon">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
        </div>
        <p class="progress-message">{{ state.message }}</p>
      </div>

      <div class="expert-controls">
        <button v-if="!isActive" class="btn btn-primary" @click="startCalibration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Start Accelerometer Calibration
        </button>
        <button v-else class="btn btn-danger" @click="cancelCalibration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Cancel
        </button>
      </div>

      <div v-if="state.errors.length > 0" class="error-messages">
        <h4>Errors</h4>
        <ul>
          <li v-for="(error, index) in state.errors" :key="index">{{ error }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.accelerometer-calibration {
  @include card;
  padding: var(--spacing-xl);

  &.active {
    border-color: var(--primary-green);
  }
}

.calibration-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);

  .header-content {
    h3 {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-xl);
      color: var(--text-primary);

      .icon {
        width: 28px;
        height: 28px;
        color: var(--primary-green);
      }
    }

    .subtitle {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .status-badge {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--border-radius);
    font-size: var(--font-size-sm);
    font-weight: 600;
    background: var(--bg-secondary);
    color: var(--text-secondary);

    &.success {
      background: var(--status-success);
      color: white;
    }

    &.in_progress {
      background: var(--primary-green);
      color: white;
    }
  }
}

.consumer-view {
  .position-guide {
    padding: var(--spacing-xl);
    background: linear-gradient(135deg, var(--primary-green) 0%, #87CEEB 100%);
    color: white;
    border-radius: var(--border-radius);
    text-align: center;
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      font-size: var(--font-size-sm);
      opacity: 0.9;
    }

    .position-icon {
      font-size: 64px;
      margin: var(--spacing-lg) 0;
    }

    h3 {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-2xl);
    }

    p {
      margin: 0 0 var(--spacing-xl) 0;
      font-size: var(--font-size-lg);
      opacity: 0.95;
    }

    .progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);

      .progress-fill {
        height: 100%;
        background: white;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      font-size: var(--font-size-sm);
      opacity: 0.9;
    }
  }

  .success-message,
  .ready-message {
    padding: var(--spacing-xl);
    text-align: center;
    margin-bottom: var(--spacing-xl);

    .success-icon {
      width: 64px;
      height: 64px;
      color: var(--status-success);
      margin-bottom: var(--spacing-md);
    }

    h4 {
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--text-primary);
    }

    p {
      margin: 0;
      color: var(--text-secondary);
    }

    .positions-preview {
      margin-top: var(--spacing-xl);

      h4 {
        margin-bottom: var(--spacing-lg);
        font-size: var(--font-size-base);
      }

      .positions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: var(--spacing-md);

        .position-item {
          padding: var(--spacing-md);
          background: var(--bg-secondary);
          border-radius: var(--border-radius);

          .pos-icon {
            font-size: 32px;
            margin-bottom: var(--spacing-xs);
          }

          .pos-name {
            font-size: var(--font-size-xs);
            color: var(--text-secondary);
          }
        }
      }
    }
  }

  .level-indicator {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      text-align: center;
      color: var(--text-primary);
    }

    .level-display {
      position: relative;
      height: 60px;
      background: linear-gradient(to right, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%);
      border-radius: 30px;
      margin-bottom: var(--spacing-md);
      display: flex;
      align-items: center;
      justify-content: center;

      .bubble {
        width: 40px;
        height: 40px;
        background: radial-gradient(circle at 30% 30%, #87CEEB, var(--primary-green));
        border-radius: 50%;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

        &.centered {
          box-shadow: 0 0 0 3px var(--status-success);
        }
      }
    }

    p {
      margin: 0;
      text-align: center;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
  }
}

.expert-view {
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .metric-card {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    text-align: center;

    label {
      display: block;
      margin-bottom: var(--spacing-sm);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .value {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--text-primary);

      &.text-success { color: var(--status-success); }
      &.text-warning { color: var(--status-warning); }
      &.text-danger { color: var(--status-danger); }
    }

    .sublabel {
      margin-top: var(--spacing-xs);
      color: var(--text-tertiary);
      font-size: var(--font-size-xs);
    }
  }

  .calibration-progress {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    .positions-status {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);

      .position-status {
        position: relative;
        padding: var(--spacing-md);
        background: var(--bg-primary);
        border: 2px solid transparent;
        border-radius: var(--border-radius);
        text-align: center;

        &.active {
          border-color: var(--primary-green);
        }

        &.complete {
          background: rgba(34, 197, 94, 0.1);
        }

        .pos-icon {
          font-size: 24px;
          margin-bottom: var(--spacing-xs);
        }

        .pos-name {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
        }

        .check-icon {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 16px;
          height: 16px;
          color: var(--status-success);
        }
      }
    }

    .progress-bar {
      height: 24px;
      background: var(--bg-primary);
      border-radius: var(--border-radius);
      overflow: hidden;
      margin-bottom: var(--spacing-md);

      .progress-fill {
        height: 100%;
        background: var(--primary-green);
        transition: width 0.3s ease;
      }
    }

    .progress-message {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .expert-controls {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .error-messages {
    padding: var(--spacing-lg);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--status-danger);
    border-radius: var(--border-radius);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--status-danger);
    }

    ul {
      margin: 0;
      padding-left: var(--spacing-xl);
      color: var(--text-secondary);
    }
  }
}
</style>
