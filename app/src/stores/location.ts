/**
 * Location Store - Manages home location for the YardRover
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HomeLocation {
  lat: number
  lng: number
  address: string
  accuracy?: number
  lastUpdated: string
}

export const useLocationStore = defineStore('location', () => {
  const STORAGE_KEY = 'yardrover_home_location'

  // State
  const homeLocation = ref<HomeLocation | null>(null)

  // Computed
  const hasHomeLocation = computed(() => homeLocation.value !== null)

  const homeCoordinates = computed(() => {
    if (!homeLocation.value) return null
    return {
      lat: homeLocation.value.lat,
      lng: homeLocation.value.lng
    }
  })

  const formattedCoordinates = computed(() => {
    if (!homeLocation.value) return null
    return `${homeLocation.value.lat.toFixed(6)}, ${homeLocation.value.lng.toFixed(6)}`
  })

  const formattedAddress = computed(() => {
    return homeLocation.value?.address || 'Not set'
  })

  // Actions
  const setHomeLocation = (location: HomeLocation) => {
    homeLocation.value = {
      ...location,
      lastUpdated: new Date().toISOString()
    }
    saveToStorage()
  }

  const updateHomeLocation = (updates: Partial<HomeLocation>) => {
    if (!homeLocation.value) return

    homeLocation.value = {
      ...homeLocation.value,
      ...updates,
      lastUpdated: new Date().toISOString()
    }
    saveToStorage()
  }

  const clearHomeLocation = () => {
    homeLocation.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  const saveToStorage = () => {
    if (homeLocation.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(homeLocation.value))
    }
  }

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        homeLocation.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load home location from storage:', error)
    }
  }

  // Initialize from storage
  loadFromStorage()

  return {
    // State
    homeLocation,

    // Computed
    hasHomeLocation,
    homeCoordinates,
    formattedCoordinates,
    formattedAddress,

    // Actions
    setHomeLocation,
    updateHomeLocation,
    clearHomeLocation,
    loadFromStorage
  }
})
