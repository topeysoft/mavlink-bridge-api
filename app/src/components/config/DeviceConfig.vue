<template>
  <ConfigSection
    label="Device Settings"
    caption="Basic device identification and behavior"
    icon="mdi-robot-mower"
    :loading="loading"
    :saving="saving"
    :error="error"
    :is-dirty="isDirty"
    :has-errors="hasValidationErrors"
    default-opened
    @save="handleSave"
    @reset="handleReset"
  >
    <q-form ref="formRef">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-6">
          <q-input
            v-model="formData.name"
            label="Device Name"
            hint="A friendly name for this device"
            :rules="[
              val => !!val || 'Name is required',
              val => val.length >= 3 || 'Name must be at least 3 characters',
              val => val.length <= 32 || 'Name must be less than 32 characters'
            ]"
            lazy-rules
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-tag" />
            </template>
          </q-input>
        </div>

        <div class="col-12 col-md-6">
          <q-select
            v-model="formData.mode"
            label="Operating Mode"
            :options="modeOptions"
            hint="Device operation mode"
            emit-value
            map-options
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-cog" />
            </template>
          </q-select>
        </div>

        <div class="col-12">
          <q-toggle
            v-model="formData.ntripEnabled"
            label="Enable NTRIP Client"
            hint="Connect to NTRIP caster for RTK corrections"
            @update:model-value="markDirty"
          />
        </div>

        <div class="col-12">
          <q-toggle
            v-model="formData.loggingEnabled"
            label="Enable Debug Logging"
            hint="Store detailed logs for troubleshooting"
            @update:model-value="markDirty"
          />
        </div>

        <div class="col-12" v-if="formData.loggingEnabled">
          <q-select
            v-model="formData.logLevel"
            label="Log Level"
            :options="logLevelOptions"
            hint="Minimum log level to record"
            emit-value
            map-options
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-format-list-bulleted" />
            </template>
          </q-select>
        </div>
      </div>
    </q-form>
  </ConfigSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useConfigurationStore } from '../../stores/configuration'
import ConfigSection from './ConfigSection.vue'

const $q = useQuasar()
const configStore = useConfigurationStore()

const formRef = ref()
const formData = ref({
  name: '',
  mode: 'usb_otg' as 'usb_otg' | 'uart',
  ntripEnabled: false,
  loggingEnabled: false,
  logLevel: 'info'
})

const originalData = ref<typeof formData.value | null>(null)
const validationErrors = ref(0)

const modeOptions = [
  { label: 'USB OTG', value: 'usb_otg' },
  { label: 'UART', value: 'uart' }
]

const logLevelOptions = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warn' },
  { label: 'Error', value: 'error' }
]

const loading = computed(() => configStore.config.loading)
const saving = ref(false)
const error = computed(() => configStore.config.error?.message || null)
const isDirty = computed(() => 
  JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
)
const hasValidationErrors = computed(() => validationErrors.value > 0)

// Initialize form data from store
watch(() => configStore.deviceConfig, (config) => {
  if (config) {
    formData.value = {
      name: config.name || '',
      mode: config.mode || 'usb_otg',
      // These fields don't exist in the current DeviceConfig type, 
      // but are included for UI consistency as shown in the prompt
      ntripEnabled: false,
      loggingEnabled: false,
      logLevel: 'info'
    }
    originalData.value = { ...formData.value }
  }
}, { immediate: true })

function markDirty() {
  // Trigger reactivity
}

// Validation errors are handled manually by checking form validation

async function handleSave() {
  const isValid = await formRef.value.validate()
  if (!isValid) return

  saving.value = true
  try {
    await configStore.updateConfiguration({
      device: {
        name: formData.value.name,
        mode: formData.value.mode
      }
    })
    
    originalData.value = { ...formData.value }
    
    $q.notify({
      type: 'positive',
      message: 'Device settings saved successfully',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save device settings',
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