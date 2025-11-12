<template>
  <div class="yard-settings">
    <!-- Header -->
    <div class="yard-settings__header">
      <div class="text-h5">Yard Settings</div>
      <div class="text-subtitle2 text-grey-6">
        Configure your yard's global settings and preferences
      </div>
    </div>

    <q-separator />

    <div class="yard-settings__content">
      <div class="row q-gutter-lg">
        <!-- General Settings -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="settings" class="q-mr-sm" />
                General Settings
              </div>

              <div class="yard-settings__form">
                <q-input v-model="settings.yardName" label="Yard Name" outlined class="q-mb-md" />

                <q-input
                  v-model="settings.description"
                  label="Description"
                  type="textarea"
                  rows="3"
                  outlined
                  class="q-mb-md"
                />

                <q-select
                  v-model="settings.timezone"
                  :options="timezoneOptions"
                  label="Timezone"
                  outlined
                  class="q-mb-md"
                />

                <q-select
                  v-model="settings.units"
                  :options="unitOptions"
                  label="Units"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.totalArea"
                  label="Total Yard Area"
                  type="number"
                  suffix="m²"
                  outlined
                  class="q-mb-md"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Coordinate Settings -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="place" class="q-mr-sm" />
                Coordinate System
              </div>

              <div class="yard-settings__form">
                <q-input
                  v-model.number="settings.coordinates.centerLat"
                  label="Center Latitude"
                  type="number"
                  step="0.000001"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.coordinates.centerLng"
                  label="Center Longitude"
                  type="number"
                  step="0.000001"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.coordinates.rotation"
                  label="Map Rotation"
                  type="number"
                  suffix="°"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.coordinates.scale"
                  label="Map Scale"
                  type="number"
                  step="0.1"
                  outlined
                  class="q-mb-md"
                />

                <q-btn
                  flat
                  color="primary"
                  label="Auto-detect Location"
                  icon="my_location"
                  @click="autoDetectLocation"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Default Mowing Settings -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="grass" class="q-mr-sm" />
                Default Mowing Settings
              </div>

              <div class="yard-settings__form">
                <q-select
                  v-model="settings.mowing.defaultPattern"
                  :options="mowingPatternOptions"
                  label="Default Mowing Pattern"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.mowing.defaultCuttingHeight"
                  label="Default Cutting Height"
                  type="number"
                  suffix="mm"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.mowing.defaultSpeed"
                  label="Default Mowing Speed"
                  type="number"
                  suffix="m/min"
                  outlined
                  class="q-mb-md"
                />

                <q-select
                  v-model="settings.mowing.defaultFrequency"
                  :options="frequencyOptions"
                  label="Default Frequency"
                  outlined
                  class="q-mb-md"
                />

                <q-toggle
                  v-model="settings.mowing.edgeTrimming"
                  label="Enable Edge Trimming"
                  class="q-mb-md"
                />

                <q-toggle
                  v-model="settings.mowing.spiralCutting"
                  label="Use Spiral Cutting for Small Areas"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Safety & Navigation -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="security" class="q-mr-sm" />
                Safety & Navigation
              </div>

              <div class="yard-settings__form">
                <q-input
                  v-model.number="settings.safety.defaultObstacleBuffer"
                  label="Default Obstacle Buffer"
                  type="number"
                  suffix="m"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.safety.boundaryBuffer"
                  label="Boundary Buffer"
                  type="number"
                  suffix="m"
                  outlined
                  class="q-mb-md"
                />

                <q-input
                  v-model.number="settings.safety.maxSlope"
                  label="Maximum Slope"
                  type="number"
                  suffix="°"
                  outlined
                  class="q-mb-md"
                />

                <q-toggle
                  v-model="settings.safety.rainSensor"
                  label="Enable Rain Sensor"
                  class="q-mb-md"
                />

                <q-toggle
                  v-model="settings.safety.tiltSensor"
                  label="Enable Tilt Sensor"
                  class="q-mb-md"
                />

                <q-toggle v-model="settings.safety.liftSensor" label="Enable Lift Sensor" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Weather Integration -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="wb_sunny" class="q-mr-sm" />
                Weather Integration
              </div>

              <div class="yard-settings__form">
                <q-toggle
                  v-model="settings.weather.enabled"
                  label="Enable Weather Integration"
                  class="q-mb-md"
                />

                <q-input
                  v-model="settings.weather.apiKey"
                  label="Weather API Key"
                  type="password"
                  outlined
                  class="q-mb-md"
                  :disable="!settings.weather.enabled"
                />

                <q-input
                  v-model.number="settings.weather.rainThreshold"
                  label="Rain Threshold"
                  type="number"
                  suffix="mm/h"
                  outlined
                  class="q-mb-md"
                  :disable="!settings.weather.enabled"
                />

                <q-input
                  v-model.number="settings.weather.windThreshold"
                  label="Wind Speed Threshold"
                  type="number"
                  suffix="km/h"
                  outlined
                  class="q-mb-md"
                  :disable="!settings.weather.enabled"
                />

                <q-input
                  v-model.number="settings.weather.temperatureMin"
                  label="Minimum Temperature"
                  type="number"
                  suffix="°C"
                  outlined
                  class="q-mb-md"
                  :disable="!settings.weather.enabled"
                />

                <q-input
                  v-model.number="settings.weather.temperatureMax"
                  label="Maximum Temperature"
                  type="number"
                  suffix="°C"
                  outlined
                  :disable="!settings.weather.enabled"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Notifications -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md flex items-center">
                <q-icon name="notifications" class="q-mr-sm" />
                Notifications
              </div>

              <div class="yard-settings__form">
                <q-toggle
                  v-model="settings.notifications.enabled"
                  label="Enable Notifications"
                  class="q-mb-md"
                />

                <div class="q-ml-lg" :style="{ opacity: settings.notifications.enabled ? 1 : 0.5 }">
                  <q-toggle
                    v-model="settings.notifications.taskComplete"
                    label="Task Completion"
                    class="q-mb-sm"
                    :disable="!settings.notifications.enabled"
                  />

                  <q-toggle
                    v-model="settings.notifications.errors"
                    label="Errors & Alerts"
                    class="q-mb-sm"
                    :disable="!settings.notifications.enabled"
                  />

                  <q-toggle
                    v-model="settings.notifications.maintenance"
                    label="Maintenance Reminders"
                    class="q-mb-sm"
                    :disable="!settings.notifications.enabled"
                  />

                  <q-toggle
                    v-model="settings.notifications.weather"
                    label="Weather Alerts"
                    class="q-mb-sm"
                    :disable="!settings.notifications.enabled"
                  />

                  <q-toggle
                    v-model="settings.notifications.security"
                    label="Security Events"
                    class="q-mb-md"
                    :disable="!settings.notifications.enabled"
                  />
                </div>

                <q-input
                  v-model="settings.notifications.email"
                  label="Email Address"
                  type="email"
                  outlined
                  class="q-mb-md"
                  :disable="!settings.notifications.enabled"
                />

                <q-input
                  v-model="settings.notifications.phone"
                  label="Phone Number"
                  type="tel"
                  outlined
                  :disable="!settings.notifications.enabled"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <q-separator />
    <div class="yard-settings__actions">
      <div class="row justify-between">
        <div class="col-auto">
          <q-btn flat color="grey" label="Reset to Defaults" @click="resetToDefaults" />
        </div>

        <div class="col-auto">
          <q-btn flat color="grey" label="Cancel" class="q-mr-sm" @click="$emit('cancel')" />

          <q-btn color="primary" label="Save Settings" :loading="saving" @click="saveSettings" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Props
