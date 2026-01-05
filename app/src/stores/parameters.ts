import { ref, computed } from 'vue'
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
import type { MAVLinkParameter } from '@mavlinkbridge/api-client'

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

  const filter = ref<ParameterFilter>({
    search: '',
    group: undefined,
    modifiedOnly: false,
    showAdvanced: false,
  })

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
   * Convert MAVLink parameter to UI Parameter format
   */
  function convertMAVLinkParameter(mavParam: MAVLinkParameter): Parameter {
    return {
      name: mavParam.name,
      displayName: mavParam.displayName || mavParam.name,
      value: mavParam.value,
      defaultValue: mavParam.defaultValue ?? mavParam.value,
      type: mavParam.type as unknown as ParameterType,
      group: mavParam.group || 'BASIC',
      description: mavParam.description || '',
      units: mavParam.units,
      min: mavParam.min,
      max: mavParam.max,
      increment: mavParam.increment,
      readOnly: mavParam.readOnly,
      rebootRequired: mavParam.rebootRequired,
      modified: false
    }
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

      // Get all parameters from vehicle
      const mavParams = await client.parameters.listParameters()

      // Convert to UI parameter format
      parameters.value = mavParams.map(convertMAVLinkParameter)

      lastSync.value = new Date().toISOString()

      console.log('Loaded parameters from vehicle:', parameters.value.length)
      return true
    } catch (error) {
      console.error('Failed to load parameters from vehicle:', error)
      // Fallback to mock parameters for development
      parameters.value = getMockParameters()
      return false
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

  // Mock parameters for development
  function getMockParameters(): Parameter[] {
    return [
      // Basic Settings
      {
        name: 'SYSID_THISMAV',
        displayName: 'MAVLink System ID',
        value: 1,
        defaultValue: 1,
        type: ParamType.UINT8,
        group: 'BASIC',
        description: 'MAVLink system ID of this vehicle',
        min: 1,
        max: 250,
        rebootRequired: true,
      },
      {
        name: 'FRAME_TYPE',
        displayName: 'Frame Type',
        value: 0,
        defaultValue: 0,
        type: ParamType.UINT8,
        group: 'BASIC',
        description: 'Vehicle frame configuration (0=Rover, 1=Boat)',
        min: 0,
        max: 1,
      },
      // Navigation
      {
        name: 'WP_RADIUS',
        displayName: 'Waypoint Radius',
        value: 2.0,
        defaultValue: 2.0,
        type: ParamType.FLOAT,
        group: 'NAVIGATION',
        description: 'Distance from waypoint that triggers acceptance',
        units: 'm',
        min: 0.1,
        max: 100.0,
        increment: 0.1,
      },
      {
        name: 'WP_SPEED',
        displayName: 'Waypoint Speed',
        value: 2.0,
        defaultValue: 2.0,
        type: ParamType.FLOAT,
        group: 'NAVIGATION',
        description: 'Target speed between waypoints',
        units: 'm/s',
        min: 0.0,
        max: 5.0,
        increment: 0.1,
      },
      {
        name: 'NAV_TURN_RATE',
        displayName: 'Turn Rate',
        value: 45.0,
        defaultValue: 45.0,
        type: ParamType.FLOAT,
        group: 'NAVIGATION',
        description: 'Maximum turn rate during navigation',
        units: 'deg/s',
        min: 0.0,
        max: 360.0,
        increment: 5.0,
      },
      // Control
      {
        name: 'CRUISE_SPEED',
        displayName: 'Cruise Speed',
        value: 2.0,
        defaultValue: 2.0,
        type: ParamType.FLOAT,
        group: 'CONTROL',
        description: 'Target cruise speed in AUTO mode',
        units: 'm/s',
        min: 0.0,
        max: 5.0,
        increment: 0.1,
      },
      {
        name: 'CRUISE_THROTTLE',
        displayName: 'Cruise Throttle',
        value: 50,
        defaultValue: 50,
        type: ParamType.UINT8,
        group: 'CONTROL',
        description: 'Throttle percentage for cruise speed',
        units: '%',
        min: 0,
        max: 100,
      },
      // Battery
      {
        name: 'BATT_CAPACITY',
        displayName: 'Battery Capacity',
        value: 5000,
        defaultValue: 5000,
        type: ParamType.UINT32,
        group: 'BATTERY',
        description: 'Battery capacity in mAh',
        units: 'mAh',
        min: 0,
        max: 100000,
      },
      {
        name: 'BATT_LOW_VOLT',
        displayName: 'Low Battery Voltage',
        value: 10.5,
        defaultValue: 10.5,
        type: ParamType.FLOAT,
        group: 'BATTERY',
        description: 'Battery voltage that triggers low battery action',
        units: 'V',
        min: 0.0,
        max: 50.0,
        increment: 0.1,
      },
      {
        name: 'BATT_CRT_VOLT',
        displayName: 'Critical Battery Voltage',
        value: 10.0,
        defaultValue: 10.0,
        type: ParamType.FLOAT,
        group: 'BATTERY',
        description: 'Battery voltage that triggers critical battery action',
        units: 'V',
        min: 0.0,
        max: 50.0,
        increment: 0.1,
      },
      // GPS
      {
        name: 'GPS_TYPE',
        displayName: 'GPS Type',
        value: 1,
        defaultValue: 1,
        type: ParamType.UINT8,
        group: 'GPS',
        description: 'GPS receiver type (0=None, 1=Auto, 2=uBlox)',
        min: 0,
        max: 10,
      },
      {
        name: 'GPS_GNSS_MODE',
        displayName: 'GNSS Mode',
        value: 0,
        defaultValue: 0,
        type: ParamType.UINT8,
        group: 'GPS',
        description: 'GNSS system configuration',
        min: 0,
        max: 7,
      },
      // Geofence
      {
        name: 'FENCE_ENABLE',
        displayName: 'Fence Enable',
        value: 0,
        defaultValue: 0,
        type: ParamType.UINT8,
        group: 'FENCE',
        description: 'Enable geofence (0=Disabled, 1=Enabled)',
        min: 0,
        max: 1,
      },
      {
        name: 'FENCE_RADIUS',
        displayName: 'Fence Radius',
        value: 100.0,
        defaultValue: 100.0,
        type: ParamType.FLOAT,
        group: 'FENCE',
        description: 'Circular fence radius from home',
        units: 'm',
        min: 0.0,
        max: 10000.0,
      },
      {
        name: 'FENCE_ACTION',
        displayName: 'Fence Action',
        value: 1,
        defaultValue: 1,
        type: ParamType.UINT8,
        group: 'FENCE',
        description: 'Action on fence breach (0=Report, 1=RTL, 2=Hold)',
        min: 0,
        max: 2,
      },
      // Safety
      {
        name: 'FS_TIMEOUT',
        displayName: 'Failsafe Timeout',
        value: 5.0,
        defaultValue: 5.0,
        type: ParamType.FLOAT,
        group: 'SAFETY',
        description: 'Failsafe timeout in seconds',
        units: 's',
        min: 0.0,
        max: 300.0,
      },
      {
        name: 'FS_ACTION',
        displayName: 'Failsafe Action',
        value: 1,
        defaultValue: 1,
        type: ParamType.UINT8,
        group: 'SAFETY',
        description: 'Failsafe action (0=None, 1=RTL, 2=Hold, 3=Disarm)',
        min: 0,
        max: 3,
      },
    ]
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
