import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Zone } from '@/types'
import type { ZoneManager, SyncStatus } from '@client'
import { useConnectionStore } from './connection'

export const useZonesStore = defineStore('zones', () => {
  const connectionStore = useConnectionStore()

  const zones = ref<Zone[]>([])
  const currentEditingZone = ref<Zone | null>(null)
  const selectedZones = ref<string[]>([])
  const syncStatus = ref<SyncStatus>({
    status: 'offline',
    lastSync: 0,
    pendingChanges: 0
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Get zone manager from connection store
  const zoneManager = computed(() => connectionStore.client?.zones as ZoneManager | undefined)

  // Watch for connection and load zones
  watch(() => connectionStore.isConnected, async (connected) => {
    if (connected && zoneManager.value) {
      await loadZones()
      // Update sync status periodically
      const interval = setInterval(updateSyncStatus, 1000)
      // Clean up on disconnect
      watch(() => connectionStore.isConnected, (stillConnected) => {
        if (!stillConnected) {
          clearInterval(interval)
        }
      })
    } else {
      zones.value = []
      syncStatus.value = {
        status: 'offline',
        lastSync: 0,
        pendingChanges: 0
      }
    }
  }, { immediate: true })

  function getZoneById(id: string) {
    return zones.value.find(z => z.id === id)
  }

  // Zone type filters
  const mowingZones = computed(() => zones.value.filter(z => z.type === 'mowing'))
  const exclusionZones = computed(() => zones.value.filter(z => z.type === 'exclusion'))
  const chargingZones = computed(() => zones.value.filter(z => z.type === 'charging'))
  const patrolZones = computed(() => zones.value.filter(z => z.type === 'patrol'))
  const snowClearingZones = computed(() => zones.value.filter(z => z.type === 'snow_clearing'))
  const stagingZones = computed(() => zones.value.filter(z => z.type === 'staging'))
  const sprayingZones = computed(() => zones.value.filter(z => z.type === 'spraying'))
  const wateringZones = computed(() => zones.value.filter(z => z.type === 'watering'))
  const collectionZones = computed(() => zones.value.filter(z => z.type === 'collection'))
  const monitoringZones = computed(() => zones.value.filter(z => z.type === 'monitoring'))

  async function loadZones() {
    if (!zoneManager.value) {
      error.value = 'Zone manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      zones.value = await zoneManager.value.getAll()
      updateSyncStatus()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load zones'
      console.error('Failed to load zones:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addZone(zone: Zone) {
    if (!zoneManager.value) {
      error.value = 'Zone manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await zoneManager.value.create(zone)
      await loadZones()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add zone'
      console.error('Failed to add zone:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateZone(id: string, updates: Partial<Zone>) {
    if (!zoneManager.value) {
      error.value = 'Zone manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await zoneManager.value.update(id, updates)
      await loadZones()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update zone'
      console.error('Failed to update zone:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteZone(id: string) {
    if (!zoneManager.value) {
      error.value = 'Zone manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await zoneManager.value.delete(id)
      await loadZones()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete zone'
      console.error('Failed to delete zone:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function syncWithServer() {
    if (!zoneManager.value) {
      error.value = 'Zone manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await zoneManager.value.sync()
      await loadZones()
      updateSyncStatus()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync zones'
      console.error('Failed to sync zones:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function updateSyncStatus() {
    if (zoneManager.value) {
      syncStatus.value = zoneManager.value.getSyncStatus()
    }
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

  return {
    zones,
    currentEditingZone,
    selectedZones,
    syncStatus,
    isLoading,
    error,
    getZoneById,
    // Zone type filters
    mowingZones,
    exclusionZones,
    chargingZones,
    patrolZones,
    snowClearingZones,
    stagingZones,
    sprayingZones,
    wateringZones,
    collectionZones,
    monitoringZones,
    // Actions
    addZone,
    updateZone,
    deleteZone,
    syncWithServer,
    setEditingZone,
    toggleZoneSelection,
    clearSelection
  }
})