interface YardSettings {
  yardName: string
  description: string
  timezone: string
  units: string
  totalArea: number
  coordinates: {
    centerLat: number
    centerLng: number
    rotation: number
    scale: number
  }
  mowing: {
    defaultPattern: string
    defaultCuttingHeight: number
    defaultSpeed: number
    defaultFrequency: string
    edgeTrimming: boolean
    spiralCutting: boolean
  }
  safety: {
    defaultObstacleBuffer: number
    boundaryBuffer: number
    maxSlope: number
    rainSensor: boolean
    tiltSensor: boolean
    liftSensor: boolean
  }
  weather: {
    enabled: boolean
    apiKey: string
    rainThreshold: number
    windThreshold: number
    temperatureMin: number
    temperatureMax: number
  }
  notifications: {
    enabled: boolean
    taskComplete: boolean
    errors: boolean
    maintenance: boolean
    weather: boolean
    security: boolean
    email: string
    phone: string
  }
}

const props = defineProps<{
  initialSettings?: Partial<YardSettings>
}>()

// Emits
const emit = defineEmits<{
  save: [settings: YardSettings]
  cancel: []
}>()

// Composables
const $q = useQuasar()

// Local state
const saving = ref(false)

// Default settings
const defaultSettings: YardSettings = {
  yardName: 'My Yard',
  description: '',
  timezone: 'UTC',
  units: 'metric',
  totalArea: 1000,
  coordinates: {
    centerLat: 0,
    centerLng: 0,
    rotation: 0,
    scale: 1.0
  },
  mowing: {
    defaultPattern: 'parallel',
    defaultCuttingHeight: 30,
    defaultSpeed: 15,
    defaultFrequency: 'twice_weekly',
    edgeTrimming: true,
    spiralCutting: true
  },
  safety: {
    defaultObstacleBuffer: 0.5,
    boundaryBuffer: 0.3,
    maxSlope: 20,
    rainSensor: true,
    tiltSensor: true,
    liftSensor: true
  },
  weather: {
    enabled: false,
    apiKey: '',
    rainThreshold: 2,
    windThreshold: 25,
    temperatureMin: 5,
    temperatureMax: 35
  },
  notifications: {
    enabled: true,
    taskComplete: true,
    errors: true,
    maintenance: true,
    weather: false,
    security: true,
    email: '',
    phone: ''
  }
}

