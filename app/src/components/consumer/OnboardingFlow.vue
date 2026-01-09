<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import { useDialog } from '@/composables/useDialog'
import { useCalibrationStore } from '@/stores/calibration'
import { useRTCMStore } from '@/stores/rtcm'
import ConsumerCalibrationStep from './ConsumerCalibrationStep.vue'
import ConsumerGPSBoostStep from './ConsumerGPSBoostStep.vue'

interface Props {
  modelValue: boolean
  includeSetup?: boolean // Whether to include calibration/GPS setup
}

const props = withDefaults(defineProps<Props>(), {
  includeSetup: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'complete': []
}>()

const dialog = useDialog()
const calibrationStore = useCalibrationStore()
const rtcmStore = useRTCMStore()

// Step types
type StepType = 'tour' | 'calibration' | 'gps-boost'

interface Step {
  type: StepType
  title: string
  emoji?: string
  description?: string
  content?: string
}

const currentStepIndex = ref(0)
const setupSkipped = ref(false)

// Track completion state
const setupProgress = ref({
  tour: false,
  calibration: false,
  gpsBoost: false
})

// Base tour steps
const tourSteps: Step[] = [
  {
    type: 'tour',
    title: 'Welcome to YardRover!',
    emoji: '👋',
    description: 'Let\'s get you started with a quick tour of the basics.',
    content: 'YardRover is your autonomous yard assistant. It can mow lawns, patrol your property, and help with various outdoor tasks - all controlled from this simple interface.'
  },
  {
    type: 'tour',
    title: 'Easy Task Management',
    emoji: '🎯',
    description: 'Create jobs with just a few clicks',
    content: 'Use Quick Tasks on your home screen to start common jobs. Click "Start a Job" to use our step-by-step wizard that guides you through selecting a task, choosing areas, and scheduling when it should run.'
  }
]

// Technical setup steps (only if includeSetup is true)
const setupSteps: Step[] = [
  {
    type: 'calibration',
    title: 'Setup Your YardRover'
  },
  {
    type: 'gps-boost',
    title: 'GPS Boost (Optional)'
  }
]

// Closing steps
const closingSteps: Step[] = [
  {
    type: 'tour',
    title: 'Stay in Control',
    emoji: '🎮',
    description: 'Monitor and manage everything',
    content: 'Check your YardRover\'s status at a glance, view upcoming jobs, and see your property map. The Emergency Stop button is always available in the header if you need to halt operations immediately.'
  },
  {
    type: 'tour',
    title: 'You\'re All Set!',
    emoji: '🎉',
    description: 'Ready to start your first job?',
    content: 'You can always switch to Power User or Developer mode from Settings if you need more advanced features. For now, enjoy the simple interface designed just for you!'
  }
]

// Build dynamic step list based on setup needs
const allSteps = computed<Step[]>(() => {
  const steps = [...tourSteps]

  if (props.includeSetup && !setupSkipped.value) {
    // Add calibration if needed
    if (calibrationStore.needsCalibration) {
      steps.push(setupSteps[0])
    }

    // Add GPS boost if not already configured
    if (!rtcmStore.isConnected) {
      steps.push(setupSteps[1])
    }
  }

  steps.push(...closingSteps)
  return steps
})

const totalSteps = computed(() => allSteps.value.length)
const currentStep = computed(() => allSteps.value[currentStepIndex.value])
const canProceed = computed(() => currentStepIndex.value < totalSteps.value)

function nextStep() {
  if (currentStepIndex.value < totalSteps.value - 1) {
    currentStepIndex.value++
  } else {
    completeOnboarding()
  }
}

function previousStep() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
  }
}

function handleCalibrationComplete() {
  setupProgress.value.calibration = true
  nextStep()
}

function handleCalibrationSkip() {
  setupProgress.value.calibration = false
  nextStep()
}

function handleGPSBoostComplete() {
  setupProgress.value.gpsBoost = true
  nextStep()
}

function handleGPSBoostSkip() {
  setupProgress.value.gpsBoost = false
  nextStep()
}

function completeOnboarding() {
  localStorage.setItem('yardrover_onboarding_completed', 'true')
  localStorage.setItem('yardrover_setup_progress', JSON.stringify(setupProgress.value))
  emit('complete')
  emit('update:modelValue', false)
}

async function skipOnboarding() {
  const confirmed = await dialog.confirm(
    'Are you sure you want to skip the tour? You can always view tips later.'
  )
  if (confirmed) {
    completeOnboarding()
  }
}

