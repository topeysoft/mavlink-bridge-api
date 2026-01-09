<template>
  <q-dialog
    v-model="showDialog"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="machine-config-dialog">
      <q-card-section class="machine-config-dialog__header">
        <div class="machine-config-dialog__title-section">
          <q-icon name="settings" size="32px" color="primary" class="q-mr-md" />
          <div>
            <div class="text-h5">Machine Configuration</div>
            <div class="text-subtitle2 text-grey-6">
              Configure settings for {{ machine?.name || 'Unknown Machine' }}
            </div>
          </div>
        </div>

        <q-btn flat round icon="close" @click="closeDialog" />
      </q-card-section>

      <q-separator />

      <q-card-section class="machine-config-dialog__content">
        <div v-if="machine" class="machine-config-dialog__form">
          <q-tabs
            v-model="activeTab"
            dense
            class="text-grey-6"
            active-color="primary"
            indicator-color="primary"
            align="left"
          >
            <q-tab name="general" label="General" icon="settings" />
            <q-tab name="mowing" label="Mowing" icon="grass" />
            <q-tab name="navigation" label="Navigation" icon="explore" />
            <q-tab name="safety" label="Safety" icon="security" />
            <q-tab name="connectivity" label="Connectivity" icon="wifi" />
            <q-tab name="advanced" label="Advanced" icon="tune" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="activeTab" animated class="machine-config-dialog__panels">
            <!-- General Tab -->
            <q-tab-panel name="general" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Basic Information</div>

                      <q-input
                        v-model="config.general.name"
                        label="Machine Name"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model="config.general.description"
                        label="Description"
                        type="textarea"
                        rows="3"
                        outlined
                        class="q-mb-md"
                      />

                      <q-select
                        v-model="config.general.zone"
                        :options="zoneOptions"
                        label="Default Zone"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model="config.general.maxWorkingHours"
                        label="Max Working Hours per Day"
                        type="number"
                        suffix="hours"
                        outlined
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Schedule Settings</div>

                      <q-toggle
                        v-model="config.general.autoStart"
                        label="Auto Start on Schedule"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model="config.general.startTime"
                        label="Default Start Time"
                        type="time"
                        outlined
                        class="q-mb-md"
                        :disable="!config.general.autoStart"
                      />

                      <q-input
                        v-model="config.general.endTime"
                        label="Default End Time"
                        type="time"
                        outlined
                        class="q-mb-md"
                        :disable="!config.general.autoStart"
                      />

                      <q-select
                        v-model="config.general.workingDays"
                        :options="dayOptions"
                        multiple
                        label="Working Days"
                        outlined
                        :disable="!config.general.autoStart"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>

            <!-- Mowing Tab -->
            <q-tab-panel name="mowing" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Cutting Settings</div>

                      <q-input
                        v-model.number="config.mowing.cuttingHeight"
                        label="Cutting Height"
                        type="number"
                        suffix="mm"
                        outlined
                        class="q-mb-md"
                        :min="20"
                        :max="80"
                      />

                      <q-select
                        v-model="config.mowing.pattern"
                        :options="patternOptions"
                        label="Mowing Pattern"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.mowing.speed"
                        label="Mowing Speed"
                        type="number"
                        suffix="m/min"
                        outlined
                        class="q-mb-md"
                        :min="5"
                        :max="30"
                      />

                      <q-toggle
                        v-model="config.mowing.edgeTrimming"
                        label="Enable Edge Trimming"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.mowing.spiralCutting"
                        label="Use Spiral Cutting for Small Areas"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Advanced Mowing</div>

                      <q-input
                        v-model.number="config.mowing.overlapPercentage"
                        label="Path Overlap"
                        type="number"
                        suffix="%"
                        outlined
                        class="q-mb-md"
                        :min="10"
                        :max="50"
                      />

                      <q-input
                        v-model.number="config.mowing.passCount"
                        label="Number of Passes"
                        type="number"
                        outlined
                        class="q-mb-md"
                        :min="1"
                        :max="5"
                      />

                      <q-toggle
                        v-model="config.mowing.randomizePath"
                        label="Randomize Mowing Path"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.mowing.mulching"
                        label="Enable Mulching Mode"
                        class="q-mb-md"
                      />

                      <q-select
                        v-model="config.mowing.grassCondition"
                        :options="grassConditionOptions"
                        label="Grass Condition"
                        outlined
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>

            <!-- Navigation Tab -->
            <q-tab-panel name="navigation" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Navigation Settings</div>

                      <q-select
                        v-model="config.navigation.mode"
                        :options="navigationModeOptions"
                        label="Navigation Mode"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.navigation.accuracy"
                        label="GPS Accuracy"
                        type="number"
                        suffix="cm"
                        outlined
                        class="q-mb-md"
                        :min="1"
                        :max="10"
                      />

                      <q-input
                        v-model.number="config.navigation.pathWidth"
                        label="Path Width"
                        type="number"
                        suffix="cm"
                        outlined
                        class="q-mb-md"
                        :min="20"
                        :max="50"
                      />

                      <q-toggle
                        v-model="config.navigation.rtk"
                        label="Enable RTK GPS"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.navigation.obstacleAvoidance"
                        label="Dynamic Obstacle Avoidance"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Return to Base</div>

                      <q-input
                        v-model.number="config.navigation.lowBatteryThreshold"
                        label="Low Battery Return Threshold"
                        type="number"
                        suffix="%"
                        outlined
                        class="q-mb-md"
                        :min="10"
                        :max="30"
                      />

                      <q-input
                        v-model.number="config.navigation.rainReturnDelay"
                        label="Rain Return Delay"
                        type="number"
                        suffix="minutes"
                        outlined
                        class="q-mb-md"
                        :min="0"
                        :max="60"
                      />

                      <q-toggle
                        v-model="config.navigation.findWire"
                        label="Find Wire on Return"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.navigation.autoReturn"
                        label="Auto Return at End Time"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>

            <!-- Safety Tab -->
            <q-tab-panel name="safety" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Sensor Settings</div>

                      <q-toggle
                        v-model="config.safety.liftSensor"
                        label="Lift Sensor"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.safety.tiltSensor"
                        label="Tilt Sensor"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.safety.collisionSensor"
                        label="Collision Sensor"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.safety.rainSensor"
                        label="Rain Sensor"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.safety.maxSlope"
                        label="Maximum Slope"
                        type="number"
                        suffix="degrees"
                        outlined
                        :min="0"
                        :max="45"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Security Settings</div>

                      <q-input
                        v-model="config.safety.pinCode"
                        label="PIN Code"
                        type="password"
                        outlined
                        class="q-mb-md"
                        maxlength="4"
                      />

                      <q-toggle
                        v-model="config.safety.alarmEnabled"
                        label="Security Alarm"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.safety.alarmDelay"
                        label="Alarm Delay"
                        type="number"
                        suffix="seconds"
                        outlined
                        class="q-mb-md"
                        :disable="!config.safety.alarmEnabled"
                        :min="0"
                        :max="60"
                      />

                      <q-toggle
                        v-model="config.safety.geofencing"
                        label="Geofencing"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.safety.remoteShutdown"
                        label="Remote Emergency Shutdown"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>

            <!-- Connectivity Tab -->
            <q-tab-panel name="connectivity" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">WiFi Settings</div>

                      <q-input
                        v-model="config.connectivity.wifiSSID"
                        label="WiFi Network (SSID)"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model="config.connectivity.wifiPassword"
                        label="WiFi Password"
                        type="password"
                        outlined
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.connectivity.wifiAutoReconnect"
                        label="Auto Reconnect WiFi"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.connectivity.signalStrengthThreshold"
                        label="Minimum Signal Strength"
                        type="number"
                        suffix="dBm"
                        outlined
                        :min="-100"
                        :max="-30"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Communication</div>

                      <q-toggle
                        v-model="config.connectivity.cloudSync"
                        label="Cloud Synchronization"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.connectivity.statusUpdateInterval"
                        label="Status Update Interval"
                        type="number"
                        suffix="seconds"
                        outlined
                        class="q-mb-md"
                        :min="10"
                        :max="300"
                      />

                      <q-toggle
                        v-model="config.connectivity.diagnosticReporting"
                        label="Diagnostic Reporting"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.connectivity.remoteAccess"
                        label="Remote Access"
                        class="q-mb-md"
                      />

                      <q-select
                        v-model="config.connectivity.dataUsageLimit"
                        :options="dataUsageOptions"
                        label="Data Usage Limit"
                        outlined
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>

            <!-- Advanced Tab -->
            <q-tab-panel name="advanced" class="q-pa-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Performance Tuning</div>

                      <q-select
                        v-model="config.advanced.performanceMode"
                        :options="performanceModeOptions"
                        label="Performance Mode"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="config.advanced.motorSpeed"
                        label="Motor Speed"
                        type="number"
                        suffix="RPM"
                        outlined
                        class="q-mb-md"
                        :min="1000"
                        :max="4000"
                      />

                      <q-input
                        v-model.number="config.advanced.bladeSpeed"
                        label="Blade Speed"
                        type="number"
                        suffix="RPM"
                        outlined
                        class="q-mb-md"
                        :min="2000"
                        :max="6000"
                      />

                      <q-toggle
                        v-model="config.advanced.adaptiveSpeed"
                        label="Adaptive Speed Control"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.advanced.weatherAdaptation"
                        label="Weather Adaptation"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">System Settings</div>

                      <q-input
                        v-model="config.advanced.firmwareVersion"
                        label="Firmware Version"
                        outlined
                        readonly
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.advanced.autoUpdate"
                        label="Automatic Updates"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.advanced.debugMode"
                        label="Debug Mode"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="config.advanced.telemetryLogging"
                        label="Telemetry Logging"
                        class="q-mb-md"
                      />

                      <q-btn
                        color="warning"
                        label="Reset to Factory Defaults"
                        class="q-mt-md"
                        @click="confirmFactoryReset"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="machine-config-dialog__actions">
        <q-btn flat label="Reset Changes" color="grey" @click="resetChanges" />
        <q-btn flat label="Cancel" color="grey" @click="closeDialog" />
        <q-btn
          color="primary"
          label="Save Configuration"
          :loading="saving"
          @click="saveConfiguration"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/* eslint-env browser */
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Props
interface Machine {
  id: string
  name: string
  model: string
  type: string
  status: string
  battery: number
  currentZone?: string
  lastActivity: string
}

