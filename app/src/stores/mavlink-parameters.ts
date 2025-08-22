import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

// Type for the MAVLink client with parameters
interface MAVLinkClientWithParams {
  parameters: {
    requestParameterList(): Promise<void>
    getAllCachedParameters(): Array<{ name: string; value: number; type: string }>
    setParameter(name: string, value: number): Promise<void>
    getParameterFromCache(name: string): { value: number; type: string } | undefined
    requestParameter(name: string): Promise<void>
    waitForParameter(name: string): Promise<{ value: number; type: string }>
    startParameterStream(): Promise<void>
    stopParameterStream(): void
    addParameterListener(listener: (event: ParameterChangeEvent) => void): void
    removeParameterListener(listener: (event: ParameterChangeEvent) => void): void
  }
}

// Parameter types for internal use
interface ParameterChangeEvent {
  type: 'parameter_changed' | 'parameter_added' | 'parameter_removed'
  parameterName: string
  oldValue?: number
  newValue?: number
  timestamp: number
}

export interface MAVLinkParameter {
  value: number
  type: string
  description?: string | undefined
  units?: string | undefined
  range?: { min: number; max: number } | undefined
  defaultValue?: number | undefined
  values?: Record<string, string> | undefined
}

export interface ParameterListItem extends MAVLinkParameter {
  name: string
  modified: boolean
}

