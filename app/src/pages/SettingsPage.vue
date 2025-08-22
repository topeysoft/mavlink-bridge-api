<template>
  <BasePage
    title="Configuration"
    subtitle="Manage device settings and preferences"
    :loading="loading"
    :error="error"
    @retry="loadConfiguration"
  >
    <template #actions>
      <q-btn
        round
        flat
        icon="refresh"
        @click="loadConfiguration"
        :loading="loading"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </template>

    <!-- Configuration Status -->
    <q-banner
      v-if="configStore.isDirty"
      class="bg-warning text-white q-mb-lg"
      rounded
    >
      <template v-slot:avatar>
        <q-icon name="warning" />
      </template>
      You have unsaved changes. Save or reset each section individually.
    </q-banner>

    <!-- Configuration Sections -->
    <div class="configuration-sections">
      <DeviceConfig />
      <WiFiConfig />
      <ConnectionConfig />
      <RTCMConfig />
    </div>

    <!-- Backup & Restore -->
    <div class="q-mt-xl">
      <ConfigBackup />
    </div>

    <!-- Factory Reset -->
    <div class="q-mt-lg">
      <q-card>
        <q-card-section>
          <div class="row items-center">
            <div class="col">
              <div class="text-h6 text-negative">Danger Zone</div>
              <div class="text-caption text-grey-7">
                These actions cannot be undone
              </div>
            </div>
            <div class="col-auto">
              <q-btn
                label="Factory Reset"
                color="negative"
                icon="mdi-restore"
                @click="confirmFactoryReset"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePage>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConfigurationStore } from '../stores/configuration'
import BasePage from '../components/layout/BasePage.vue'
import DeviceConfig from '../components/config/DeviceConfig.vue'
import WiFiConfig from '../components/config/WiFiConfig.vue'
import ConnectionConfig from '../components/config/ConnectionConfig.vue'
import RTCMConfig from '../components/config/RTCMConfig.vue'
import ConfigBackup from '../components/config/ConfigBackup.vue'

const $q = useQuasar()
const configStore = useConfigurationStore()

const loading = computed(() => configStore.config.loading)
const error = computed(() => configStore.config.error)

async function loadConfiguration() {
  try {
    await configStore.fetchConfiguration()
  } catch (error) {
    console.error('Failed to load configuration:', error)
  }
}

function confirmFactoryReset() {
  $q.dialog({
    title: 'Factory Reset',
    message: 'This will reset all settings to factory defaults and restart the device. Are you sure?',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    void (async () => {
    try {
      await configStore.factoryReset()
      
      $q.notify({
        type: 'info',
        message: 'Device is resetting to factory defaults',
        caption: 'You will need to reconnect after the device restarts',
        position: 'top',
        timeout: 0,
        actions: [
          { label: 'Dismiss', color: 'white' }
        ]
      })
    } catch (error: unknown) {
      $q.notify({
        type: 'negative',
        message: 'Failed to reset device',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
    })()
  })
}

onMounted(() => {
  void loadConfiguration()
})
</script>

<style lang="scss" scoped>
.configuration-sections {
  :deep(.q-expansion-item) {
    margin-bottom: 16px;
  }
}
</style>