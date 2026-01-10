import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import type {
  Parameter,
  ParameterGroup,
  ParameterSet,
  ParameterFilter,
  ParameterValidation,
  ParameterType,
} from '@/types/parameter'
import { ParameterType as ParamType } from '@/types/parameter'
import type {
  ParameterValue,
  ParameterChangeEvent,
  ParameterDefinition,
} from '@client'
import { PARAMETER_DEFINITIONS, getParameterDefinition } from '@client/mavlink/parameters/ParameterDefinitions'

export const useParametersStore = defineStore('parameters', () => {
  // State
  const parameters = ref<Parameter[]>([])
  const parameterGroups = ref<ParameterGroup[]>([])
  const parameterSets = ref<ParameterSet[]>(
    JSON.parse(localStorage.getItem('yardrover_parameter_sets') || '[]')
  )
  const currentParameterSet = ref<ParameterSet | null>(null)
  const isLoadingParameters = ref(false)
  const isSavingParameters = ref(false)
  const lastSync = ref<string | null>(null)
  const isStreamingActive = ref(false)

  const filter = ref<ParameterFilter>({
    search: '',
    group: undefined,
    modifiedOnly: false,
    showAdvanced: false,
  })

  const connectionStore = useConnectionStore()

  // Watch for connection changes and manage parameter streaming
  // TODO: Re-enable once firmware is updated with parameter stream endpoint
  // watch(
  //   () => connectionStore.isConnected,
  //   async (connected) => {
  //     if (connected) {
  //       await startParameterStreaming()
  //     } else {
  //       stopParameterStreaming()
  //     }
  //   }
  // )

  // Computed
  const modifiedParameters = computed(() => parameters.value.filter(p => p.modified))

  const filteredParameters = computed(() => {
    let filtered = [...parameters.value]

    // Apply search filter
    if (filter.value.search) {
      const searchLower = filter.value.search.toLowerCase()
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.displayName.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      )
    }

    // Apply group filter
    if (filter.value.group) {
      filtered = filtered.filter(p => p.group === filter.value.group)
    }

    // Apply modified filter
    if (filter.value.modifiedOnly) {
      filtered = filtered.filter(p => p.modified)
    }

    // Apply advanced filter
    if (!filter.value.showAdvanced) {
      filtered = filtered.filter(p => !p.name.startsWith('_'))
    }

    return filtered
  })

  const filteredGroups = computed(() => {
    const groups: ParameterGroup[] = []
    const filtered = filteredParameters.value

    // Group parameters
    const groupMap = new Map<string, Parameter[]>()
    filtered.forEach(param => {
      if (!groupMap.has(param.group)) {
        groupMap.set(param.group, [])
      }
      groupMap.get(param.group)!.push(param)
    })

    // Create group objects
    groupMap.forEach((params, groupName) => {
      const groupInfo = getGroupInfo(groupName)
      groups.push({
        name: groupName,
        displayName: groupInfo.displayName,
        description: groupInfo.description,
        icon: groupInfo.icon,
        parameters: params.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      })
    })

    return groups.sort((a, b) => a.displayName.localeCompare(b.displayName))
  })

  const parameterCount = computed(() => parameters.value.length)
  const modifiedCount = computed(() => modifiedParameters.value.length)

  // Helper function to get group display information
  function getGroupInfo(groupName: string): {
    displayName: string
    description: string
    icon: string
  } {
    const groupInfoMap: Record<
      string,
      { displayName: string; description: string; icon: string }
    > = {
      BASIC: {
        displayName: 'Basic Settings',
        description: 'Fundamental vehicle configuration',
        icon: 'settings',
      },
      NAVIGATION: {
        displayName: 'Navigation',
        description: 'Waypoint navigation and path following',
        icon: 'navigation',
      },
      CONTROL: {
        displayName: 'Control',
        description: 'Vehicle control and stabilization',
        icon: 'tune',
      },
      BATTERY: {
        displayName: 'Battery',
        description: 'Battery monitoring and failsafe',
        icon: 'battery_charging_full',
      },
      GPS: {
        displayName: 'GPS',
        description: 'GPS and positioning settings',
        icon: 'gps_fixed',
      },
      FENCE: {
        displayName: 'Geofence',
        description: 'Geofence boundary settings',
        icon: 'fence',
      },
      MOTOR: {
        displayName: 'Motors',
        description: 'Motor and propulsion configuration',
        icon: 'settings_power',
      },
      SAFETY: {
        displayName: 'Safety',
        description: 'Failsafe and safety features',
        icon: 'security',
      },
      TELEMETRY: {
        displayName: 'Telemetry',
        description: 'Communication and telemetry streams',
        icon: 'wifi_tethering',
      },
      SENSOR: {
        displayName: 'Sensors',
        description: 'Sensor calibration and configuration',
        icon: 'sensors',
      },
    }

    return (
      groupInfoMap[groupName] || {
        displayName: groupName,
        description: `${groupName} parameters`,
        icon: 'settings',
      }
    )
  }

  // Actions

  /**
   * Convert MAVLink parameter value to UI Parameter format with ArduPilot definitions
   */
  function convertMAVLinkParameter(paramValue: ParameterValue): Parameter {
    // Get parameter definition from ArduPilot metadata
    const definition = getParameterDefinition(paramValue.name)

    // Convert MAVLink parameter type to app ParameterType
    const convertType = (mavType: string): ParameterType => {
      switch (mavType.toLowerCase()) {
        case 'int':
          return ParamType.INT32
        case 'float':
          return ParamType.FLOAT
        default:
          return ParamType.FLOAT
      }
    }

    // Build parameter using definition metadata when available
    const param: Parameter = {
      name: paramValue.name,
      displayName: definition?.displayName || paramValue.name,
      value: paramValue.value,
      defaultValue: paramValue.value, // Will be the current value until we track defaults separately
      type: convertType(paramValue.type),
      group: definition?.category || definition?.group || 'MISC',
      description: definition?.description || `Parameter ${paramValue.name}`,
      units: definition?.units,
      min: definition?.range?.min,
      max: definition?.range?.max,
      increment: definition?.increment,
      readOnly: false, // MAVLink doesn't have readonly flag in parameter values
      rebootRequired: definition?.rebootRequired || false,
      modified: false
    }

    return param
  }

  // Load parameters from vehicle
  async function loadParametersFromVehicle(): Promise<boolean> {
    isLoadingParameters.value = true
    const connectionStore = useConnectionStore()

    try {
      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // First, request the parameter list from the flight controller
      console.log('Requesting parameter list from flight controller...')
      await client.parameters.requestParameterList()

      // Wait a moment for parameters to start streaming in
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Get all cached parameters that have been received
      const cachedParams = client.parameters.getAllCachedParameters()

      if (cachedParams.length === 0) {
        throw new Error('No parameters received from flight controller')
      }

      // Convert to UI parameter format
      parameters.value = cachedParams.map(convertMAVLinkParameter)

      lastSync.value = new Date().toISOString()

      console.log('✅ Loaded parameters from vehicle:', parameters.value.length)
      return true
    } catch (error) {
      console.error('❌ Failed to load parameters from vehicle:', error)
      throw error // Re-throw to let the UI handle the error properly
    } finally {
      isLoadingParameters.value = false
    }
  }

  // Save parameters to vehicle
  async function saveParametersToVehicle(params?: Parameter[]): Promise<boolean> {
    isSavingParameters.value = true
    const connectionStore = useConnectionStore()

    try {
      const paramsToSave = params || modifiedParameters.value

      if (paramsToSave.length === 0) {
        console.warn('No parameters to save')
        return true
      }

      // Validate parameters
      const validation = validateParameters(paramsToSave)
      if (!validation.valid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`)
      }

      if (!connectionStore.isConnected) {
        throw new Error('Not connected to device')
      }

      const client = connectionStore.getClient()

      // Save each modified parameter
      for (const param of paramsToSave) {
        await client.parameters.setParameter(param.name, param.value)
      }

      // Update local state
      paramsToSave.forEach(param => {
        const index = parameters.value.findIndex(p => p.name === param.name)
        if (index !== -1) {
          parameters.value[index].modified = false
        }
      })

      lastSync.value = new Date().toISOString()

      console.log('Saved parameters to vehicle:', paramsToSave)
      return true
    } catch (error) {
      console.error('Failed to save parameters to vehicle:', error)
      return false
    } finally {
      isSavingParameters.value = false
    }
  }

  // Update a single parameter
  function updateParameter(name: string, value: number) {
    const param = parameters.value.find(p => p.name === name)
    if (!param) {
      console.error('Parameter not found:', name)
      return
    }

    // Validate value
    if (param.min !== undefined && value < param.min) {
      console.warn(`Value ${value} below minimum ${param.min} for ${name}`)
      value = param.min
    }
    if (param.max !== undefined && value > param.max) {
      console.warn(`Value ${value} above maximum ${param.max} for ${name}`)
      value = param.max
    }

    // Update value
    param.value = value
    param.modified = value !== param.defaultValue
  }

  // Reset parameter to default
  function resetParameter(name: string) {
    const param = parameters.value.find(p => p.name === name)
    if (param) {
      param.value = param.defaultValue
      param.modified = false
    }
  }

  // Reset all parameters to defaults
  function resetAllParameters() {
    parameters.value.forEach(param => {
      param.value = param.defaultValue
      param.modified = false
    })
  }

  // Validate parameters
  function validateParameters(params: Parameter[]): ParameterValidation {
    const errors: string[] = []
    const warnings: string[] = []

    params.forEach(param => {
      // Check read-only
      if (param.readOnly && param.modified) {
        errors.push(`${param.displayName} is read-only`)
      }

      // Check range
      if (param.min !== undefined && param.value < param.min) {
        errors.push(`${param.displayName} value ${param.value} is below minimum ${param.min}`)
      }
      if (param.max !== undefined && param.value > param.max) {
        errors.push(`${param.displayName} value ${param.value} is above maximum ${param.max}`)
      }

      // Check reboot required
      if (param.rebootRequired && param.modified) {
        warnings.push(`${param.displayName} requires reboot to take effect`)
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  // Parameter Set Management

  // Save current parameters as a set
  function saveParameterSet(name: string, description?: string): ParameterSet {
    const paramValues: Record<string, number> = {}
    parameters.value.forEach(param => {
      paramValues[param.name] = param.value
    })

    const set: ParameterSet = {
      id: `paramset_${Date.now()}`,
      name,
      description,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      parameters: paramValues,
    }

    parameterSets.value.push(set)
    saveParameterSetsToStorage()

    return set
  }

  // Load parameter set
  function loadParameterSet(setId: string): boolean {
    const set = parameterSets.value.find(s => s.id === setId)
    if (!set) {
      console.error('Parameter set not found:', setId)
      return false
    }

    // Apply parameter values
    Object.entries(set.parameters).forEach(([name, value]) => {
      updateParameter(name, value)
    })

    currentParameterSet.value = set
    return true
  }

  // Delete parameter set
  function deleteParameterSet(setId: string) {
    parameterSets.value = parameterSets.value.filter(s => s.id !== setId)
    if (currentParameterSet.value?.id === setId) {
      currentParameterSet.value = null
    }
    saveParameterSetsToStorage()
  }

  // Update parameter set
  function updateParameterSet(setId: string, updates: Partial<ParameterSet>) {
    const index = parameterSets.value.findIndex(s => s.id === setId)
    if (index !== -1) {
      parameterSets.value[index] = {
        ...parameterSets.value[index],
        ...updates,
        lastModified: new Date().toISOString(),
      }
      saveParameterSetsToStorage()
    }
  }

  // Export parameter set to file
  function exportParameterSet(set: ParameterSet): void {
    const data = JSON.stringify(set, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${set.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.params`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import parameter set from file
  function importParameterSet(fileContent: string): ParameterSet | null {
    try {
      const set: ParameterSet = JSON.parse(fileContent)

      // Validate structure
      if (!set.parameters || typeof set.parameters !== 'object') {
        throw new Error('Invalid parameter set format')
      }

      // Generate new ID and timestamps
      set.id = `paramset_${Date.now()}`
      set.created = new Date().toISOString()
      set.lastModified = new Date().toISOString()

      parameterSets.value.push(set)
      saveParameterSetsToStorage()

      return set
    } catch (error) {
      console.error('Failed to import parameter set:', error)
      return null
    }
  }

  // Save parameter sets to localStorage
  function saveParameterSetsToStorage() {
    localStorage.setItem('yardrover_parameter_sets', JSON.stringify(parameterSets.value))
  }

  // Set filter
  function setFilter(newFilter: Partial<ParameterFilter>) {
    filter.value = { ...filter.value, ...newFilter }
  }

  // Parameter Streaming

  /**
   * Start parameter streaming for real-time updates
   */
  async function startParameterStreaming(): Promise<void> {
    if (!connectionStore.isConnected || isStreamingActive.value) {
      return
    }

    try {
      const client = connectionStore.getClient()

      // Set up parameter change listener
      const handleParameterChange = (event: ParameterChangeEvent) => {
        const paramIndex = parameters.value.findIndex(p => p.name === event.parameterName)

        if (paramIndex !== -1 && event.newValue !== undefined) {
          // Update existing parameter
          const param = parameters.value[paramIndex]
          const oldValue = param.value
          param.value = event.newValue
          param.modified = event.newValue !== param.defaultValue

          console.log(`📡 Parameter updated: ${event.parameterName} = ${event.newValue} (was ${oldValue})`)
        } else if (event.newValue !== undefined) {
          // New parameter received
          const cachedParam = client.parameters.getParameterFromCache(event.parameterName)
          if (cachedParam) {
            const newParam = convertMAVLinkParameter(cachedParam)
            parameters.value.push(newParam)
            console.log(`📡 New parameter received: ${event.parameterName} = ${event.newValue}`)
          }
        }

        lastSync.value = new Date().toISOString()
      }

      // Add listener for parameter changes
      client.parameters.addParameterListener(handleParameterChange)

      // Start the parameter stream
      await client.parameters.startParameterStream()

      isStreamingActive.value = true
      console.log('✅ Parameter streaming started')
    } catch (error) {
      console.error('❌ Failed to start parameter streaming:', error)
    }
  }

  /**
   * Stop parameter streaming
   */
  function stopParameterStreaming(): void {
    if (!isStreamingActive.value) {
      return
    }

    try {
      const client = connectionStore.getClient()
      client.parameters.stopParameterStream()
      isStreamingActive.value = false
      console.log('🛑 Parameter streaming stopped')
    } catch (error) {
      console.error('❌ Failed to stop parameter streaming:', error)
    }
  }

  return {
    // State
    parameters,
    parameterGroups,
    parameterSets,
    currentParameterSet,
    isLoadingParameters,
    isSavingParameters,
    lastSync,
    filter,

    // Computed
    modifiedParameters,
    filteredParameters,
    filteredGroups,
    parameterCount,
    modifiedCount,

    // Actions
    loadParametersFromVehicle,
    saveParametersToVehicle,
    updateParameter,
    resetParameter,
    resetAllParameters,
    validateParameters,
    saveParameterSet,
    loadParameterSet,
    deleteParameterSet,
    updateParameterSet,
    exportParameterSet,
    importParameterSet,
    setFilter,
  }
})
