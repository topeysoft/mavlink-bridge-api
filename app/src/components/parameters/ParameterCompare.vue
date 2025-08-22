<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Parameter Comparison</div>
      
      <!-- Compare Options -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-md-6">
          <q-select
            v-model="compareOptions.source"
            :options="sourceOptions"
            label="Compare Source"
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-6">
          <q-select
            v-model="compareOptions.filter"
            :options="filterOptions"
            label="Show"
            emit-value
            map-options
          />
        </div>
      </div>

      <!-- Comparison Results -->
      <div v-if="comparisonResults.length > 0">
        <div class="text-subtitle1 q-mb-md">
          Comparison Results ({{ comparisonResults.length }} differences)
        </div>
        
        <q-table
          :rows="comparisonResults"
          :columns="comparisonColumns"
          row-key="name"
          :rows-per-page-options="[10, 25, 50]"
          dense
        >
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip
                :label="props.row.status"
                :color="getStatusColor(props.row.status)"
                text-color="white"
                size="sm"
              />
            </q-td>
          </template>
          
          <template v-slot:body-cell-current="props">
            <q-td :props="props">
              <span class="monospace">{{ formatValue(props.row.currentValue) }}</span>
            </q-td>
          </template>
          
          <template v-slot:body-cell-default="props">
            <q-td :props="props">
              <span class="monospace">{{ formatValue(props.row.defaultValue) }}</span>
            </q-td>
          </template>
          
          <template v-slot:body-cell-difference="props">
            <q-td :props="props">
              <div v-if="props.row.status === 'Different'">
                <q-icon 
                  :name="getDifferenceIcon(props.row)" 
                  :color="getDifferenceColor(props.row)"
                  class="q-mr-xs"
                />
                {{ formatDifference(props.row) }}
              </div>
              <span v-else>-</span>
            </q-td>
          </template>
          
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <div class="q-gutter-xs">
                <q-btn
                  v-if="props.row.status === 'Different' || props.row.status === 'Modified'"
                  flat
                  round
                  dense
                  icon="mdi-restore"
                  @click="resetToDefault(props.row)"
                  color="orange"
                >
                  <q-tooltip>Reset to default</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  icon="mdi-information"
                  @click="showParameterInfo(props.row)"
                  color="grey"
                >
                  <q-tooltip>Parameter info</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>
        
        <!-- Bulk Actions -->
        <div class="row justify-end q-mt-md q-gutter-sm" v-if="modifiedParameters.length > 0">
          <q-btn
            flat
            label="Reset All Modified"
            color="orange"
            icon="mdi-restore"
            @click="resetAllModified"
          />
        </div>
      </div>
      
      <!-- No Differences -->
      <div v-else-if="hasCompared" class="text-center q-py-xl">
        <q-icon name="mdi-check-circle" size="48px" color="positive" />
        <div class="text-h6 q-mt-md">No Differences Found</div>
        <div class="text-body2 text-grey-7">
          All parameters match their {{ compareOptions.source }} values
        </div>
      </div>
      
      <!-- Initial State -->
      <div v-else class="text-center q-py-xl">
        <q-icon name="mdi-compare" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">Select comparison source</div>
        <div class="text-body2 text-grey-7">
          Choose what to compare current parameters against
        </div>
      </div>
    </q-card-section>
    
    <!-- Parameter Info Dialog -->
    <q-dialog v-model="showInfoDialog" v-if="selectedParameter">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ selectedParameter.name }}</div>
        </q-card-section>
        
        <q-card-section>
          <div class="parameter-info">
            <div class="row q-mb-md">
              <div class="col-4 text-grey-7">Current:</div>
              <div class="col monospace">{{ formatValue(selectedParameter.currentValue) }}</div>
            </div>
            <div class="row q-mb-md">
              <div class="col-4 text-grey-7">Default:</div>
              <div class="col monospace">{{ formatValue(selectedParameter.defaultValue) }}</div>
            </div>
            <div class="row q-mb-md">
              <div class="col-4 text-grey-7">Status:</div>
              <div class="col">
                <q-chip
                  :label="selectedParameter.status"
                  :color="getStatusColor(selectedParameter.status)"
                  text-color="white"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkParametersStore } from '../../stores/mavlink-parameters'

interface ComparisonResult {
  name: string
  currentValue: number
  defaultValue: number
  status: 'Same' | 'Different' | 'Modified' | 'Missing'
  type: string
}

const $q = useQuasar()
const parametersStore = useMAVLinkParametersStore()

const compareOptions = ref({
  source: 'default',
  filter: 'all'
})

const hasCompared = ref(false)
const showInfoDialog = ref(false)
const selectedParameter = ref<ComparisonResult | null>(null)

const sourceOptions = [
  { label: 'Default Values', value: 'default' },
  { label: 'Factory Reset', value: 'factory' }
]

const filterOptions = [
  { label: 'All Parameters', value: 'all' },
  { label: 'Differences Only', value: 'different' },
  { label: 'Modified Only', value: 'modified' }
]