async function skipTechnicalSetup() {
  const confirmed = await dialog.confirm(
    'Skip technical setup? You can configure calibration and GPS Boost later in Settings.'
  )
  if (confirmed) {
    setupSkipped.value = true
  }
}

// Load progress on mount
onMounted(() => {
  const savedProgress = localStorage.getItem('yardrover_setup_progress')
  if (savedProgress) {
    try {
      setupProgress.value = JSON.parse(savedProgress)
    } catch (e) {
      console.error('Failed to parse setup progress:', e)
    }
  }
})
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="currentStep.title"
    :size="currentStep.type === 'tour' ? 'md' : 'lg'"
    :close-on-backdrop="false"
  >
    <div class="onboarding-content">
      <!-- Progress Dots (only for tour steps) -->
      <div v-if="currentStep.type === 'tour'" class="progress-dots">
        <div
          v-for="(step, index) in totalSteps"
          :key="index"
          class="progress-dot"
          :class="{ active: index === currentStepIndex, completed: index < currentStepIndex }"
        ></div>
      </div>

      <!-- Tour Content -->
      <div v-if="currentStep.type === 'tour'" class="step-content">
        <div class="step-emoji">{{ currentStep.emoji }}</div>
        <p class="step-description">{{ currentStep.description }}</p>
        <div class="step-details">{{ currentStep.content }}</div>

        <!-- Visual hints based on step title -->
        <div class="step-visual">
          <div v-if="currentStep.title.includes('Welcome')" class="visual-hint">
            <div class="hint-box">
              <span class="hint-icon">💡</span>
              <span>Simple mode means no technical jargon - just straightforward controls</span>
            </div>
          </div>

          <div v-else-if="currentStep.title.includes('Task')" class="visual-hint">
            <div class="hint-box">
              <span class="hint-icon">✨</span>
              <span>Look for the large task cards on your home screen</span>
            </div>
          </div>

          <div v-else-if="currentStep.title.includes('Control')" class="visual-hint">
            <div class="hint-box">
              <span class="hint-icon">🔔</span>
              <span>The mode indicator in the header shows you're in Consumer Mode</span>
            </div>
          </div>

          <div v-else-if="currentStep.title.includes('All Set')" class="visual-hint ready">
            <div class="hint-box success">
              <span class="hint-icon">🚀</span>
              <span>Ready to create your first job!</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Calibration Setup -->
      <ConsumerCalibrationStep
        v-else-if="currentStep.type === 'calibration'"
        :model-value="true"
        @complete="handleCalibrationComplete"
        @skip="handleCalibrationSkip"
      />

      <!-- GPS Boost Setup -->
      <ConsumerGPSBoostStep
        v-else-if="currentStep.type === 'gps-boost'"
        :model-value="true"
        @complete="handleGPSBoostComplete"
        @skip="handleGPSBoostSkip"
      />
    </div>

    <template #footer>
      <!-- Only show footer for tour steps (calibration/GPS have their own buttons) -->
      <div v-if="currentStep.type === 'tour'" class="onboarding-actions">
        <Button
          variant="outline"
          @click="skipOnboarding"
        >
          {{ includeSetup ? 'Skip All' : 'Skip Tour' }}
        </Button>

        <div class="nav-buttons">
          <Button
            v-if="currentStepIndex > 0"
            variant="outline"
            @click="previousStep"
          >
            ← Back
          </Button>
          <Button
            variant="primary"
            @click="nextStep"
          >
            {{ currentStepIndex < totalSteps - 1 ? 'Next →' : 'Get Started!' }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.onboarding-content {
  padding: var(--spacing-lg);
  min-height: 350px;
  display: flex;
  flex-direction: column;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-2xl);
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
  transition: all 0.3s;

  &.active {
    width: 24px;
    border-radius: 4px;
    background: var(--primary-green);
  }

  &.completed {
    background: var(--primary-green);
  }
}

.step-content {
  text-align: center;
  flex: 1;
}

.step-emoji {
  font-size: 80px;
  line-height: 1;
  margin-bottom: var(--spacing-lg);
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

.step-description {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
  line-height: 1.4;
}

.step-details {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 500px;
  margin: 0 auto;
}

.step-visual {
  margin-top: var(--spacing-xl);
}

.visual-hint {
  animation: fade-in 0.4s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

  &.success {
    background: rgba(44, 95, 45, 0.1);
    border-color: rgba(44, 95, 45, 0.3);
  }
}

.hint-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.onboarding-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: var(--spacing-md);
}

.nav-buttons {
  display: flex;
  gap: var(--spacing-md);
}
</style>
