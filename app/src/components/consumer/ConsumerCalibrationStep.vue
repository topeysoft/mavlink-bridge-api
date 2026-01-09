<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import Button from '@/components/common/Button.vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'complete': []
  'skip': []
}>()

const calibrationStore = useCalibrationStore()

// Simplified calibration steps for consumers
const steps = [
  {
    id: 'level',
    title: 'Level Check',
    emoji: '📏',
    description: 'Let\'s make sure your YardRover knows when it\'s on flat ground',
    instructions: [
      'Place your YardRover on a flat, level surface',
      'Make sure it\'s stable and not moving',
      'Click "Start Check" and wait for it to complete'
    ],
    calibrationType: 'level' as const
  },
  {
    id: 'compass',
    title: 'Direction Setup',
    emoji: '🧭',
    description: 'Teaching your YardRover which way is North',
    instructions: [
      'Keep YardRover in an open area, away from metal objects',
      'Click "Start Setup"',
      'Slowly rotate YardRover in a complete circle',
      'Try to keep the rotation smooth and steady'
    ],
    calibrationType: 'compass' as const
  },
  {
    id: 'gyro',
    title: 'Movement Setup',
    emoji: '🎯',
    description: 'Calibrating movement sensors for smooth operation',
    instructions: [
      'Keep YardRover completely still',
      'Don\'t touch or move it during this process',
      'Click "Start Setup" and wait'
    ],
    calibrationType: 'gyro' as const
  }
]

const currentStepIndex = ref(0)
const isCalibrating = ref(false)
const calibrationProgress = ref(0)

const currentStep = computed(() => steps[currentStepIndex.value])
const canProceed = computed(() => {
  const state = calibrationStore.calibrationStates[currentStep.value.calibrationType]
  return state?.status === 'success'
})
const canGoBack = computed(() => currentStepIndex.value > 0 && !isCalibrating.value)
const isLastStep = computed(() => currentStepIndex.value === steps.length - 1)

// Current calibration state
const currentCalibrationState = computed(() => {
  return calibrationStore.calibrationStates[currentStep.value.calibrationType]
})

const statusMessage = computed(() => {
  const state = currentCalibrationState.value
  if (!state) return ''

  if (state.status === 'in_progress') return 'In progress...'
  if (state.status === 'success') return '✓ Complete!'
  if (state.status === 'failed') return `Error: ${state.message || 'Calibration failed'}`
  return ''
})

const statusColor = computed(() => {
  const state = currentCalibrationState.value
  if (!state) return ''

  if (state.status === 'in_progress') return 'var(--primary-green)'
  if (state.status === 'success') return 'var(--status-success)'
  if (state.status === 'failed') return 'var(--status-danger)'
  return ''
})

async function startCalibration() {
  isCalibrating.value = true
  calibrationProgress.value = 0

  try {
    await calibrationStore.startCalibration(currentStep.value.calibrationType)

    // Simulate progress updates (real implementation would get this from store)
    const progressInterval = setInterval(() => {
      if (currentCalibrationState.value?.status !== 'in_progress') {
        clearInterval(progressInterval)
        isCalibrating.value = false
        calibrationProgress.value = 100
      } else {
        calibrationProgress.value = Math.min(calibrationProgress.value + 10, 90)
      }
    }, 500)
  } catch (error) {
    console.error('Calibration failed:', error)
    isCalibrating.value = false
  }
}

function nextStep() {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++
    calibrationProgress.value = 0
  } else {
    completeSetup()
  }
}

function previousStep() {
  if (canGoBack.value) {
    currentStepIndex.value--
    calibrationProgress.value = 0
  }
}

function completeSetup() {
  emit('complete')
}

function skipSetup() {
  emit('skip')
}

// Watch for auto-advance on success
watch(() => currentCalibrationState.value?.status, (status) => {
  if (status === 'success') {
    calibrationProgress.value = 100
    // Auto-advance after 2 seconds if not the last step
    if (!isLastStep.value) {
      setTimeout(() => {
        nextStep()
      }, 2000)
    }
  }
})

// Initialize calibration store
onMounted(() => {
  // Check current calibration status
  calibrationStore.fetchCalibrationStatus?.()
})
</script>

