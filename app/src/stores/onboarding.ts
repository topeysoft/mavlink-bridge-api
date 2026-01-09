import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/**
 * Onboarding phase types representing the user's journey
 */
export type OnboardingPhase =
  | 'not-started'
  | 'welcome'
  | 'connection'
  | 'authentication'
  | 'configuration'
  | 'calibration'
  | 'gps-boost'
  | 'tour'
  | 'completed'

/**
 * User type selection for tailored experience
 */
export type UserType = 'consumer' | 'technical' | null

/**
 * Onboarding step completion state
 */
export interface OnboardingStep {
  id: string
  label: string
  phase: OnboardingPhase
  completed: boolean
  skipped: boolean
  optional: boolean
  completedAt: number | null
}

/**
 * Onboarding state interface
 */
export interface OnboardingState {
  status: 'not-started' | 'in-progress' | 'completed'
  currentPhase: OnboardingPhase
  completedSteps: string[]
  skippedSteps: string[]
  isFirstRun: boolean
  userType: UserType
  lastCompletedAt: number | null
  lastResumedAt: number | null
}

const STORAGE_KEY = 'yardrover_onboarding_state'

/**
 * Load onboarding state from localStorage
 */
function loadState(): OnboardingState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load onboarding state:', error)
  }
  return null
}

/**
 * Save onboarding state to localStorage
 */
function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save onboarding state:', error)
  }
}

/**
 * Onboarding store for managing first-run experience and setup flow
 */