interface MachineConfig {
  general: {
    name: string
    description: string
    zone: string
    maxWorkingHours: number
    autoStart: boolean
    startTime: string
    endTime: string
    workingDays: string[]
  }
  mowing: {
    cuttingHeight: number
    pattern: string
    speed: number
    edgeTrimming: boolean
    spiralCutting: boolean
    overlapPercentage: number
    passCount: number
    randomizePath: boolean
    mulching: boolean
    grassCondition: string
  }
  navigation: {
    mode: string
    accuracy: number
    pathWidth: number
    rtk: boolean
    obstacleAvoidance: boolean
    lowBatteryThreshold: number
    rainReturnDelay: number
    findWire: boolean
    autoReturn: boolean
  }
  safety: {
    liftSensor: boolean
    tiltSensor: boolean
    collisionSensor: boolean
    rainSensor: boolean
    maxSlope: number
    pinCode: string
    alarmEnabled: boolean
    alarmDelay: number
    geofencing: boolean
    remoteShutdown: boolean
  }
  connectivity: {
    wifiSSID: string
    wifiPassword: string
    wifiAutoReconnect: boolean
    signalStrengthThreshold: number
    cloudSync: boolean
    statusUpdateInterval: number
    diagnosticReporting: boolean
    remoteAccess: boolean
    dataUsageLimit: string
  }
  advanced: {
    performanceMode: string
    motorSpeed: number
    bladeSpeed: number
    adaptiveSpeed: boolean
    weatherAdaptation: boolean
    firmwareVersion: string
    autoUpdate: boolean
    debugMode: boolean
    telemetryLogging: boolean
  }
}