const settings = ref<YardSettings>({ ...defaultSettings })

// Options
const timezoneOptions = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' }
]

const unitOptions = [
  { label: 'Metric (m, kg, °C)', value: 'metric' },
  { label: 'Imperial (ft, lb, °F)', value: 'imperial' }
]

const mowingPatternOptions = [
  { label: 'Parallel Lines', value: 'parallel' },
  { label: 'Random', value: 'random' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Checkerboard', value: 'checkerboard' }
]

const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Every Other Day', value: 'every_other_day' },
  { label: 'Twice Weekly', value: 'twice_weekly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'bi_weekly' }
]

// Methods
const autoDetectLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        settings.value.coordinates.centerLat = position.coords.latitude
        settings.value.coordinates.centerLng = position.coords.longitude

        $q.notify({
          type: 'positive',
          message: 'Location detected successfully'
        })
      },
      error => {
        $q.notify({
          type: 'negative',
          message: 'Failed to detect location: ' + error.message
        })
      }
    )
  } else {
    $q.notify({
      type: 'negative',
      message: 'Geolocation is not supported by this browser'
    })
  }
}

const resetToDefaults = () => {
  $q.dialog({
    title: 'Reset Settings',
    message: 'Are you sure you want to reset all settings to their default values?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    settings.value = { ...defaultSettings }

    $q.notify({
      type: 'positive',
      message: 'Settings reset to defaults'
    })
  })
}

const saveSettings = async () => {
  saving.value = true

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    emit('save', settings.value)

    $q.notify({
      type: 'positive',
      message: 'Settings saved successfully'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save settings'
    })
  } finally {
    saving.value = false
  }
}

// Initialize settings
onMounted(() => {
  if (props.initialSettings) {
    settings.value = { ...defaultSettings, ...props.initialSettings }
  }
})
</script>

<style lang="scss" scoped>
.yard-settings {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.yard-settings__header {
  padding: 24px;
  background: var(--q-grey-1);

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.yard-settings__content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.yard-settings__form {
  display: flex;
  flex-direction: column;
}

.yard-settings__actions {
  padding: 16px 24px;
  background: var(--q-grey-1);
  border-top: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-top-color: var(--q-grey-7);
  }
}

// Card styling
.q-card {
  height: 100%;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .yard-settings__content {
    padding: 16px;
  }

  .yard-settings__header {
    padding: 16px;
  }

  .yard-settings__actions {
    padding: 12px 16px;
  }
}

@media (max-width: 599px) {
  .yard-settings__actions .row {
    flex-direction: column;
    gap: 12px;
  }

  .yard-settings__actions .col-auto {
    width: 100%;
  }

  .yard-settings__actions .row.justify-between {
    justify-content: flex-start;
  }
}
</style>
