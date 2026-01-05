<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from '@/components/common/Modal.vue'
import Button from '@/components/common/Button.vue'
import { useDialog } from '@/composables/useDialog'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'complete': []
}>()

const dialog = useDialog()

const currentStep = ref(1)
const totalSteps = 4

const steps = [
  {
    title: 'Welcome to YardRover!',
    emoji: '👋',
    description: 'Let\'s get you started with a quick tour of the basics.',
    content: 'YardRover is your autonomous yard assistant. It can mow lawns, patrol your property, and help with various outdoor tasks - all controlled from this simple interface.'
  },
  {
    title: 'Easy Task Management',
    emoji: '🎯',
    description: 'Create jobs with just a few clicks',
    content: 'Use Quick Tasks on your home screen to start common jobs. Click "Start a Job" to use our step-by-step wizard that guides you through selecting a task, choosing areas, and scheduling when it should run.'
  },
  {
    title: 'Stay in Control',
    emoji: '🎮',
    description: 'Monitor and manage everything',
    content: 'Check your YardRover\'s status at a glance, view upcoming jobs, and see your property map. The Emergency Stop button is always available in the header if you need to halt operations immediately.'
  },
  {
    title: 'You\'re All Set!',
    emoji: '🎉',
    description: 'Ready to start your first job?',
    content: 'You can always switch to Power User or Developer mode from Settings if you need more advanced features. For now, enjoy the simple interface designed just for you!'
  }
]

const currentStepData = computed(() => steps[currentStep.value - 1] || steps[0])

const canProceed = computed(() => currentStep.value <= totalSteps)

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
  } else {
    completeOnboarding()
  }
}

function previousStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function completeOnboarding() {
  localStorage.setItem('yardrover_onboarding_completed', 'true')
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
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="currentStepData.title"
    size="md"
    :close-on-backdrop="false"
  >
    <div class="onboarding-content">
      <!-- Progress Dots -->
      <div class="progress-dots">
        <div
          v-for="step in totalSteps"
          :key="step"
          class="progress-dot"
          :class="{ active: step === currentStep, completed: step < currentStep }"
        ></div>
      </div>

      <!-- Step Content -->
      <div class="step-content">
        <div class="step-emoji">{{ currentStepData.emoji }}</div>
        <p class="step-description">{{ currentStepData.description }}</p>
        <div class="step-details">{{ currentStepData.content }}</div>
      </div>

      <!-- Visual hints based on step -->
      <div class="step-visual">
        <div v-if="currentStep === 1" class="visual-hint">
          <div class="hint-box">
            <span class="hint-icon">💡</span>
            <span>Simple mode means no technical jargon - just straightforward controls</span>
          </div>
        </div>

        <div v-if="currentStep === 2" class="visual-hint">
          <div class="hint-box">
            <span class="hint-icon">✨</span>
            <span>Look for the large task cards on your home screen</span>
          </div>
        </div>

        <div v-if="currentStep === 3" class="visual-hint">
          <div class="hint-box">
            <span class="hint-icon">🔔</span>
            <span>The mode indicator in the header shows you're in Consumer Mode</span>
          </div>
        </div>

        <div v-if="currentStep === 4" class="visual-hint ready">
          <div class="hint-box success">
            <span class="hint-icon">🚀</span>
            <span>Ready to create your first job!</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="onboarding-actions">
        <Button
          variant="outline"
          @click="skipOnboarding"
        >
          Skip Tour
        </Button>

        <div class="nav-buttons">
          <Button
            v-if="currentStep > 1"
            variant="outline"
            @click="previousStep"
          >
            ← Back
          </Button>
          <Button
            variant="primary"
            @click="nextStep"
          >
            {{ currentStep < totalSteps ? 'Next →' : 'Get Started!' }}
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
