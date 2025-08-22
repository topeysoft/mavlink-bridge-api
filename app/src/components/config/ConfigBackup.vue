<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Configuration Backup & Restore</div>
      
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">Export Configuration</div>
              <div class="text-caption text-grey-7 q-mb-md">
                Download current configuration as a JSON file
              </div>
              
              <q-btn
                label="Export"
                color="primary"
                icon="mdi-download"
                @click="exportConfig"
                :loading="exporting"
              />
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">Import Configuration</div>
              <div class="text-caption text-grey-7 q-mb-md">
                Restore configuration from a previously exported file
              </div>
              
              <q-file
                v-model="importFile"
                label="Select configuration file"
                accept=".json"
                max-file-size="1048576"
                @rejected="onFileRejected"
                class="q-mb-md"
              >
                <template v-slot:prepend>
                  <q-icon name="mdi-file-upload" />
                </template>
              </q-file>
              
              <q-btn
                label="Import"
                color="primary"
                icon="mdi-upload"
                @click="importConfig"
                :disable="!importFile"
                :loading="importing"
              />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Configuration Preview -->
      <q-dialog v-model="showPreview" maximized>
        <q-card>
          <q-toolbar>
            <q-toolbar-title>Configuration Preview</q-toolbar-title>
            <q-btn flat round dense icon="close" v-close-popup />
          </q-toolbar>

          <q-card-section>
            <div class="text-subtitle1 q-mb-md">
              Review the configuration before importing:
            </div>
            
            <q-scroll-area style="height: calc(100vh - 200px)">
              <pre class="config-preview">{{ previewData }}</pre>
            </q-scroll-area>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn
              flat
              label="Import"
              color="primary"
              @click="confirmImport"
              :loading="importing"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useConfigurationStore } from '../../stores/configuration'
import type { Configuration } from '@mavlinkbridge/api-client'

const $q = useQuasar()
const configStore = useConfigurationStore()

const exporting = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const showPreview = ref(false)
const previewData = ref('')
const pendingConfig = ref<Configuration | null>(null)

async function exportConfig() {
  exporting.value = true
  
  try {
    await configStore.fetchConfiguration()
    
    const config = configStore.config.data
    if (!config) throw new Error('No configuration available')
    
    const data = JSON.stringify(config, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `yardrover-config-${Date.now()}.json`
    a.click()
    
    URL.revokeObjectURL(url)
    
    $q.notify({
      type: 'positive',
      message: 'Configuration exported successfully',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to export configuration',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    exporting.value = false
  }
}

async function importConfig() {
  if (!importFile.value) return
  
  try {
    const text = await importFile.value.text()
    const config = JSON.parse(text) as Configuration
    
    // Validate configuration structure
    if (!config.device || !config.connection || !config.rtcm) {
      throw new Error('Invalid configuration file format')
    }
    
    pendingConfig.value = config
    previewData.value = JSON.stringify(config, null, 2)
    showPreview.value = true
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to read configuration file',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

async function confirmImport() {
  if (!pendingConfig.value) return
  
  importing.value = true
  
  try {
    await configStore.updateConfiguration(pendingConfig.value)
    
    showPreview.value = false
    importFile.value = null
    pendingConfig.value = null
    
    $q.notify({
      type: 'positive',
      message: 'Configuration imported successfully',
      caption: 'Device will restart to apply changes',
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: 'Failed to import configuration',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    importing.value = false
  }
}

function onFileRejected(rejectedEntries: Array<{ failedPropValidation?: string }>) {
  $q.notify({
    type: 'negative',
    message: 'File rejected',
    caption: rejectedEntries[0]?.failedPropValidation || 'Invalid file',
    position: 'top'
  })
}
</script>

<style lang="scss" scoped>
.config-preview {
  font-family: monospace;
  font-size: 12px;
  background: $grey-2;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  
  .body--dark & {
    background: $grey-9;
  }
}
</style>