import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import type { Configuration } from '@mavlinkbridge/api-client'
import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

export const useConfigurationStore = defineStore('configuration', () => {
  // State
  const config = ref(createAsyncState<Configuration>())
  const isDirty = ref(false)
  const validationErrors = ref<string[]>([])
  const isValidating = ref(false)

  // Getters (computed)
  const deviceConfig = computed(() => config.value.data?.device)
  const connectionConfig = computed(() => config.value.data?.connection)
  const wifiConfig = computed(() => config.value.data?.connection?.wifi)
  const rtcmConfig = computed(() => config.value.data?.rtcm)
  
  const isValid = computed(() => validationErrors.value.length === 0)
  const hasUnsavedChanges = computed(() => isDirty.value)
  
  const configSummary = computed(() => {
    if (!config.value.data) return null
    return {
      deviceName: config.value.data.device?.name || 'Unknown',
      connectionType: config.value.data.connection?.type || 'unknown',
      rtcmEnabled: config.value.data.rtcm?.enabled || false
    }
  })

  // Actions
  async function fetchConfiguration() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    setAsyncLoading(config.value)
    
    try {
      const response = await client.value.getConfiguration()
      setAsyncData(config.value, response)
      isDirty.value = false
      validationErrors.value = []
    } catch (error) {
      const storeError = createStoreError(
        'CONFIG_FETCH_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch configuration',
        error
      )
      setAsyncError(config.value, storeError)
      throw error
    }
  }

  async function updateConfiguration(configUpdate: Partial<Configuration>) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    // Validate before updating
    if (!validateConfiguration(configUpdate)) {
      throw new Error('Configuration validation failed')
    }
    
    setAsyncLoading(config.value)
    
    try {
      const mergedConfig: Configuration = {
        version: config.value.data?.version || 1,
        device: config.value.data?.device || { name: '', mode: 'usb_otg' },
        connection: config.value.data?.connection || { type: 'wifi', wifi: { ssid: '', autoConnect: false } },
        rtcm: config.value.data?.rtcm || { enabled: false, source: { type: 'ntrip', host: '', port: 2101 } },
        ...configUpdate
      }
      
      await client.value.setConfiguration(mergedConfig)
      await fetchConfiguration()
    } catch (error) {
      const storeError = createStoreError(
        'CONFIG_UPDATE_ERROR',
        error instanceof Error ? error.message : 'Failed to update configuration',
        error
      )
      setAsyncError(config.value, storeError)
      throw error
    }
  }

  function validateConfiguration(configToValidate: Partial<Configuration>): boolean {
    validationErrors.value = []
    
    // Device validation
    if (configToValidate.device) {
      if (configToValidate.device.name && configToValidate.device.name.length < 3) {
        validationErrors.value.push('Device name must be at least 3 characters')
      }
      if (configToValidate.device.name && configToValidate.device.name.length > 32) {
        validationErrors.value.push('Device name must be 32 characters or less')
      }
      if (configToValidate.device.name && !/^[a-zA-Z0-9_-]+$/.test(configToValidate.device.name)) {
        validationErrors.value.push('Device name can only contain letters, numbers, hyphens, and underscores')
      }
    }
    
    // Connection validation
    if (configToValidate.connection) {
      if (configToValidate.connection.type && !['wifi', 'ethernet'].includes(configToValidate.connection.type)) {
        validationErrors.value.push('Invalid connection type')
      }
    }
    
    // RTCM validation
    if (configToValidate.rtcm) {
      if (configToValidate.rtcm.enabled && (!configToValidate.rtcm.source || !configToValidate.rtcm.source.type)) {
        validationErrors.value.push('RTCM source is required when RTCM is enabled')
      }
      if (configToValidate.rtcm.source?.type === 'ntrip') {
        if (!configToValidate.rtcm.source.host) {
          validationErrors.value.push('NTRIP host is required')
        }
        if (!configToValidate.rtcm.source.port || configToValidate.rtcm.source.port < 1 || configToValidate.rtcm.source.port > 65535) {
          validationErrors.value.push('Valid NTRIP port is required (1-65535)')
        }
      }
    }
    
    return validationErrors.value.length === 0
  }

  function markDirty() {
    isDirty.value = true
  }

  function markClean() {
    isDirty.value = false
  }

  function clearValidationErrors() {
    validationErrors.value = []
  }

  function handleConfigUpdate(configUpdate: Configuration) {
    setAsyncData(config.value, configUpdate)
    isDirty.value = false
  }

  function setupWebSocketHandlers() {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // Configuration change events would be handled here if available
  }

  async function resetToDefaults() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    setAsyncLoading(config.value)
    
    try {
      await client.value.resetConfiguration()
      await fetchConfiguration()
    } catch (error) {
      const storeError = createStoreError(
        'CONFIG_RESET_ERROR',
        error instanceof Error ? error.message : 'Failed to reset configuration',
        error
      )
      setAsyncError(config.value, storeError)
      throw error
    }
  }

  async function factoryReset() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    await client.value.resetConfiguration()
    // Device will restart, connection will be lost
  }

  function exportConfiguration(): string {
    if (!config.value.data) {
      throw new Error('No configuration data available')
    }
    
    return JSON.stringify(config.value.data, null, 2)
  }

  async function importConfiguration(configJson: string) {
    const configUpdate = JSON.parse(configJson) as Configuration
    await updateConfiguration(configUpdate)
  }

  return {
    // State
    config,
    isDirty,
    validationErrors,
    isValidating,
    
    // Getters
    deviceConfig,
    connectionConfig,
    wifiConfig,
    rtcmConfig,
    isValid,
    hasUnsavedChanges,
    configSummary,
    
    // Actions
    fetchConfiguration,
    updateConfiguration,
    validateConfiguration,
    markDirty,
    markClean,
    clearValidationErrors,
    handleConfigUpdate,
    setupWebSocketHandlers,
    resetToDefaults,
    factoryReset,
    exportConfiguration,
    importConfiguration
  }
})