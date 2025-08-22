<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Parameter Backup & Restore</div>
      
      <div class="row q-col-gutter-md">
        <!-- Export -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">Export Parameters</div>
              <div class="text-caption text-grey-7 q-mb-md">
                Save current parameters to a file
              </div>
              
              <q-select
                v-model="exportOptions.format"
                :options="formatOptions"
                label="Format"
                emit-value
                map-options
                class="q-mb-md"
              />
              
              <q-select
                v-model="exportOptions.filter"
                :options="filterOptions"
                label="Include"
                emit-value
                map-options
                class="q-mb-md"
              />
              
              <q-btn
                label="Export"
                color="primary"
                icon="mdi-download"
                @click="exportParameters"
                :loading="exporting"
              />
            </q-card-section>
          </q-card>
        </div>

        <!-- Import -->
        <div class="col-12 col-md-6">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">Import Parameters</div>
              <div class="text-caption text-grey-7 q-mb-md">
                Load parameters from a backup file
              </div>
              
              <q-file
                v-model="importFile"
                label="Select parameter file"
                accept=".param,.json,.txt"
                max-file-size="10485760"
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
                @click="importParameters"
                :disable="!importFile"
                :loading="importing"
              />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Parameter Comparison -->
      <div v-if="showComparison" class="q-mt-lg">
        <div class="text-subtitle1 q-mb-md">Parameter Comparison</div>
        
        <q-table
          :rows="comparisonData"
          :columns="comparisonColumns"
          row-key="name"
          :rows-per-page-options="[10, 25, 50]"
          class="comparison-table"
        >
          <template v-slot:body-cell-action="props">
            <q-td :props="props">
              <q-icon
                :name="props.row.action === 'add' ? 'add' : 
                      props.row.action === 'change' ? 'edit' : 'delete'"
                :color="props.row.action === 'add' ? 'positive' : 
                       props.row.action === 'change' ? 'warning' : 'negative'"
              />
            </q-td>
          </template>
          
          <template v-slot:body-cell-diff="props">
            <q-td :props="props">
              <div v-if="props.row.action === 'change'">
                {{ props.row.currentValue }} → {{ props.row.newValue }}
              </div>
              <div v-else-if="props.row.action === 'add'">
                {{ props.row.newValue }}
              </div>
              <div v-else>
                {{ props.row.currentValue }}
              </div>
            </q-td>
          </template>
        </q-table>

        <div class="row justify-end q-mt-md q-gutter-sm">
          <q-btn flat label="Cancel" @click="cancelImport" />
          <q-btn
            label="Apply Changes"
            color="primary"
            @click="confirmImport"
            :loading="importing"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkParametersStore } from '../../stores/mavlink-parameters'
import type { MAVLinkParameter } from '../../stores/mavlink-parameters'

const $q = useQuasar()
const parametersStore = useMAVLinkParametersStore()

const exporting = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const showComparison = ref(false)
const pendingParameters = ref<Record<string, number>>({})

const exportOptions = ref({
  format: 'param',
  filter: 'all'
})

const formatOptions = [
  { label: 'ArduPilot (.param)', value: 'param' },
  { label: 'JSON (.json)', value: 'json' },
  { label: 'Text (.txt)', value: 'txt' }
]

const filterOptions = [
  { label: 'All Parameters', value: 'all' },
  { label: 'Modified Only', value: 'modified' },
  { label: 'Non-Default Only', value: 'non-default' }
]

const comparisonColumns = [
  {
    name: 'action',
    label: 'Action',
    field: 'action',
    align: 'center' as const,
    style: 'width: 80px'
  },
  {
    name: 'name',
    label: 'Parameter',
    field: 'name',
    align: 'left' as const,
    style: 'font-family: monospace'
  },
  {
    name: 'diff',
    label: 'Change',
    field: 'diff',
    align: 'left' as const
  }
]

