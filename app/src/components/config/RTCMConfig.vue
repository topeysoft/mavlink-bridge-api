<template>
  <ConfigSection
    label="RTCM Settings"
    caption="Real-time correction data source configuration"
    icon="mdi-satellite-variant"
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
          <q-toggle
            v-model="formData.enabled"
            label="Enable RTCM Corrections"
            hint="Receive real-time kinematic corrections for improved accuracy"
            @update:model-value="markDirty"
          />
        </div>

        <template v-if="formData.enabled">
          <div class="col-12">
            <q-select
              v-model="formData.sourceType"
              label="Source Type"
              :options="sourceTypeOptions"
              hint="Type of RTCM correction source"
              emit-value
              map-options
              @update:model-value="markDirty"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-source-branch" />
              </template>
            </q-select>
          </div>

          <div class="col-12 col-md-6">
            <q-input
              v-model="formData.host"
              label="Host"
              hint="Server hostname or IP address"
              :rules="[
                val => !!val || 'Host is required when RTCM is enabled'
              ]"
              lazy-rules
              @update:model-value="markDirty"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-server" />
              </template>
            </q-input>
          </div>

          <div class="col-12 col-md-6">
            <q-input
              v-model.number="formData.port"
              label="Port"
              type="number"
              hint="Server port number"
              :rules="[
                val => val >= 1 || 'Port must be at least 1',
                val => val <= 65535 || 'Port must be 65535 or less'
              ]"
              lazy-rules
              @update:model-value="markDirty"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-ethernet" />
              </template>
            </q-input>
          </div>

          <div class="col-12 col-md-6" v-if="formData.sourceType === 'ntrip'">
            <q-input
              v-model="formData.mountpoint"
              label="Mountpoint"
              hint="NTRIP mountpoint (optional)"
              @update:model-value="markDirty"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-map-marker" />
              </template>
            </q-input>
          </div>

          <div class="col-12 col-md-6" v-if="formData.sourceType === 'ntrip'">
            <q-input
              v-model="formData.username"
              label="Username"
              hint="NTRIP authentication username (optional)"
              @update:model-value="markDirty"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-account" />
              </template>
            </q-input>
          </div>

          <div class="col-12" v-if="formData.sourceType === 'ntrip' && formData.username">
            <q-input
              v-model="formData.password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              hint="NTRIP authentication password"
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
        </template>
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
const showPassword = ref(false)
const formData = ref({
  enabled: false,
  sourceType: 'ntrip' as 'ntrip' | 'tcp' | 'udp',
  host: '',
  port: 2101,
  mountpoint: '',
  username: '',
  password: ''
})

const originalData = ref<typeof formData.value | null>(null)
const validationErrors = ref(0)

const sourceTypeOptions = [
  { label: 'NTRIP', value: 'ntrip' },
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' }
]

const loading = computed(() => configStore.config.loading)
const saving = ref(false)
const error = computed(() => configStore.config.error?.message || null)
const isDirty = computed(() => 
  JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
)
const hasValidationErrors = computed(() => validationErrors.value > 0)

// Initialize form data from store
watch(() => configStore.rtcmConfig, (config) => {
  if (config) {
    formData.value = {
      enabled: config.enabled || false,
      sourceType: config.source.type || 'ntrip',
      host: config.source.host || '',
      port: config.source.port || 2101,
      mountpoint: config.source.mountpoint || '',
      username: config.source.username || '',
      password: config.source.password || ''
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
      rtcm: {
        enabled: formData.value.enabled,
        source: {
          type: formData.value.sourceType,
          host: formData.value.host,
          port: formData.value.port,
          ...(formData.value.mountpoint && { mountpoint: formData.value.mountpoint }),
          ...(formData.value.username && { username: formData.value.username }),
          ...(formData.value.password && { password: formData.value.password })
        }
      }
    })
    
    originalData.value = { ...formData.value }
    
    $q.notify({
      type: 'positive',
      message: 'RTCM settings saved successfully',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save RTCM settings',
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