export const useMAVLinkParametersStore = defineStore('mavlink-parameters', () => {
  // State
  const parameters = ref(createAsyncState<Record<string, MAVLinkParameter>>())
  const filter = ref('')
  const modifiedParameters = ref(new Set<string>())
  const streamActive = ref<boolean>(false)
  const isRefreshing = ref(false)

  // Getters (computed)
  const parameterList = computed((): ParameterListItem[] => {
    const params = parameters.value.data
    if (!params) return []
    
    return Object.entries(params)
      .filter(([name]) => 
        name.toLowerCase().includes(filter.value.toLowerCase())
      )
      .map(([name, param]) => ({
        name,
        ...param,
        modified: modifiedParameters.value.has(name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
  
  const parameterCount = computed(() => 
    Object.keys(parameters.value.data || {}).length
  )
  
  const modifiedCount = computed(() => modifiedParameters.value.size)
  
  const filteredCount = computed(() => {
    if (!filter.value) return parameterCount.value
    const params = parameters.value.data
    if (!params) return 0
    
    return Object.keys(params).filter(name =>
      name.toLowerCase().includes(filter.value.toLowerCase())
    ).length
  })
  
  const getParameter = computed(() => (name: string): MAVLinkParameter | null => {
    return parameters.value.data?.[name] || null
  })
  
  const hasModifications = computed(() => modifiedParameters.value.size > 0)

  // Actions
  async function fetchParameters() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    isRefreshing.value = true
    setAsyncLoading(parameters.value)
    
    try {
      // Request parameter list from flight controller
      await (client.value as unknown as MAVLinkClientWithParams).parameters.requestParameterList()
      
      // Get cached parameters from client
      const cachedParams = (client.value as unknown as MAVLinkClientWithParams).parameters.getAllCachedParameters()
      
      // Convert to our store format
      const storeParams: Record<string, MAVLinkParameter> = {}
      cachedParams.forEach((param) => {
        storeParams[param.name] = {
          value: param.value,
          type: param.type,
          description: undefined // Will be populated from parameter definitions
        }
      })
      
      setAsyncData(parameters.value, storeParams)
      // Clear modified flags after successful fetch
      modifiedParameters.value.clear()
    } catch (error) {
      const storeError = createStoreError(
        'PARAM_FETCH_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch parameters',
        error
      )
      setAsyncError(parameters.value, storeError)
      throw error
    } finally {
      isRefreshing.value = false
    }
  }

  async function setParameter(name: string, value: number) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // Set parameter via MAVLink client
      await (client.value as unknown as MAVLinkClientWithParams).parameters.setParameter(name, value)
      
      // Mark as modified
      modifiedParameters.value.add(name)
      
      // Update local state immediately
      if (parameters.value.data && parameters.value.data[name]) {
        parameters.value.data[name].value = value
        parameters.value.lastUpdated = Date.now()
      }
    } catch (error) {
      throw new Error(`Failed to set parameter ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function getParameterValue(name: string): Promise<MAVLinkParameter | null> {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // Try to get from cache first
      const cached = (client.value as unknown as MAVLinkClientWithParams).parameters.getParameterFromCache(name)
      if (cached) {
        return {
          value: cached.value,
          type: cached.type,
          description: undefined
        }
      }
      
      // Request parameter if not in cache
      await (client.value as unknown as MAVLinkClientWithParams).parameters.requestParameter(name)
      
      // Wait for parameter and get from cache
      const param = await (client.value as unknown as MAVLinkClientWithParams).parameters.waitForParameter(name)
      return {
        value: param.value,
        type: param.type,
        description: undefined
      }
    } catch (error) {
      console.error(`Failed to get parameter ${name}:`, error)
      return null
    }
  }

  async function startParameterStream() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      await (client.value as unknown as MAVLinkClientWithParams).parameters.startParameterStream()
      // Update stream status
      streamActive.value = true as boolean
      
      // Set up parameter change listener
      (client.value as unknown as MAVLinkClientWithParams).parameters.addParameterListener(handleParameterChange)
    } catch (error) {
      throw new Error(`Failed to start parameter stream: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function stopParameterStream() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      (client.value as unknown as MAVLinkClientWithParams).parameters.stopParameterStream()
      // Update stream status
      streamActive.value = false as boolean
      
      // Remove parameter change listener
      (client.value as unknown as MAVLinkClientWithParams).parameters.removeParameterListener(handleParameterChange)
    } catch (error) {
      throw new Error(`Failed to stop parameter stream: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function setFilter(newFilter: string) {
    filter.value = newFilter
  }

  function clearFilter() {
    filter.value = ''
  }

  function markParameterModified(name: string) {
    modifiedParameters.value.add(name)
  }

  function clearModifiedFlag(name: string) {
    modifiedParameters.value.delete(name)
  }

  function clearAllModifiedFlags() {
    modifiedParameters.value.clear()
  }

  function handleParameterChange(event: ParameterChangeEvent) {
    if (event.type === 'parameter_changed' && event.newValue !== undefined) {
      // Update local cache
      if (parameters.value.data) {
        if (!parameters.value.data[event.parameterName]) {
          parameters.value.data[event.parameterName] = {
            value: event.newValue,
            type: 'float',
            description: undefined
          }
        } else {
          const param = parameters.value.data[event.parameterName]
          if (param) {
            param.value = event.newValue
          }
        }
        parameters.value.lastUpdated = Date.now()
      }
    }
  }

  function handleParameterUpdate(param: MAVLinkParameter & { name: string }) {
    if (!parameters.value.data) {
      parameters.value.data = {}
    }
    
    parameters.value.data[param.name] = param
    parameters.value.lastUpdated = Date.now()
  }

  function setupWebSocketHandlers() {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // WebSocket handlers are set up in startParameterStream
  }

  function refreshParameters() {
    void fetchParameters()
  }

  function saveParameters() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    // Mock saving parameters
    clearAllModifiedFlags()
  }

  function loadParameters() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    // Mock loading parameters
    void fetchParameters()
  }

  function clearErrors() {
    parameters.value.error = null
  }

  // Additional functions for parameter management
  function resetParameter(name: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // Get the default value for the parameter (would need parameter definitions)
      // For now, we'll just remove the modified flag
      modifiedParameters.value.delete(name)
      
      // In a real implementation, this would reset to the default value
      // await client.value.mavlink.parameters.setParameter(name, defaultValue)
    } catch (error) {
      throw new Error(`Failed to reset parameter ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function importParameters(parameters: Record<string, number>) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // Set parameters one by one
      for (const [name, value] of Object.entries(parameters)) {
        await setParameter(name, value)
      }
    } catch (error) {
      throw new Error(`Failed to import parameters: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function exportParameters(): string {
    const params = parameters.value.data || {}
    return Object.entries(params)
      .map(([name, param]) => `${name},${param.value}`)
      .join('\n')
  }

  function getFilteredParameters(filter: string): Record<string, MAVLinkParameter> {
    const params = parameters.value.data || {}
    
    switch (filter) {
      case 'modified':
        return Object.fromEntries(
          Object.entries(params).filter(([name]) => 
            modifiedParameters.value.has(name)
          )
        )
      case 'non-default':
        return Object.fromEntries(
          Object.entries(params).filter(([, param]) => 
            param.defaultValue !== undefined && param.value !== param.defaultValue
          )
        )
      default:
        return params
    }
  }

  async function writeAllParameters() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    try {
      // Write all modified parameters
      const modifiedParams = getFilteredParameters('modified')
      
      for (const [name, param] of Object.entries(modifiedParams)) {
        await (client.value as unknown as MAVLinkClientWithParams).parameters.setParameter(name, param.value)
      }
      
      // Clear modified flags after successful write
      modifiedParameters.value.clear()
    } catch (error) {
      throw new Error(`Failed to write parameters: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    // State
    parameters,
    filter,
    modifiedParameters,
    streamActive,
    isRefreshing,
    
    // Getters
    parameterList,
    parameterCount,
    modifiedCount,
    filteredCount,
    getParameter,
    hasModifications,
    
    // Actions
    fetchParameters,
    setParameter,
    getParameterValue,
    startParameterStream,
    stopParameterStream,
    setFilter,
    clearFilter,
    markParameterModified,
    clearModifiedFlag,
    clearAllModifiedFlags,
    handleParameterUpdate,
    setupWebSocketHandlers,
    refreshParameters,
    saveParameters,
    loadParameters,
    clearErrors,
    resetParameter,
    importParameters,
    exportParameters,
    getFilteredParameters,
    writeAllParameters
  }
})