const comparisonColumns = [
  {
    name: 'name',
    label: 'Parameter',
    field: 'name',
    align: 'left' as const,
    style: 'font-family: monospace; font-weight: 500;'
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    align: 'center' as const,
    style: 'width: 100px'
  },
  {
    name: 'current',
    label: 'Current',
    field: 'currentValue',
    align: 'right' as const,
    style: 'width: 120px'
  },
  {
    name: 'default',
    label: 'Default',
    field: 'defaultValue',
    align: 'right' as const,
    style: 'width: 120px'
  },
  {
    name: 'difference',
    label: 'Difference',
    field: 'difference',
    align: 'center' as const,
    style: 'width: 120px'
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center' as const,
    style: 'width: 100px'
  }
]

const allComparisons = computed((): ComparisonResult[] => {
  const current = parametersStore.parameters.data || {}
  const results: ComparisonResult[] = []
  
  for (const [name, param] of Object.entries(current)) {
    const defaultValue = param.defaultValue ?? param.value // Fallback if no default
    const isModified = parametersStore.modifiedParameters.has(name)
    
    let status: ComparisonResult['status']
    if (param.value === defaultValue) {
      status = 'Same'
    } else if (isModified) {
      status = 'Modified'
    } else {
      status = 'Different'
    }
    
    results.push({
      name,
      currentValue: param.value,
      defaultValue,
      status,
      type: param.type
    })
  }
  
  return results.sort((a, b) => a.name.localeCompare(b.name))
})

const comparisonResults = computed(() => {
  let results = allComparisons.value
  
  switch (compareOptions.value.filter) {
    case 'different':
      results = results.filter(r => r.status === 'Different' || r.status === 'Modified')
      break
    case 'modified':
      results = results.filter(r => r.status === 'Modified')
      break
  }
  
  return results
})

// Set hasCompared in a watcher instead
watch(compareOptions, () => {
  hasCompared.value = true
})

const modifiedParameters = computed(() => 
  comparisonResults.value.filter(r => r.status === 'Modified')
)

function getStatusColor(status: string): string {
  switch (status) {
    case 'Same': return 'positive'
    case 'Different': return 'warning'
    case 'Modified': return 'info'
    case 'Missing': return 'negative'
    default: return 'grey'
  }
}

function getDifferenceIcon(result: ComparisonResult): string {
  if (result.currentValue > result.defaultValue) {
    return 'mdi-trending-up'
  } else if (result.currentValue < result.defaultValue) {
    return 'mdi-trending-down'
  }
  return 'mdi-equal'
}

function getDifferenceColor(result: ComparisonResult): string {
  const diff = Math.abs(result.currentValue - result.defaultValue)
  const base = Math.abs(result.defaultValue)
  const percentChange = base > 0 ? (diff / base) * 100 : 100
  
  if (percentChange > 50) return 'negative'
  if (percentChange > 10) return 'warning'
  return 'info'
}

function formatValue(value: number | undefined): string {
  if (value === undefined) return 'N/A'
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(6).replace(/\.?0+$/, '')
}

function formatDifference(result: ComparisonResult): string {
  const diff = result.currentValue - result.defaultValue
  const percentChange = result.defaultValue !== 0 
    ? Math.abs(diff / result.defaultValue) * 100 
    : 100
  
  const sign = diff > 0 ? '+' : ''
  return `${sign}${formatValue(diff)} (${percentChange.toFixed(1)}%)`
}

function resetToDefault(result: ComparisonResult) {
  $q.dialog({
    title: 'Reset Parameter',
    message: `Reset ${result.name} to its default value (${formatValue(result.defaultValue)})?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await parametersStore.setParameter(result.name, result.defaultValue)
        parametersStore.clearModifiedFlag(result.name)
        
        $q.notify({
          type: 'positive',
          message: `Parameter ${result.name} reset to default`,
          position: 'top'
        })
      } catch (error) {
        $q.notify({
          type: 'negative',
          message: 'Failed to reset parameter',
          caption: error instanceof Error ? error.message : String(error),
          position: 'top'
        })
      }
    })()
  })
}

function resetAllModified() {
  $q.dialog({
    title: 'Reset All Modified Parameters',
    message: `Reset ${modifiedParameters.value.length} modified parameters to their default values?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        for (const param of modifiedParameters.value) {
          await parametersStore.setParameter(param.name, param.defaultValue)
          parametersStore.clearModifiedFlag(param.name)
        }
        
        $q.notify({
          type: 'positive',
          message: `${modifiedParameters.value.length} parameters reset to defaults`,
          position: 'top'
        })
      } catch (error) {
        $q.notify({
          type: 'negative',
          message: 'Failed to reset parameters',
          caption: error instanceof Error ? error.message : String(error),
          position: 'top'
        })
      }
    })()
  })
}

function showParameterInfo(result: ComparisonResult) {
  selectedParameter.value = result
  showInfoDialog.value = true
}

// Reset comparison when source changes
watch(() => compareOptions.value.source, () => {
  hasCompared.value = false
})
</script>

<style lang="scss" scoped>
.monospace {
  font-family: monospace;
}

.parameter-info {
  font-size: 14px;
}
</style>