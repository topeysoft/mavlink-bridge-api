<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOnboardingStore } from '@/stores/onboarding'
import { useConnectionStore } from '@/stores/connection'
import { useAuthStore } from '@/stores/auth'
import { useFeaturesStore } from '@/stores/features'
import ProgressIndicator from './ProgressIndicator.vue'
import WelcomeScreen from './WelcomeScreen.vue'
import ConnectionStep from './steps/ConnectionStep.vue'
import AuthenticationStep from './steps/AuthenticationStep.vue'
import ConfigurationStep from './steps/ConfigurationStep.vue'
import CalibrationStep from './steps/CalibrationStep.vue'
import GPSBoostStep from './steps/GPSBoostStep.vue'
import TourStep from './steps/TourStep.vue'
import CompletionStep from './steps/CompletionStep.vue'
import type { UserType } from '@/stores/onboarding'

const router = useRouter()
const onboardingStore = useOnboardingStore()
const connectionStore = useConnectionStore()
const authStore = useAuthStore()
const featuresStore = useFeaturesStore()

// State
const showWelcome = ref(onboardingStore.needsWelcome)
const isTransitioning = ref(false)

// Computed
const currentStepId = computed(() => {
  const phaseToStepMap: Record<string, string> = {
    'welcome': 'welcome',
    'connection': 'connection',
    'authentication': 'authentication',
    'configuration': 'configuration',
    'calibration': 'calibration',
    'gps-boost': 'gps-boost',
    'tour': 'tour',
    'completed': 'tour'
  }
  return phaseToStepMap[onboardingStore.currentPhase] || 'welcome'
})

const allSteps = computed(() => {
  return onboardingStore.getStepsForUserType(onboardingStore.userType)
})

const canGoBack = computed(() => {
  const phase = onboardingStore.currentPhase
  return phase !== 'welcome' && phase !== 'not-started' && phase !== 'completed'
})

const canSkipCurrent = computed(() => {
  const currentStep = allSteps.value.find(s => s.id === currentStepId.value)
  return currentStep?.optional ?? false
})

// Actions
function handleWelcomeSelect(userType: UserType) {
  onboardingStore.setUserType(userType)

  // Set feature mode based on user type
  if (userType === 'consumer') {
    featuresStore.setUserMode('consumer')
  } else {
    featuresStore.setUserMode('power-user')
  }

  onboardingStore.completeStep('welcome')
  onboardingStore.setPhase('connection')
  showWelcome.value = false
}

function handleConnectionComplete() {
  onboardingStore.completeStep('connection')
  onboardingStore.setPhase('authentication')
}

function handleAuthenticationComplete() {
  onboardingStore.completeStep('authentication')
  onboardingStore.setPhase('configuration')
}

function handleConfigurationComplete() {
  onboardingStore.completeStep('configuration')

  // Decide next step based on user type and what needs to be done
  if (onboardingStore.isConsumerMode) {
    // In consumer mode, offer optional calibration
    onboardingStore.setPhase('calibration')
  } else {
    // In technical mode, go to tour
    onboardingStore.setPhase('tour')
  }
}

function handleCalibrationComplete() {
  onboardingStore.completeStep('calibration')
  onboardingStore.setPhase('gps-boost')
}

function handleCalibrationSkip() {
  onboardingStore.skipStep('calibration')
  onboardingStore.setPhase('gps-boost')
}

function handleGPSBoostComplete() {
  onboardingStore.completeStep('gps-boost')
  onboardingStore.setPhase('tour')
}

function handleGPSBoostSkip() {
  onboardingStore.skipStep('gps-boost')
  onboardingStore.setPhase('tour')
}

function handleTourComplete() {
  onboardingStore.completeStep('tour')
  completeOnboarding()
}

function handleTourSkip() {
  onboardingStore.skipStep('tour')
  completeOnboarding()
}

function completeOnboarding() {
  onboardingStore.completeOnboarding()
  router.push('/')
}

function goBack() {
  const phases = ['connection', 'authentication', 'configuration', 'calibration', 'gps-boost', 'tour']
  const currentIndex = phases.indexOf(onboardingStore.currentPhase)

  if (currentIndex > 0) {
    isTransitioning.value = true
    const previousPhase = phases[currentIndex - 1]
    onboardingStore.setPhase(previousPhase as any)

    setTimeout(() => {
      isTransitioning.value = false
    }, 300)
  }
}

function skipCurrentStep() {
  if (!canSkipCurrent.value) return

  const currentPhase = onboardingStore.currentPhase

  switch (currentPhase) {
    case 'calibration':
      handleCalibrationSkip()
      break
    case 'gps-boost':
      handleGPSBoostSkip()
      break
    case 'tour':
      handleTourSkip()
      break
  }
}

// Watch for connection loss during onboarding
watch(() => connectionStore.isConnected, (isConnected) => {
  if (!isConnected && onboardingStore.currentPhase !== 'connection' && onboardingStore.currentPhase !== 'welcome') {
    // Connection lost after we had established it
    console.warn('Connection lost during onboarding')
    // Could show a recovery dialog here
  }
})

