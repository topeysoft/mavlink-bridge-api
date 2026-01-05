import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Zone } from '@/types'

export const useZonesStore = defineStore('zones', () => {
  const zones = ref<Zone[]>(JSON.parse(localStorage.getItem('yardrover_zones') || '[]'))
  const currentEditingZone = ref<Zone | null>(null)
  const selectedZones = ref<string[]>([])

  const getZoneById = computed(() => (id: string) => {
    return zones.value.find(z => z.id === id)
  })

  const mowingZones = computed(() => zones.value.filter(z => z.type === 'mowing'))
  const exclusionZones = computed(() => zones.value.filter(z => z.type === 'exclusion'))
  const chargingZones = computed(() => zones.value.filter(z => z.type === 'charging'))

  function addZone(zone: Zone) {
    zones.value.push(zone)
    saveZones()
  }

  function updateZone(id: string, updates: Partial<Zone>) {
    const index = zones.value.findIndex(z => z.id === id)
    if (index !== -1) {
      zones.value[index] = { ...zones.value[index], ...updates, lastModified: new Date().toISOString() }
      saveZones()
    }
  }

  function deleteZone(id: string) {
    zones.value = zones.value.filter(z => z.id !== id)
    saveZones()
  }

  function setEditingZone(zone: Zone | null) {
    currentEditingZone.value = zone
  }

  function toggleZoneSelection(id: string) {
    const index = selectedZones.value.indexOf(id)
    if (index === -1) {
      selectedZones.value.push(id)
    } else {
      selectedZones.value.splice(index, 1)
    }
  }

  function clearSelection() {
    selectedZones.value = []
  }

  function saveZones() {
    localStorage.setItem('yardrover_zones', JSON.stringify(zones.value))
  }

  return {
    zones,
    currentEditingZone,
    selectedZones,
    getZoneById,
    mowingZones,
    exclusionZones,
    chargingZones,
    addZone,
    updateZone,
    deleteZone,
    setEditingZone,
    toggleZoneSelection,
    clearSelection
  }
})
