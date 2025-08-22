<template>
  <ConfigSection
    label="WiFi Settings"
    caption="Network configuration and access point settings"
    icon="mdi-wifi"
    :loading="loading"
    :saving="saving"
    :error="error"
    :is-dirty="isDirty"
    :has-errors="hasValidationErrors"
    @save="handleSave"
    @reset="handleReset"
  >
    <q-form ref="formRef">
      <!-- Station Mode Settings -->
      <div class="text-subtitle1 text-weight-medium q-mb-md">
        Station Mode
      </div>
      
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12">
          <q-toggle
            v-model="formData.stationEnabled"
            label="Enable WiFi Station Mode"
            hint="Connect to an existing WiFi network"
            @update:model-value="markDirty"
          />
        </div>

        <div class="col-12" v-if="formData.stationEnabled">
          <q-input
            v-model="formData.ssid"
            label="WiFi Network (SSID)"
            hint="Network name to connect to"
            :rules="[
              val => !formData.stationEnabled || !!val || 'SSID is required when station mode is enabled',
              val => !val || val.length <= 32 || 'SSID must be 32 characters or less'
            ]"
            lazy-rules
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-wifi" />
            </template>
            <template v-slot:after>
              <q-btn
                round
                dense
                flat
                icon="refresh"
                @click="scanNetworks"
                :loading="wifiStore.isScanning"
              >
                <q-tooltip>Scan for networks</q-tooltip>
              </q-btn>
            </template>
          </q-input>
        </div>

        <div class="col-12" v-if="formData.stationEnabled">
          <q-toggle
            v-model="formData.autoConnect"
            label="Auto Connect"
            hint="Automatically connect to this network on startup"
            @update:model-value="markDirty"
          />
        </div>
      </div>

      <!-- Available Networks -->
      <div v-if="formData.stationEnabled && wifiStore.availableNetworks.length > 0" class="q-mb-lg">
        <div class="text-subtitle2 q-mb-sm">Available Networks</div>
        <q-list bordered separator>
          <q-item
            v-for="network in wifiStore.availableNetworks.slice(0, 5)"
            :key="network.ssid"
            clickable
            @click="selectNetwork(network.ssid)"
            :class="{ 'bg-primary text-white': formData.ssid === network.ssid }"
          >
            <q-item-section avatar>
              <q-icon :name="getSignalIcon(network.rssi)" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ network.ssid }}</q-item-label>
              <q-item-label caption>{{ network.rssi }} dBm</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon v-if="network.secure" name="lock" color="grey-6" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <q-separator class="q-my-lg" />

      <!-- Access Point Settings -->
      <div class="text-subtitle1 text-weight-medium q-mb-md">
        Access Point Mode
      </div>
      
      <div class="row q-col-gutter-md">
        <div class="col-12">
          <q-toggle
            v-model="formData.apEnabled"
            label="Enable Access Point"
            hint="Create a WiFi hotspot for direct connection"
            @update:model-value="markDirty"
          />
        </div>

        <div class="col-12 col-md-6" v-if="formData.apEnabled">
          <q-input
            v-model="formData.apSSID"
            label="Access Point Name (SSID)"
            hint="Network name for the access point"
            :rules="[
              val => !formData.apEnabled || !!val || 'SSID is required',
              val => !val || val.length >= 1 || 'SSID too short',
              val => !val || val.length <= 32 || 'SSID too long'
            ]"
            lazy-rules
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-access-point" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-6" v-if="formData.apEnabled">
          <q-input
            v-model="formData.apPassword"
            label="Access Point Password"
            :type="showPassword ? 'text' : 'password'"
            hint="Leave empty for open network"
            :rules="[
              val => !val || val.length >= 8 || 'Password must be at least 8 characters'
            ]"
            lazy-rules
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-lock" />
            </template>
            <template v-slot:append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-6" v-if="formData.apEnabled">
          <q-select
            v-model="formData.apChannel"
            label="Channel"
            :options="channelOptions"
            hint="WiFi channel for access point"
            emit-value
            map-options
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-sine-wave" />
            </template>
          </q-select>
        </div>

        <div class="col-12 col-md-6" v-if="formData.apEnabled">
          <q-input
            v-model.number="formData.apMaxConnections"
            label="Max Connections"
            type="number"
            hint="Maximum number of clients"
            :rules="[
              val => val >= 1 || 'Must be at least 1',
              val => val <= 10 || 'Maximum 10 connections'
            ]"
            lazy-rules
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-account-multiple" />
            </template>
          </q-input>
        </div>
      </div>
    </q-form>
  </ConfigSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useConfigurationStore } from '../../stores/configuration'
import { useWiFiStore } from '../../stores/wifi'
import ConfigSection from './ConfigSection.vue'

const $q = useQuasar()
const configStore = useConfigurationStore()
const wifiStore = useWiFiStore()

const formRef = ref()
const showPassword = ref(false)
const formData = ref({
  stationEnabled: true,
  ssid: '',
  autoConnect: true,
  apEnabled: false,
  apSSID: 'YardRover-AP',
  apPassword: '',
  apChannel: 6,
  apMaxConnections: 4
})

const originalData = ref<typeof formData.value | null>(null)
const validationErrors = ref(0)

const channelOptions = Array.from({ length: 13 }, (_, i) => ({
  label: `Channel ${i + 1}`,
  value: i + 1
}))

const loading = computed(() => configStore.config.loading)
const saving = ref(false)
const error = computed(() => configStore.config.error?.message || null)
const isDirty = computed(() => 
  JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
)
const hasValidationErrors = computed(() => validationErrors.value > 0)

// Initialize form data from store
watch(() => configStore.connectionConfig, (config) => {
  if (config && config.type === 'wifi') {
    formData.value = {
      stationEnabled: true,
      ssid: config.wifi.ssid || '',
      autoConnect: config.wifi.autoConnect ?? true,
      // AP settings don't exist in current config type, using defaults
      apEnabled: false,
      apSSID: 'YardRover-AP',
      apPassword: '',
      apChannel: 6,
      apMaxConnections: 4
    }
    originalData.value = { ...formData.value }
  }
}, { immediate: true })

function markDirty() {
  // Trigger reactivity
}

// Validation errors are handled manually by checking form validation

function getSignalIcon(rssi?: number): string {
  if (!rssi) return 'signal_wifi_0_bar'
  if (rssi >= -50) return 'signal_wifi_4_bar'
  if (rssi >= -60) return 'signal_wifi_3_bar' 
  if (rssi >= -70) return 'signal_wifi_2_bar'
  return 'signal_wifi_1_bar'
}

function selectNetwork(ssid: string) {
  formData.value.ssid = ssid
  markDirty()
}

async function scanNetworks() {
  try {
    await wifiStore.scanNetworks()
  } catch (error) {
    console.error('Failed to scan networks:', error)
  }
}

async function handleSave() {
  const isValid = await formRef.value.validate()
  if (!isValid) return

  saving.value = true
  try {
    await configStore.updateConfiguration({
      connection: {
        type: 'wifi',
        wifi: {
          ssid: formData.value.ssid,
          autoConnect: formData.value.autoConnect
        }
      }
    })
    
    originalData.value = { ...formData.value }
    
    $q.notify({
      type: 'positive',
      message: 'WiFi settings saved successfully',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save WiFi settings',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    saving.value = false
  }
}

function handleReset() {
  if (originalData.value) {
    formData.value = { ...originalData.value }
    formRef.value.resetValidation()
  }
}
</script>