const comparisonData = computed(() => {
  const current = parametersStore.parameters.data || {}
  const changes = []
  
  for (const [name, newValue] of Object.entries(pendingParameters.value)) {
    const currentParam = current[name]
    
    if (!currentParam) {
      changes.push({
        name,
        action: 'add',
        newValue,
        currentValue: undefined
      })
    } else if (currentParam.value !== newValue) {
      changes.push({
        name,
        action: 'change',
        newValue,
        currentValue: currentParam.value
      })
    }
  }
  
  // Check for deletions (parameters in current but not in import)
  for (const name of Object.keys(current)) {
    if (!(name in pendingParameters.value)) {
      const currentParam = current[name]
      if (currentParam) {
        changes.push({
          name,
          action: 'delete',
          currentValue: currentParam.value,
          newValue: undefined
        })
      }
    }
  }
  
  return changes
})

function exportParameters() {
  exporting.value = true
  
  try {
    let data: string
    let filename: string
    
    const parameters = parametersStore.getFilteredParameters(exportOptions.value.filter)
    
    switch (exportOptions.value.format) {
      case 'param':
        data = generateParamFile(parameters)
        filename = `parameters-${Date.now()}.param`
        break
      case 'json':
        data = JSON.stringify(parameters, null, 2)
        filename = `parameters-${Date.now()}.json`
        break
      case 'txt':
        data = generateTextFile(parameters)
        filename = `parameters-${Date.now()}.txt`
        break
      default:
        throw new Error('Unknown format')
    }
    
    const blob = new Blob([data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    
    URL.revokeObjectURL(url)
    
    $q.notify({
      type: 'positive',
      message: 'Parameters exported successfully',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to export parameters',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    exporting.value = false
  }
}

async function importParameters() {
  if (!importFile.value) return
  
  try {
    const text = await importFile.value.text()
    const parsed = parseParameterFile(text, importFile.value.name)
    
    pendingParameters.value = parsed
    showComparison.value = true
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to parse parameter file',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

async function confirmImport() {
  importing.value = true
  
  try {
    await parametersStore.importParameters(pendingParameters.value)
    
    showComparison.value = false
    importFile.value = null
    pendingParameters.value = {}
    
    $q.notify({
      type: 'positive',
      message: 'Parameters imported successfully',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to import parameters',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    importing.value = false
  }
}

function cancelImport() {
  showComparison.value = false
  importFile.value = null
  pendingParameters.value = {}
}

function generateParamFile(parameters: Record<string, MAVLinkParameter>): string {
  return Object.entries(parameters)
    .map(([name, param]) => `${name},${param.value}`)
    .join('\n')
}

function generateTextFile(parameters: Record<string, MAVLinkParameter>): string {
  return Object.entries(parameters)
    .map(([name, param]) => {
      const desc = param.description ? ` # ${param.description}` : ''
      return `${name} = ${param.value}${desc}`
    })
    .join('\n')
}

function parseParameterFile(content: string, filename: string): Record<string, number> {
  const parameters: Record<string, number> = {}
  
  if (filename.endsWith('.json')) {
    const parsed = JSON.parse(content) as Record<string, unknown>
    for (const [name, param] of Object.entries(parsed)) {
      if (typeof param === 'object' && param !== null && 'value' in param) {
        parameters[name] = (param as { value: number }).value
      } else if (typeof param === 'number') {
        parameters[name] = param
      }
    }
  } else {
    // Parse .param or .txt format
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      const parts = trimmed.split(/[,=]/)
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const name = parts[0].trim()
        const value = parseFloat(parts[1].trim())
        if (!isNaN(value)) {
          parameters[name] = value
        }
      }
    }
  }
  
  return parameters
}

function onFileRejected(rejectedEntries: { failedPropValidation?: string }[]) {
  $q.notify({
    type: 'negative',
    message: 'File rejected',
    caption: rejectedEntries[0]?.failedPropValidation || 'Invalid file',
    position: 'top'
  })
}
</script>

<style lang="scss" scoped>
.comparison-table {
  :deep(.q-table__middle) {
    max-height: 400px;
  }
}
</style>