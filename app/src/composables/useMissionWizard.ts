/**
 * Composable for mission wizard state management
 */

import { ref, computed } from 'vue'

export interface MissionWizardData {
  // Step 1: Basic Info
  name: string
  type: string
  description: string

  // Step 2: Zone Selection
  selectedZones: string[]

  // Step 3: Schedule
  scheduleType: 'immediate' | 'later' | 'recurring'
  scheduledDate?: string
  scheduledTime?: string
  recurringPattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurringDays?: number[]
  recurringTime?: string
}

export function useMissionWizard() {
  const currentStep = ref(1)
  const totalSteps = 3

  const missionData = ref<MissionWizardData>({
    name: '',
    type: 'mowing',
    description: '',
    selectedZones: [],
    scheduleType: 'immediate'
  })

  // Draft management
  const DRAFT_KEY = 'yardrover_mission_draft'

  const canGoNext = computed(() => {
    switch (currentStep.value) {
      case 1:
        return !!missionData.value.name.trim()
      case 2:
        return missionData.value.selectedZones.length > 0
      case 3:
        return validateSchedule()
      default:
        return false
    }
  })

  const canGoPrevious = computed(() => {
    return currentStep.value > 1
  })

  const isFirstStep = computed(() => currentStep.value === 1)
  const isLastStep = computed(() => currentStep.value === totalSteps)

  const stepTitles = [
    'Mission Details',
    'Select Zones',
    'Schedule & Configure'
  ]

  const validateSchedule = () => {
    if (missionData.value.scheduleType === 'immediate') {
      return true
    }

    if (missionData.value.scheduleType === 'later') {
      return !!(missionData.value.scheduledDate && missionData.value.scheduledTime)
    }

    if (missionData.value.scheduleType === 'recurring') {
      return !!(
        missionData.value.recurringPattern &&
        missionData.value.recurringTime &&
        (missionData.value.recurringPattern !== 'weekly' || missionData.value.recurringDays?.length)
      )
    }

    return false
  }

  const nextStep = () => {
    if (canGoNext.value && currentStep.value < totalSteps) {
      currentStep.value++
      saveDraft()
    }
  }

  const previousStep = () => {
    if (canGoPrevious.value) {
      currentStep.value--
    }
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      currentStep.value = step
    }
  }

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(missionData.value))
    } catch (error) {
      console.error('Failed to save mission draft:', error)
    }
  }

  const loadDraft = () => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        missionData.value = JSON.parse(draft)
        return true
      }
    } catch (error) {
      console.error('Failed to load mission draft:', error)
    }
    return false
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch (error) {
      console.error('Failed to clear mission draft:', error)
    }
  }

  const reset = () => {
    currentStep.value = 1
    missionData.value = {
      name: '',
      type: 'mowing',
      description: '',
      selectedZones: [],
      scheduleType: 'immediate'
    }
    clearDraft()
  }

  const updateMissionData = (updates: Partial<MissionWizardData>) => {
    missionData.value = { ...missionData.value, ...updates }
    saveDraft()
  }

  const getMissionSummary = () => {
    return {
      ...missionData.value,
      totalZones: missionData.value.selectedZones.length
    }
  }

  return {
    currentStep,
    totalSteps,
    missionData,
    stepTitles,
    canGoNext,
    canGoPrevious,
    isFirstStep,
    isLastStep,
    nextStep,
    previousStep,
    goToStep,
    saveDraft,
    loadDraft,
    clearDraft,
    reset,
    updateMissionData,
    getMissionSummary
  }
}