// Initialize onboarding if not started
onMounted(() => {
  if (onboardingStore.status === 'not-started') {
    onboardingStore.startOnboarding()
  }
})
</script>

<template>
  <div class="setup-wizard">
    <!-- Welcome Screen (Full screen overlay) -->
    <WelcomeScreen
      v-model="showWelcome"
      @select="handleWelcomeSelect"
    />

    <!-- Main Wizard (shown after welcome) -->
    <div v-if="!showWelcome" class="wizard-container" :class="{ transitioning: isTransitioning }">
      <!-- Header -->
      <div class="wizard-header">
        <div class="header-content">
          <div class="logo">
            <span class="logo-icon">🚜</span>
            <span class="logo-text">YardRover Setup</span>
          </div>
          <div class="progress-text">
            Step {{ allSteps.findIndex(s => s.id === currentStepId) + 1 }} of {{ allSteps.filter(s => !s.optional || !s.skipped).length }}
          </div>
        </div>

        <!-- Progress Indicator -->
        <ProgressIndicator
          :steps="allSteps"
          :current-step-id="currentStepId"
          variant="line"
          :show-labels="true"
        />
      </div>

      <!-- Step Content -->
      <div class="wizard-content">
        <Transition name="slide-fade" mode="out-in">
          <!-- Connection Step -->
          <ConnectionStep
            v-if="onboardingStore.currentPhase === 'connection'"
            :key="'connection'"
            :user-type="onboardingStore.userType"
            @complete="handleConnectionComplete"
          />

          <!-- Authentication Step -->
          <AuthenticationStep
            v-else-if="onboardingStore.currentPhase === 'authentication'"
            :key="'authentication'"
            :user-type="onboardingStore.userType"
            @complete="handleAuthenticationComplete"
          />

          <!-- Configuration Step -->
          <ConfigurationStep
            v-else-if="onboardingStore.currentPhase === 'configuration'"
            :key="'configuration'"
            :user-type="onboardingStore.userType"
            @complete="handleConfigurationComplete"
          />

          <!-- Calibration Step (Optional) -->
          <CalibrationStep
            v-else-if="onboardingStore.currentPhase === 'calibration'"
            :key="'calibration'"
            :user-type="onboardingStore.userType"
            @complete="handleCalibrationComplete"
            @skip="handleCalibrationSkip"
          />

          <!-- GPS Boost Step (Optional) -->
          <GPSBoostStep
            v-else-if="onboardingStore.currentPhase === 'gps-boost'"
            :key="'gps-boost'"
            :user-type="onboardingStore.userType"
            @complete="handleGPSBoostComplete"
            @skip="handleGPSBoostSkip"
          />

          <!-- Tour Step (Optional) -->
          <TourStep
            v-else-if="onboardingStore.currentPhase === 'tour'"
            :key="'tour'"
            :user-type="onboardingStore.userType"
            @complete="handleTourComplete"
            @skip="handleTourSkip"
          />

          <!-- Completion Step -->
          <CompletionStep
            v-else-if="onboardingStore.currentPhase === 'completed'"
            :key="'completed'"
            :user-type="onboardingStore.userType"
            @continue="completeOnboarding"
          />
        </Transition>
      </div>

      <!-- Footer Navigation -->
      <div class="wizard-footer">
        <button
          v-if="canGoBack"
          class="btn btn-outline"
          @click="goBack"
        >
          ← Back
        </button>
        <div class="footer-spacer"></div>
        <button
          v-if="canSkipCurrent"
          class="btn btn-text"
          @click="skipCurrentStep"
        >
          Skip This Step
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;
@use 'sass:color';

.setup-wizard {
  min-height: 100vh;
  background: linear-gradient(135deg, rgba($primary, 0.05) 0%, rgba($secondary, 0.05) 100%);
}

.wizard-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--spacing-xl);
  transition: opacity 0.3s ease;

  &.transitioning {
    opacity: 0.7;
    pointer-events: none;
  }

  @include mobile {
    padding: var(--spacing-md);
  }
}

.wizard-header {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);

  .logo-icon {
    font-size: 32px;
    line-height: 1;
  }

  .logo-text {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--text-primary);
  }
}

.progress-text {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
}

.wizard-content {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  min-height: 500px;
  position: relative;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-xl);
  padding: 0 var(--spacing-md);
}

.footer-spacer {
  flex: 1;
}

// Transition Animations
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

// Responsive
@include mobile {
  .wizard-header {
    padding: var(--spacing-lg);
  }

  .header-content {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .logo {
    .logo-icon {
      font-size: 28px;
    }

    .logo-text {
      font-size: var(--font-size-lg);
    }
  }

  .wizard-footer {
    flex-wrap: wrap;
    gap: var(--spacing-sm);

    .btn {
      flex: 1;
      min-width: 120px;
    }
  }
}
</style>
