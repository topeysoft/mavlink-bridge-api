<script setup lang="ts">
import { computed, watch } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import SimpleCalibration from './SimpleCalibration.vue'
import CompassCalibration from './CompassCalibration.vue'
import AccelerometerCalibration from './AccelerometerCalibration.vue'

const calibrationStore = useCalibrationStore()

const currentStep = computed(() => calibrationStore.wizardStep)
const totalSteps = computed(() => calibrationStore.wizardSteps.length)
const currentType = computed(() => calibrationStore.wizardSteps[currentStep.value])
const currentState = computed(() => calibrationStore.calibrationStates[currentType.value])

const canGoNext = computed(() => {
  return currentStep.value < totalSteps.value - 1 && currentState.value.status !== 'in_progress'
})

const canGoPrevious = computed(() => {
  return currentStep.value > 0 && currentState.value.status !== 'in_progress'
})

const isComplete = computed(() => {
  return calibrationStore.wizardSteps.every(
    type => calibrationStore.calibrationStates[type].status === 'success'
  )
})

const progress = computed(() => {
  const completed = calibrationStore.wizardSteps.filter(
    type => calibrationStore.calibrationStates[type].status === 'success'
  ).length
  return Math.round((completed / totalSteps.value) * 100)
})

function next() {
  if (canGoNext.value) {
    calibrationStore.nextWizardStep()
  }
}

function previous() {
  if (canGoPrevious.value) {
    calibrationStore.previousWizardStep()
  }
}

function goToStep(index: number) {
  if (currentState.value.status !== 'in_progress') {
    calibrationStore.goToWizardStep(index)
  }
}

function reset() {
  calibrationStore.resetWizard()
}

// Auto-advance on success
watch(() => currentState.value.status, (newStatus) => {
  if (newStatus === 'success' && canGoNext.value) {
    setTimeout(() => {
      next()
    }, 2000) // Wait 2 seconds before auto-advancing
  }
})
</script>

<template>
  <div class="calibration-wizard">
    <!-- Wizard Header -->
    <div class="wizard-header">
      <h2>Calibration Wizard</h2>
      <p class="subtitle">Follow the steps below to calibrate your vehicle</p>

      <!-- Overall progress -->
      <div class="overall-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <p class="progress-label">{{ progress }}% Complete</p>
      </div>
    </div>

    <!-- Step indicators -->
    <div class="step-indicators">
      <div
        v-for="(type, index) in calibrationStore.wizardSteps"
        :key="type"
        class="step-indicator"
        :class="{
          active: index === currentStep,
          complete: calibrationStore.calibrationStates[type].status === 'success',
          error: calibrationStore.calibrationStates[type].status === 'failed'
        }"
        @click="goToStep(index)"
      >
        <div class="step-number">
          <svg v-if="calibrationStore.calibrationStates[type].status === 'success'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <svg v-else-if="calibrationStore.calibrationStates[type].status === 'failed'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="step-label">{{ type }}</div>
      </div>
    </div>

    <!-- Current step content -->
    <div class="step-content">
      <!-- Level calibration -->
      <SimpleCalibration v-if="currentType === 'level'" type="level" mode="consumer" />

      <!-- Gyro calibration -->
      <SimpleCalibration v-else-if="currentType === 'gyro'" type="gyro" mode="consumer" />

      <!-- Compass calibration -->
      <CompassCalibration v-else-if="currentType === 'compass'" mode="consumer" />

      <!-- Accelerometer calibration -->
      <AccelerometerCalibration v-else-if="currentType === 'accelerometer'" mode="consumer" />

      <!-- Radio calibration -->
      <SimpleCalibration v-else-if="currentType === 'radio'" type="radio" mode="consumer" />

      <!-- Pressure calibration -->
      <SimpleCalibration v-else-if="currentType === 'pressure'" type="pressure" mode="consumer" />
    </div>

    <!-- Navigation buttons -->
    <div class="wizard-navigation">
      <button
        class="btn btn-secondary"
        :disabled="!canGoPrevious"
        @click="previous"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Previous
      </button>

      <div class="step-counter">
        Step {{ currentStep + 1 }} of {{ totalSteps }}
      </div>

      <button
        v-if="!isComplete"
        class="btn btn-primary"
        :disabled="!canGoNext"
        @click="next"
      >
        Next
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      <button
        v-else
        class="btn btn-success"
        @click="reset"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        All Done! Start Over
      </button>
    </div>

    <!-- Completion message -->
    <div v-if="isComplete" class="completion-message">
      <svg viewBox="0 0 24 24" fill="currentColor" class="completion-icon">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <h3>Calibration Complete!</h3>
      <p>All sensors have been successfully calibrated. Your vehicle is ready to fly.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.calibration-wizard {
  max-width: 900px;
  margin: 0 auto;
}

.wizard-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  h2 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--primary-green);
    font-size: var(--font-size-2xl);
  }

  .subtitle {
    margin: 0 0 var(--spacing-xl) 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
  }

  .overall-progress {
    max-width: 600px;
    margin: 0 auto;

    .progress-bar {
      height: 12px;
      background: var(--bg-secondary);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-green) 0%, #87CEEB 100%);
        transition: width 0.5s ease;
      }
    }

    .progress-label {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 600;
    }
  }
}

.step-indicators {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-2xl);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 40px;
    right: 40px;
    height: 2px;
    background: var(--border-color);
    z-index: 0;
  }

  .step-indicator {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    position: relative;
    z-index: 1;

    .step-number {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.3s ease;

      svg {
        width: 24px;
        height: 24px;
      }
    }

    .step-label {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      text-transform: capitalize;
      transition: color 0.3s ease;
    }

    &.active {
      .step-number {
        background: var(--primary-green);
        border-color: var(--primary-green);
        color: white;
        transform: scale(1.1);
      }

      .step-label {
        color: var(--primary-green);
        font-weight: 600;
      }
    }

    &.complete {
      .step-number {
        background: var(--status-success);
        border-color: var(--status-success);
        color: white;
      }

      .step-label {
        color: var(--status-success);
      }
    }

    &.error {
      .step-number {
        background: var(--status-danger);
        border-color: var(--status-danger);
        color: white;
      }

      .step-label {
        color: var(--status-danger);
      }
    }

    &:hover:not(.active) {
      .step-number {
        border-color: var(--primary-green);
      }

      .step-label {
        color: var(--text-primary);
      }
    }
  }
}

.step-content {
  margin-bottom: var(--spacing-2xl);
}

.wizard-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);

  .step-counter {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-secondary);
  }
}

.completion-message {
  @include card;
  padding: calc(var(--spacing-xl) * 2);
  text-align: center;
  margin-top: var(--spacing-2xl);
  background: linear-gradient(135deg, rgba(44, 95, 45, 0.1) 0%, rgba(135, 206, 235, 0.1) 100%);

  .completion-icon {
    width: 80px;
    height: 80px;
    color: var(--status-success);
    margin-bottom: var(--spacing-lg);
  }

  h3 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--status-success);
    font-size: var(--font-size-2xl);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
  }
}

.btn-success {
  background: var(--status-success);
  color: white;
  border-color: var(--status-success);

  &:hover:not(:disabled) {
    background: #059669;
    border-color: #059669;
  }
}
</style>
