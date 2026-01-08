<script setup lang="ts">
import { computed } from 'vue'
import { useCalibrationStore, type CalibrationType } from '@/stores/calibration'

const props = defineProps<{
  type: CalibrationType
  mode: 'consumer' | 'expert'
}>()

const calibrationStore = useCalibrationStore()

const state = computed(() => calibrationStore.calibrationStates[props.type])
const isActive = computed(() => state.value.status === 'in_progress')

const config = computed(() => {
  const configs: Record<CalibrationType, {
    title: string
    icon: string
    description: string
    consumerInstructions: string
    expertDescription: string
  }> = {
    gyro: {
      title: 'Gyroscope Calibration',
      icon: 'M12 2v20M2 12h20',
      description: 'Calibrate the gyroscope for accurate rotation sensing',
      consumerInstructions: 'Place the vehicle on a stable, level surface and keep it completely still during calibration',
      expertDescription: 'Gyroscope bias calibration - vehicle must remain stationary'
    },
    radio: {
      title: 'Radio/RC Calibration',
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4m14 4a2 2 0 110-4',
      description: 'Calibrate radio controller stick ranges and channels',
      consumerInstructions: 'Move all sticks and switches on your transmitter through their full range of motion',
      expertDescription: 'RC channel range calibration and failsafe configuration'
    },
    pressure: {
      title: 'Barometer Calibration',
      icon: 'M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 9l-5 5-5-5M12 12.8V2.5',
      description: 'Calibrate barometer for accurate altitude measurements',
      consumerInstructions: 'Keep the vehicle still at ground level for accurate pressure reference',
      expertDescription: 'Ground pressure calibration for relative altitude measurements'
    },
    level: {
      title: 'Level Horizon Calibration',
      icon: 'M3 12h18M3 6h18M3 18h18',
      description: 'Set the level horizon reference',
      consumerInstructions: 'Place the vehicle on a perfectly level surface',
      expertDescription: 'Level horizon accelerometer calibration - simplified single-position calibration'
    },
    compass: {
      title: 'Compass',
      icon: '',
      description: '',
      consumerInstructions: '',
      expertDescription: ''
    },
    accelerometer: {
      title: 'Accelerometer',
      icon: '',
      description: '',
      consumerInstructions: '',
      expertDescription: ''
    }
  }
  return configs[props.type]
})

async function startCalibration() {
  await calibrationStore.startCalibration(props.type)
}

function cancelCalibration() {
  calibrationStore.cancelCalibration(props.type)
}
</script>

<template>
  <div class="simple-calibration" :class="{ active: isActive }">
    <div class="calibration-header">
      <div class="header-content">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
            <path :d="config.icon"/>
          </svg>
          {{ config.title }}
        </h3>
        <p v-if="mode === 'consumer'" class="subtitle">
          {{ config.description }}
        </p>
      </div>

      <div class="status-badge" :class="state.status">
        {{ state.status === 'success' ? 'Calibrated' : state.status === 'in_progress' ? 'Calibrating...' : 'Not Calibrated' }}
      </div>
    </div>

    <!-- Consumer Mode View -->
    <div v-if="mode === 'consumer'" class="consumer-view">
      <!-- Active calibration -->
      <div v-if="isActive" class="calibration-active">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
        <p class="instruction">{{ config.consumerInstructions }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
        </div>
        <p class="progress-text">{{ state.progress }}% Complete</p>
        <p class="status-message">{{ state.message }}</p>
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
        <p class="instruction">{{ config.consumerInstructions }}</p>
        <p v-if="state.message" class="status-message">{{ state.message }}</p>
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
      <p class="description">{{ config.expertDescription }}</p>

      <div v-if="isActive" class="calibration-progress">
        <h4>Calibration Progress</h4>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${state.progress}%` }">
            <span v-if="state.progress > 10" class="progress-label">{{ state.progress }}%</span>
          </div>
        </div>
        <p class="progress-message">{{ state.message }}</p>
      </div>

      <div class="expert-controls">
        <button v-if="!isActive" class="btn btn-primary" @click="startCalibration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Start {{ config.title }}
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

      <div v-if="state.status === 'success'" class="calibration-info">
        <div class="info-item">
          <label>Quality:</label>
          <span>{{ state.quality }}%</span>
        </div>
        <div v-if="state.completedAt" class="info-item">
          <label>Completed:</label>
          <span>{{ new Date(state.completedAt).toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.simple-calibration {
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
  .calibration-active {
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    text-align: center;
    margin-bottom: var(--spacing-xl);

    .spinner-container {
      display: flex;
      justify-content: center;
      margin-bottom: var(--spacing-lg);
    }

    .instruction {
      margin: 0 0 var(--spacing-xl) 0;
      color: var(--text-primary);
      font-size: var(--font-size-lg);
      font-weight: 500;
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-primary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);

      .progress-fill {
        height: 100%;
        background: var(--primary-green);
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .status-message {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-style: italic;
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

      &.instruction {
        font-size: var(--font-size-base);
        margin-bottom: var(--spacing-md);
      }

      &.status-message {
        font-size: var(--font-size-sm);
        font-style: italic;
      }
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
  }
}

.expert-view {
  .description {
    margin: 0 0 var(--spacing-xl) 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
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

    .progress-bar {
      height: 32px;
      background: var(--bg-primary);
      border-radius: var(--border-radius);
      overflow: hidden;
      margin-bottom: var(--spacing-md);

      .progress-fill {
        height: 100%;
        background: var(--primary-green);
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;

        .progress-label {
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 600;
        }
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
    margin-bottom: var(--spacing-lg);

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

  .calibration-info {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);

    .info-item {
      display: flex;
      justify-content: space-between;
      padding: var(--spacing-sm) 0;
      border-bottom: 1px solid var(--border-color);

      &:last-child {
        border-bottom: none;
      }

      label {
        color: var(--text-secondary);
        font-weight: 500;
      }

      span {
        color: var(--text-primary);
      }
    }
  }
}
</style>