const props = defineProps<{
  machine: Machine | null
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [config: MachineConfig]
}>()

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('general')
const saving = ref(false)
const originalConfig = ref<MachineConfig | null>(null)

// Default configuration
const defaultConfig: MachineConfig = {
  general: {
    name: '',
    description: '',
    zone: 'main',
    maxWorkingHours: 8,
    autoStart: true,
    startTime: '08:00',
    endTime: '18:00',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  },
  mowing: {
    cuttingHeight: 30,
    pattern: 'parallel',
    speed: 15,
    edgeTrimming: true,
    spiralCutting: true,
    overlapPercentage: 20,
    passCount: 1,
    randomizePath: false,
    mulching: true,
    grassCondition: 'normal'
  },
  navigation: {
    mode: 'gps',
    accuracy: 5,
    pathWidth: 30,
    rtk: false,
    obstacleAvoidance: true,
    lowBatteryThreshold: 20,
    rainReturnDelay: 15,
    findWire: true,
    autoReturn: true
  },
  safety: {
    liftSensor: true,
    tiltSensor: true,
    collisionSensor: true,
    rainSensor: true,
    maxSlope: 20,
    pinCode: '0000',
    alarmEnabled: true,
    alarmDelay: 10,
    geofencing: true,
    remoteShutdown: true
  },
  connectivity: {
    wifiSSID: '',
    wifiPassword: '',
    wifiAutoReconnect: true,
    signalStrengthThreshold: -70,
    cloudSync: true,
    statusUpdateInterval: 30,
    diagnosticReporting: true,
    remoteAccess: false,
    dataUsageLimit: 'unlimited'
  },
  advanced: {
    performanceMode: 'balanced',
    motorSpeed: 2500,
    bladeSpeed: 4000,
    adaptiveSpeed: true,
    weatherAdaptation: true,
    firmwareVersion: '2.1.4',
    autoUpdate: true,
    debugMode: false,
    telemetryLogging: true
  }
}

