<template>
  <ConfigSection
    label="Connection Settings"
    caption="Communication interface configuration"
    icon="mdi-connection"
    :loading="loading"
    :saving="saving"
    :error="error"
    :is-dirty="isDirty"
    :has-errors="hasValidationErrors"
    @save="handleSave"
    @reset="handleReset"
  >
    <q-form ref="formRef">
      <div class="row q-col-gutter-md">
        <div class="col-12">
          <q-select
            v-model="formData.type"
            label="Connection Type"
            :options="connectionTypeOptions"
            hint="Primary communication interface"
            emit-value
            map-options
            @update:model-value="markDirty"
          >
            <template v-slot:prepend>
              <q-icon name="mdi-connection" />
            </template>
          </q-select>
        </div>

        <div class="col-12" v-if="formData.type === 'ethernet'">
          <q-banner class="bg-info text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="info" />
            </template>
            Ethernet connection settings will be configured automatically via DHCP.
          </q-banner>
        </div>

        <div class="col-12" v-if="formData.type === 'wifi'">
          <q-banner class="bg-primary text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="mdi-wifi" />
            </template>
            WiFi connection settings are configured in the WiFi Settings section above.
          </q-banner>
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
  type: 'wifi' as 'wifi' | 'ethernet'
})

const originalData = ref<typeof formData.value | null>(null)
const validationErrors = ref(0)

const connectionTypeOptions = [
  { label: 'WiFi', value: 'wifi' },
  { label: 'Ethernet', value: 'ethernet' }
]

const loading = computed(() => configStore.config.loading)
const saving = ref(false)
const error = computed(() => configStore.config.error?.message || null)
const isDirty = computed(() => 
  JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
)
const hasValidationErrors = computed(() => validationErrors.value > 0)

// Initialize form data from store
watch(() => configStore.connectionConfig, (config) => {
  if (config) {
    formData.value = {
      type: config.type || 'wifi'
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
    const currentConfig = configStore.connectionConfig
    await configStore.updateConfiguration({
      connection: {
        type: formData.value.type,
        wifi: currentConfig?.wifi || { ssid: '', autoConnect: false }
      }
    })
    
    originalData.value = { ...formData.value }
    
    $q.notify({
      type: 'positive',
      message: 'Connection settings saved successfully',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save connection settings',
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