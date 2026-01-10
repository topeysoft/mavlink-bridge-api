import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Mission } from '@/types'
import type { MissionManager, SyncStatus } from '@client'
import { useConnectionStore } from './connection'

export const useMissionsStore = defineStore('missions', () => {
  const connectionStore = useConnectionStore()

  const missions = ref<Mission[]>([])
  const currentEditingMission = ref<Mission | null>(null)
  const selectedMissions = ref<string[]>([])
  const syncStatus = ref<SyncStatus>({
    status: 'offline',
    lastSync: 0,
    pendingChanges: 0
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Get mission manager from connection store
  const missionManager = computed(() => connectionStore.client?.missions as MissionManager | undefined)

  // Watch for connection and load missions
  watch(() => connectionStore.isConnected, async (connected) => {
    if (connected && missionManager.value) {
      await loadMissions()
      // Update sync status periodically
      const interval = setInterval(updateSyncStatus, 1000)
      // Clean up on disconnect
      watch(() => connectionStore.isConnected, (stillConnected) => {
        if (!stillConnected) {
          clearInterval(interval)
        }
      })
    } else {
      missions.value = []
      syncStatus.value = {
        status: 'offline',
        lastSync: 0,
        pendingChanges: 0
      }
    }
  }, { immediate: true })

  // Computed getters
  const getMissionById = computed(() => (id: string) => {
    return missions.value.find(m => m.id === id)
  })

  const enabledMissions = computed(() => missions.value.filter(m => m.enabled))
  const disabledMissions = computed(() => missions.value.filter(m => !m.enabled))

  const missionsByType = computed(() => ({
    once: missions.value.filter(m => m.type === 'once'),
    daily: missions.value.filter(m => m.type === 'daily'),
    weekly: missions.value.filter(m => m.type === 'weekly'),
    monthly: missions.value.filter(m => m.type === 'monthly')
  }))

  const missionsByPriority = computed(() => ({
    low: missions.value.filter(m => m.priority === 'low'),
    normal: missions.value.filter(m => m.priority === 'normal'),
    high: missions.value.filter(m => m.priority === 'high'),
    critical: missions.value.filter(m => m.priority === 'critical')
  }))

  // CRUD operations
  async function loadMissions() {
    if (!missionManager.value) {
      error.value = 'Mission manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      missions.value = await missionManager.value.getAll()
      updateSyncStatus()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load missions'
      console.error('Failed to load missions:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addMission(mission: Mission) {
    if (!missionManager.value) {
      error.value = 'Mission manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await missionManager.value.create(mission)
      await loadMissions()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add mission'
      console.error('Failed to add mission:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateMission(id: string, updates: Partial<Mission>) {
    if (!missionManager.value) {
      error.value = 'Mission manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await missionManager.value.update(id, updates)
      await loadMissions()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update mission'
      console.error('Failed to update mission:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteMission(id: string) {
    if (!missionManager.value) {
      error.value = 'Mission manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await missionManager.value.delete(id)
      await loadMissions()  // Refresh list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete mission'
      console.error('Failed to delete mission:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function syncWithServer() {
    if (!missionManager.value) {
      error.value = 'Mission manager not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await missionManager.value.sync()
      await loadMissions()
      updateSyncStatus()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync missions'
      console.error('Failed to sync missions:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function updateSyncStatus() {
    if (missionManager.value) {
      syncStatus.value = missionManager.value.getSyncStatus()
    }
  }

  // Helper methods using MissionManager
  async function getMissionsForDate(date: Date): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getMissionsForDate(date)
  }

  async function getMissionsUsingZone(zoneId: string): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getMissionsUsingZone(zoneId)
  }

  async function getUpcomingMissions(days: number = 7): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getUpcomingMissions(days)
  }

  async function getEnabledMissions(): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getEnabledMissions()
  }

  async function getMissionsByType(type: 'once' | 'daily' | 'weekly' | 'monthly'): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getByType(type)
  }

  async function getMissionsByPriority(priority: 'low' | 'normal' | 'high' | 'critical'): Promise<Mission[]> {
    if (!missionManager.value) return []
    return await missionManager.value.getByPriority(priority)
  }

  // UI state management
  function setEditingMission(mission: Mission | null) {
    currentEditingMission.value = mission
  }

  function toggleMissionSelection(id: string) {
    const index = selectedMissions.value.indexOf(id)
    if (index === -1) {
      selectedMissions.value.push(id)
    } else {
      selectedMissions.value.splice(index, 1)
    }
  }

  function clearSelection() {
    selectedMissions.value = []
  }

  return {
    missions,
    currentEditingMission,
    selectedMissions,
    syncStatus,
    isLoading,
    error,
    getMissionById,
    enabledMissions,
    disabledMissions,
    missionsByType,
    missionsByPriority,
    addMission,
    updateMission,
    deleteMission,
    syncWithServer,
    getMissionsForDate,
    getMissionsUsingZone,
    getUpcomingMissions,
    getEnabledMissions,
    getMissionsByType,
    getMissionsByPriority,
    setEditingMission,
    toggleMissionSelection,
    clearSelection
  }
})