export const useOnboardingStore = defineStore('onboarding', () => {
  // Load existing state or initialize
  const savedState = loadState()

  // State
  const status = ref<'not-started' | 'in-progress' | 'completed'>(
    savedState?.status || 'not-started'
  )
  const currentPhase = ref<OnboardingPhase>(
    savedState?.currentPhase || 'not-started'
  )
  const completedSteps = ref<string[]>(savedState?.completedSteps || [])
  const skippedSteps = ref<string[]>(savedState?.skippedSteps || [])
  const isFirstRun = ref<boolean>(savedState?.isFirstRun ?? true)
  const userType = ref<UserType>(savedState?.userType || null)
  const lastCompletedAt = ref<number | null>(savedState?.lastCompletedAt || null)
  const lastResumedAt = ref<number | null>(savedState?.lastResumedAt || null)

  // Computed
  const isOnboardingComplete = computed(() => status.value === 'completed')

  const isOnboardingInProgress = computed(() => status.value === 'in-progress')

  const canResumeOnboarding = computed(() => {
    return (
      status.value === 'in-progress' &&
      completedSteps.value.length > 0 &&
      currentPhase.value !== 'not-started'
    )
  })

  const onboardingProgress = computed(() => {
    const allSteps = getStepsForUserType(userType.value)
    const completed = completedSteps.value.length
    const total = allSteps.filter(s => !s.optional).length
    return Math.round((completed / total) * 100)
  })

  const needsWelcome = computed(() => {
    return isFirstRun.value && !completedSteps.value.includes('welcome')
  })

  const needsConnection = computed(() => {
    return !completedSteps.value.includes('connection')
  })

  const needsAuthentication = computed(() => {
    return !completedSteps.value.includes('authentication')
  })

  const needsConfiguration = computed(() => {
    return !completedSteps.value.includes('configuration')
  })

  const isConsumerMode = computed(() => {
    return userType.value === 'consumer'
  })

  // Actions

  /**
   * Start onboarding flow
   */
  function startOnboarding(): void {
    status.value = 'in-progress'
    currentPhase.value = 'welcome'
    isFirstRun.value = true
    persist()
  }

  /**
   * Resume interrupted onboarding
   */
  function resumeOnboarding(): void {
    lastResumedAt.value = Date.now()
    status.value = 'in-progress'
    persist()
  }

  /**
   * Set user type (consumer or technical)
   */
  function setUserType(type: UserType): void {
    userType.value = type
    persist()
  }

  /**
   * Mark a step as completed
   */
  function completeStep(stepId: string): void {
    if (!completedSteps.value.includes(stepId)) {
      completedSteps.value.push(stepId)
    }
    // Remove from skipped if it was skipped before
    const skippedIndex = skippedSteps.value.indexOf(stepId)
    if (skippedIndex !== -1) {
      skippedSteps.value.splice(skippedIndex, 1)
    }
    persist()
  }

  /**
   * Skip an optional step
   */
  function skipStep(stepId: string): void {
    if (!skippedSteps.value.includes(stepId)) {
      skippedSteps.value.push(stepId)
    }
    // Remove from completed if it was completed before
    const completedIndex = completedSteps.value.indexOf(stepId)
    if (completedIndex !== -1) {
      completedSteps.value.splice(completedIndex, 1)
    }
    persist()
  }

  /**
   * Set current phase
   */
  function setPhase(phase: OnboardingPhase): void {
    currentPhase.value = phase
    persist()
  }

  /**
   * Complete the entire onboarding process
   */
  function completeOnboarding(): void {
    status.value = 'completed'
    currentPhase.value = 'completed'
    lastCompletedAt.value = Date.now()
    isFirstRun.value = false
    persist()
  }

  /**
   * Reset onboarding state (for testing or re-onboarding)
   */
  function resetOnboarding(): void {
    status.value = 'not-started'
    currentPhase.value = 'not-started'
    completedSteps.value = []
    skippedSteps.value = []
    isFirstRun.value = true
    userType.value = null
    lastCompletedAt.value = null
    lastResumedAt.value = null
    persist()
  }

  /**
   * Check if a specific step is completed
   */
  function isStepCompleted(stepId: string): boolean {
    return completedSteps.value.includes(stepId)
  }

  /**
   * Check if a specific step is skipped
   */
  function isStepSkipped(stepId: string): boolean {
    return skippedSteps.value.includes(stepId)
  }

  /**
   * Get next phase in the onboarding flow
   */
  function getNextPhase(): OnboardingPhase | null {
    const phases: OnboardingPhase[] = [
      'welcome',
      'connection',
      'authentication',
      'configuration',
      'calibration',
      'gps-boost',
      'tour',
      'completed'
    ]

    const currentIndex = phases.indexOf(currentPhase.value)
    if (currentIndex < phases.length - 1) {
      // Skip optional phases if user is in consumer mode and they were skipped
      let nextIndex = currentIndex + 1
      while (nextIndex < phases.length) {
        const nextPhase = phases[nextIndex]
        // Allow optional phases to be skipped
        if (
          (nextPhase === 'calibration' || nextPhase === 'gps-boost') &&
          skippedSteps.value.includes(nextPhase)
        ) {
          nextIndex++
        } else {
          return nextPhase
        }
      }
    }
    return null
  }

  /**
   * Move to next phase
   */
  function moveToNextPhase(): void {
    const nextPhase = getNextPhase()
    if (nextPhase) {
      setPhase(nextPhase)
    } else {
      completeOnboarding()
    }
  }

  /**
   * Persist state to localStorage
   */
  function persist(): void {
    const state: OnboardingState = {
      status: status.value,
      currentPhase: currentPhase.value,
      completedSteps: completedSteps.value,
      skippedSteps: skippedSteps.value,
      isFirstRun: isFirstRun.value,
      userType: userType.value,
      lastCompletedAt: lastCompletedAt.value,
      lastResumedAt: lastResumedAt.value,
    }
    saveState(state)
  }

  /**
   * Get steps configuration for user type
   */
  function getStepsForUserType(type: UserType): OnboardingStep[] {
    const baseSteps: OnboardingStep[] = [
      {
        id: 'welcome',
        label: 'Welcome',
        phase: 'welcome',
        completed: isStepCompleted('welcome'),
        skipped: false,
        optional: false,
        completedAt: null,
      },
      {
        id: 'connection',
        label: 'Connect Device',
        phase: 'connection',
        completed: isStepCompleted('connection'),
        skipped: false,
        optional: false,
        completedAt: null,
      },
      {
        id: 'authentication',
        label: type === 'consumer' ? 'Secure Device' : 'Authentication',
        phase: 'authentication',
        completed: isStepCompleted('authentication'),
        skipped: false,
        optional: false,
        completedAt: null,
      },
      {
        id: 'configuration',
        label: type === 'consumer' ? 'Name Your Device' : 'Configuration',
        phase: 'configuration',
        completed: isStepCompleted('configuration'),
        skipped: false,
        optional: false,
        completedAt: null,
      },
    ]

    // Add optional steps
    const optionalSteps: OnboardingStep[] = [
      {
        id: 'calibration',
        label: type === 'consumer' ? 'Setup Check' : 'Calibration',
        phase: 'calibration',
        completed: isStepCompleted('calibration'),
        skipped: isStepSkipped('calibration'),
        optional: true,
        completedAt: null,
      },
      {
        id: 'gps-boost',
        label: type === 'consumer' ? 'GPS Boost' : 'RTK/GPS Setup',
        phase: 'gps-boost',
        completed: isStepCompleted('gps-boost'),
        skipped: isStepSkipped('gps-boost'),
        optional: true,
        completedAt: null,
      },
    ]

    const closingSteps: OnboardingStep[] = [
      {
        id: 'tour',
        label: 'Quick Tour',
        phase: 'tour',
        completed: isStepCompleted('tour'),
        skipped: isStepSkipped('tour'),
        optional: true,
        completedAt: null,
      },
    ]

    return [...baseSteps, ...optionalSteps, ...closingSteps]
  }

  return {
    // State
    status,
    currentPhase,
    completedSteps,
    skippedSteps,
    isFirstRun,
    userType,
    lastCompletedAt,
    lastResumedAt,

    // Computed
    isOnboardingComplete,
    isOnboardingInProgress,
    canResumeOnboarding,
    onboardingProgress,
    needsWelcome,
    needsConnection,
    needsAuthentication,
    needsConfiguration,
    isConsumerMode,

    // Actions
    startOnboarding,
    resumeOnboarding,
    setUserType,
    completeStep,
    skipStep,
    setPhase,
    completeOnboarding,
    resetOnboarding,
    isStepCompleted,
    isStepSkipped,
    getNextPhase,
    moveToNextPhase,
    getStepsForUserType,
  }
})
