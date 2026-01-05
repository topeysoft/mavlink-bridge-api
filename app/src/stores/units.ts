import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type UnitSystem = 'metric' | 'imperial'

export const useUnitsStore = defineStore('units', () => {
  // State
  const system = ref<UnitSystem>('metric')

  // Load from localStorage
  const savedSystem = localStorage.getItem('yardrover-unit-system')
  if (savedSystem === 'metric' || savedSystem === 'imperial') {
    system.value = savedSystem
  }

  // Getters
  const isMetric = computed(() => system.value === 'metric')
  const isImperial = computed(() => system.value === 'imperial')

  // Actions
  function setSystem(newSystem: UnitSystem) {
    system.value = newSystem
    localStorage.setItem('yardrover-unit-system', newSystem)
  }

  function toggleSystem() {
    setSystem(system.value === 'metric' ? 'imperial' : 'metric')
  }

  // Conversion utilities
  function convertArea(acres: number): { value: number; unit: string } {
    if (system.value === 'metric') {
      const hectares = acres * 0.404686
      return { value: hectares, unit: 'ha' }
    }
    return { value: acres, unit: 'acres' }
  }

  function formatArea(acres: number, decimals: number = 2): string {
    const { value, unit } = convertArea(acres)
    return `${value.toFixed(decimals)} ${unit}`
  }

  function convertDistance(meters: number): { value: number; unit: string } {
    if (system.value === 'imperial') {
      const feet = meters * 3.28084
      if (feet > 5280) {
        return { value: feet / 5280, unit: 'mi' }
      }
      return { value: feet, unit: 'ft' }
    }
    if (meters > 1000) {
      return { value: meters / 1000, unit: 'km' }
    }
    return { value: meters, unit: 'm' }
  }

  function formatDistance(meters: number, decimals: number = 2): string {
    const { value, unit } = convertDistance(meters)
    return `${value.toFixed(decimals)} ${unit}`
  }

  function convertSpeed(metersPerSecond: number): { value: number; unit: string } {
    if (system.value === 'imperial') {
      const mph = metersPerSecond * 2.23694
      return { value: mph, unit: 'mph' }
    }
    const kmh = metersPerSecond * 3.6
    return { value: kmh, unit: 'km/h' }
  }

  function formatSpeed(metersPerSecond: number, decimals: number = 1): string {
    const { value, unit } = convertSpeed(metersPerSecond)
    return `${value.toFixed(decimals)} ${unit}`
  }

  function convertTemperature(celsius: number): { value: number; unit: string } {
    if (system.value === 'imperial') {
      const fahrenheit = (celsius * 9/5) + 32
      return { value: fahrenheit, unit: '°F' }
    }
    return { value: celsius, unit: '°C' }
  }

  function formatTemperature(celsius: number, decimals: number = 1): string {
    const { value, unit } = convertTemperature(celsius)
    return `${value.toFixed(decimals)}${unit}`
  }

  return {
    // State
    system,
    isMetric,
    isImperial,

    // Actions
    setSystem,
    toggleSystem,

    // Utilities
    convertArea,
    formatArea,
    convertDistance,
    formatDistance,
    convertSpeed,
    formatSpeed,
    convertTemperature,
    formatTemperature
  }
})