const config = ref<MachineConfig>({ ...defaultConfig })

// Options
const zoneOptions = [
  { label: 'Main Area', value: 'main' },
  { label: 'Front Yard', value: 'front' },
  { label: 'Back Yard', value: 'back' },
  { label: 'Side Yard', value: 'side' },
  { label: 'Garden Area', value: 'garden' }
]

const dayOptions = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' }
]

const patternOptions = [
  { label: 'Parallel Lines', value: 'parallel' },
  { label: 'Random', value: 'random' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Checkerboard', value: 'checkerboard' }
]

const grassConditionOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Normal', value: 'normal' },
  { label: 'Heavy', value: 'heavy' },
  { label: 'Overgrown', value: 'overgrown' }
]

const navigationModeOptions = [
  { label: 'GPS Only', value: 'gps' },
  { label: 'GPS + RTK', value: 'gps_rtk' },
  { label: 'Boundary Wire', value: 'wire' },
  { label: 'Hybrid', value: 'hybrid' }
]

const dataUsageOptions = [
  { label: 'Unlimited', value: 'unlimited' },
  { label: '1 GB/month', value: '1gb' },
  { label: '5 GB/month', value: '5gb' },
  { label: '10 GB/month', value: '10gb' }
]

const performanceModeOptions = [
  { label: 'Eco Mode', value: 'eco' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Performance', value: 'performance' },
  { label: 'Turbo', value: 'turbo' }
]

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

// Methods
const loadConfiguration = () => {
  if (props.machine) {
    // Load configuration from machine or use defaults
    config.value = {
      ...defaultConfig,
      general: {
        ...defaultConfig.general,
        name: props.machine.name,
        description: `${props.machine.model} robotic lawn mower`
      }
    }
    originalConfig.value = JSON.parse(JSON.stringify(config.value))
  }
}

const resetChanges = () => {
  if (originalConfig.value) {
    config.value = JSON.parse(JSON.stringify(originalConfig.value))
  }
}

const saveConfiguration = async () => {
  saving.value = true

  try {
    // In a real app, this would be an API call
    // await machineApi.saveConfiguration(props.machine?.id, config.value)

    emit('save', config.value)
    originalConfig.value = JSON.parse(JSON.stringify(config.value))

    $q.notify({
      type: 'positive',
      message: 'Configuration saved successfully'
    })

    closeDialog()
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to save configuration'
    })
  } finally {
    saving.value = false
  }
}

const closeDialog = () => {
  showDialog.value = false
  activeTab.value = 'general'
}

const confirmFactoryReset = () => {
  $q.dialog({
    title: 'Factory Reset',
    message:
      'Are you sure you want to reset all settings to factory defaults? This action cannot be undone.',
    cancel: true,
    persistent: true,
    ok: {
      label: 'Reset',
      color: 'negative'
    }
  }).onOk(() => {
    config.value = JSON.parse(JSON.stringify(defaultConfig))
    if (props.machine) {
      config.value.general.name = props.machine.name
      config.value.general.description = `${props.machine.model} robotic lawn mower`
    }

    $q.notify({
      type: 'warning',
      message: 'Configuration reset to factory defaults'
    })
  })
}

// Watchers
watch(
  () => props.machine,
  () => {
    if (props.machine) {
      loadConfiguration()
    }
  }
)

watch(
  () => props.modelValue,
  newValue => {
    if (newValue && props.machine) {
      loadConfiguration()
    }
  }
)

// Lifecycle
onMounted(() => {
  if (props.machine) {
    loadConfiguration()
  }
})
</script>

<style lang="scss" scoped>
.machine-config-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.machine-config-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: var(--q-grey-1);
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-bottom-color: var(--q-grey-7);
  }
}

.machine-config-dialog__title-section {
  display: flex;
  align-items: center;
}

.machine-config-dialog__content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.machine-config-dialog__form {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.machine-config-dialog__panels {
  flex: 1;
  overflow-y: auto;
}

.machine-config-dialog__actions {
  padding: 16px 24px;
  background: var(--q-grey-1);
  border-top: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-top-color: var(--q-grey-7);
  }
}

// Tab content styling
.q-tab-panel {
  max-width: 100%;
}

.q-card {
  height: 100%;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-config-dialog__header {
    padding: 16px;
  }

  .machine-config-dialog__actions {
    padding: 12px 16px;
  }
}

@media (max-width: 599px) {
  .machine-config-dialog__header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .machine-config-dialog__title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
