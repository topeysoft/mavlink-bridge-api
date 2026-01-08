import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/**
 * User mode determines which features are available
 */
export type UserMode = 'consumer' | 'power-user' | 'developer'

/**
 * Feature flags for controlling app functionality
 */
export interface FeatureFlags {
  // Mission & Planning
  missionTemplates: boolean // Pre-built mission templates
  missionScheduling: boolean // Schedule missions for later

  // Control & MAVLink
  vehicleControl: boolean // Direct vehicle control interface
  flightModes: boolean // Manual flight mode switching
  mavlinkStream: boolean // Live MAVLink message stream
  parameterEditor: boolean // Vehicle parameter configuration
  parameterConfiguration: boolean // Parameter management interface

  // Monitoring & Debugging
  systemMonitoring: boolean // System health and diagnostics
  telemetryCharts: boolean // Advanced telemetry visualization
  logDownload: boolean // Download and analyze logs
  activityLogs: boolean // Activity log viewer and analysis

  // Advanced Features
  geofencing: boolean // Geofence configuration
  rallyPoints: boolean // Rally point management
  batteryManagement: boolean // Advanced battery monitoring and management
  weatherIntegration: boolean // Weather monitoring and task postponement
  rtcmClient: boolean // RTK/RTCM positioning for centimeter-level GPS accuracy
  customCommands: boolean // Send custom MAVLink commands
  scriptExecution: boolean // Run custom automation scripts

  // Developer Tools
  apiConsole: boolean // Direct API/MAVLink console
  debugMode: boolean // Debug information and logs
  experimentalFeatures: boolean // Beta/experimental features
}

/**
 * Default feature sets for each user mode
 */
const MODE_PRESETS: Record<UserMode, FeatureFlags> = {
  consumer: {
    missionTemplates: true,
    missionScheduling: true,
    vehicleControl: false,
    flightModes: false,
    mavlinkStream: false,
    parameterEditor: false,
    parameterConfiguration: false,
    systemMonitoring: false,
    telemetryCharts: false,
    logDownload: false,
    activityLogs: false,
    geofencing: false,
    rallyPoints: false,
    batteryManagement: true,
    weatherIntegration: true,
    rtcmClient: true,
    customCommands: false,
    scriptExecution: false,
    apiConsole: false,
    debugMode: false,
    experimentalFeatures: false,
  },
  'power-user': {
    missionTemplates: true,
    missionScheduling: true,
    vehicleControl: true,
    flightModes: true,
    mavlinkStream: true,
    parameterEditor: false,
    parameterConfiguration: true,
    systemMonitoring: true,
    telemetryCharts: true,
    logDownload: true,
    activityLogs: true,
    geofencing: true,
    rallyPoints: true,
    batteryManagement: true,
    weatherIntegration: true,
    rtcmClient: true,
    customCommands: false,
    scriptExecution: false,
    apiConsole: false,
    debugMode: false,
    experimentalFeatures: false,
  },
  developer: {
    missionTemplates: true,
    missionScheduling: true,
    vehicleControl: true,
    flightModes: true,
    mavlinkStream: true,
    parameterEditor: true,
    parameterConfiguration: true,
    systemMonitoring: true,
    telemetryCharts: true,
    logDownload: true,
    activityLogs: true,
    geofencing: true,
    rallyPoints: true,
    batteryManagement: true,
    weatherIntegration: true,
    rtcmClient: true,
    customCommands: true,
    scriptExecution: true,
    apiConsole: true,
    debugMode: true,
    experimentalFeatures: true,
  },
}

export const useFeaturesStore = defineStore('features', () => {
  // Load saved user mode or default to consumer
  const userMode = ref<UserMode>(
    (localStorage.getItem('yardrover_user_mode') as UserMode) || 'consumer'
  )

  // Load saved custom flags or use preset
  const customFlags = ref<FeatureFlags>(
    JSON.parse(localStorage.getItem('yardrover_feature_flags') || 'null') ||
      { ...MODE_PRESETS[userMode.value] }
  )

  const useCustomFlags = ref<boolean>(
    localStorage.getItem('yardrover_use_custom_flags') === 'true'
  )

  // Active feature flags (either preset or custom)
  const features = computed<FeatureFlags>(() => {
    if (useCustomFlags.value) {
      return customFlags.value
    }
    return MODE_PRESETS[userMode.value]
  })

  // User mode metadata
  const modeInfo = computed(() => {
    const modes = {
      consumer: {
        label: 'Consumer Mode',
        description: 'Simple, easy-to-use interface for everyday tasks',
        icon: 'user',
        color: '#10b981',
      },
      'power-user': {
        label: 'Power User Mode',
        description: 'Advanced features for experienced operators',
        icon: 'zap',
        color: '#f59e0b',
      },
      developer: {
        label: 'Developer Mode',
        description: 'Full access to all features and debugging tools',
        icon: 'code',
        color: '#ef4444',
      },
    }
    return modes[userMode.value]
  })

  // Check if a feature is enabled
  function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return features.value[feature]
  }

  // Set user mode
  function setUserMode(mode: UserMode) {
    userMode.value = mode
    localStorage.setItem('yardrover_user_mode', mode)

    // Reset to preset when changing modes
    if (!useCustomFlags.value) {
      customFlags.value = { ...MODE_PRESETS[mode] }
    }
  }

  // Toggle a specific feature
  function toggleFeature(feature: keyof FeatureFlags) {
    customFlags.value[feature] = !customFlags.value[feature]
    saveCustomFlags()
  }

  // Enable custom flags
  function enableCustomFlags() {
    useCustomFlags.value = true
    customFlags.value = { ...features.value }
    localStorage.setItem('yardrover_use_custom_flags', 'true')
    saveCustomFlags()
  }

  // Reset to preset for current mode
  function resetToPreset() {
    useCustomFlags.value = false
    customFlags.value = { ...MODE_PRESETS[userMode.value] }
    localStorage.setItem('yardrover_use_custom_flags', 'false')
    localStorage.removeItem('yardrover_feature_flags')
  }

  // Save custom flags to localStorage
  function saveCustomFlags() {
    localStorage.setItem('yardrover_feature_flags', JSON.stringify(customFlags.value))
  }

  // Import/Export configurations
  function exportConfiguration(): string {
    return JSON.stringify(
      {
        userMode: userMode.value,
        useCustomFlags: useCustomFlags.value,
        customFlags: customFlags.value,
      },
      null,
      2
    )
  }

  function importConfiguration(config: string): boolean {
    try {
      const parsed = JSON.parse(config)
      if (parsed.userMode && MODE_PRESETS[parsed.userMode as UserMode]) {
        userMode.value = parsed.userMode
        useCustomFlags.value = parsed.useCustomFlags || false
        customFlags.value = parsed.customFlags || { ...MODE_PRESETS[parsed.userMode] }

        localStorage.setItem('yardrover_user_mode', userMode.value)
        localStorage.setItem('yardrover_use_custom_flags', String(useCustomFlags.value))
        saveCustomFlags()

        return true
      }
      return false
    } catch (error) {
      console.error('Failed to import configuration:', error)
      return false
    }
  }

  return {
    // State
    userMode,
    features,
    customFlags,
    useCustomFlags,
    modeInfo,

    // Actions
    isFeatureEnabled,
    setUserMode,
    toggleFeature,
    enableCustomFlags,
    resetToPreset,
    exportConfiguration,
    importConfiguration,
  }
})
