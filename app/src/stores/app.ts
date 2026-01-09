/**
 * Global app state store
 * Tracks app-wide initialization and loading states
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  // State
  const isInitializing = ref(true)
  const initializationComplete = ref(false)

  // Actions
  function setInitializing(value: boolean) {
    isInitializing.value = value
    if (!value) {
      initializationComplete.value = true
    }
  }

  function reset() {
    isInitializing.value = true
    initializationComplete.value = false
  }

  return {
    // State
    isInitializing,
    initializationComplete,

    // Actions
    setInitializing,
    reset,
  }
})