<template>
  <div class="calibration-step">
    <!-- Progress Header -->
    <div class="progress-header">
      <div class="progress-dots">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="progress-dot"
          :class="{
            active: index === currentStepIndex,
            completed: calibrationStore.calibrationStates[step.calibrationType]?.status === 'success'
          }"
        >
          <span v-if="calibrationStore.calibrationStates[step.calibrationType]?.status === 'success'">✓</span>
          <span v-else>{{ index + 1 }}</span>
        </div>
      </div>
      <p class="progress-text">Step {{ currentStepIndex + 1 }} of {{ steps.length }}</p>
    </div>

    <!-- Step Content -->
    <div class="step-content">
      <div class="step-emoji">{{ currentStep.emoji }}</div>
      <h2 class="step-title">{{ currentStep.title }}</h2>
      <p class="step-description">{{ currentStep.description }}</p>

      <!-- Instructions -->
      <div class="instructions">
        <h3 class="instructions-title">What to do:</h3>
        <ol class="instructions-list">
          <li v-for="(instruction, index) in currentStep.instructions" :key="index">
            {{ instruction }}
          </li>
        </ol>
      </div>

      <!-- Calibration Status -->
      <div v-if="statusMessage" class="status-message" :style="{ color: statusColor }">
        {{ statusMessage }}
      </div>

      <!-- Progress Bar (during calibration) -->
      <div v-if="isCalibrating" class="calibration-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${calibrationProgress}%` }"></div>
        </div>
        <p class="progress-label">{{ calibrationProgress }}%</p>
      </div>

      <!-- Visual Hint -->
      <div class="visual-hint">
        <div v-if="currentStep.id === 'level'" class="hint-box">
          <span class="hint-icon">💡</span>
          <span>Tip: Use a garage floor or driveway for the best results</span>
        </div>
        <div v-else-if="currentStep.id === 'compass'" class="hint-box">
          <span class="hint-icon">⚠️</span>
          <span>Stay away from cars, metal fences, or power lines</span>
        </div>
        <div v-else-if="currentStep.id === 'gyro'" class="hint-box">
          <span class="hint-icon">⏱️</span>
          <span>This only takes about 10 seconds</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="step-actions">
      <div class="primary-actions">
        <Button
          v-if="!canProceed"
          variant="primary"
          size="lg"
          :disabled="isCalibrating"
          @click="startCalibration"
        >
          {{ isCalibrating ? 'Calibrating...' : 'Start ' + currentStep.title }}
        </Button>
        <Button
          v-else
          variant="primary"
          size="lg"
          @click="nextStep"
        >
          {{ isLastStep ? 'Finish Setup' : 'Next Step →' }}
        </Button>
      </div>

      <div class="secondary-actions">
        <Button
          v-if="canGoBack"
          variant="outline"
          @click="previousStep"
        >
          ← Back
        </Button>
        <Button
          variant="text"
          @click="skipSetup"
        >
          Skip Setup
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.calibration-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  min-height: 500px;
}

.progress-header {
  text-align: center;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.progress-dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--text-tertiary);
  transition: all 0.3s ease;

  &.active {
    background: var(--primary-green);
    border-color: var(--primary-green);
    color: white;
    transform: scale(1.1);
  }

  &.completed {
    background: var(--status-success);
    border-color: var(--status-success);
    color: white;
  }
}

.progress-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-weight: 500;
}

.step-content {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.step-emoji {
  font-size: 80px;
  line-height: 1;
  animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.step-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.step-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  max-width: 500px;
  line-height: 1.6;
}

.instructions {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  max-width: 600px;
  width: 100%;
  text-align: left;

  .instructions-title {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--text-primary);
  }

  .instructions-list {
    margin: 0;
    padding-left: var(--spacing-xl);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: 1.8;

    li {
      margin-bottom: var(--spacing-sm);

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

.status-message {
  font-size: var(--font-size-lg);
  font-weight: 600;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background: rgba(44, 95, 45, 0.1);
}

.calibration-progress {
  width: 100%;
  max-width: 400px;

  .progress-bar {
    height: 8px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: var(--spacing-sm);

    .progress-fill {
      height: 100%;
      background: var(--primary-green);
      transition: width 0.3s ease;
    }
  }

  .progress-label {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-weight: 600;
    text-align: center;
  }
}

.visual-hint {
  width: 100%;
  max-width: 600px;
}

.hint-box {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}

.hint-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.step-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

.primary-actions {
  display: flex;
  justify-content: center;
}

.secondary-actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
}
</style>
