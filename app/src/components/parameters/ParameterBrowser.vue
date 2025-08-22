<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Parameter Browser</div>
          <div class="text-caption text-grey-7">
            {{ filteredParameters.length }} of {{ totalParameters }} parameters
          </div>
        </div>
        <div class="col-auto q-gutter-x-sm">
          <q-btn
            flat
            round
            dense
            icon="mdi-filter"
            @click="showFilters = !showFilters"
          >
            <q-badge v-if="activeFilters > 0" color="primary" floating>
              {{ activeFilters }}
            </q-badge>
            <q-tooltip>Filter parameters</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="mdi-download"
            @click="exportParameters"
          >
            <q-tooltip>Export parameters</q-tooltip>
          </q-btn>
          <q-btn
            round
            flat
            icon="refresh"
            @click="refreshParameters"
            :loading="loading"
          >
            <q-tooltip>Refresh parameters</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Filters -->
      <q-slide-transition>
        <div v-show="showFilters" class="q-mb-md">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-4">
              <q-input
                v-model="filters.search"
                label="Search parameters"
                dense
                clearable
                debounce="300"
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-4">
              <q-select
                v-model="filters.groups"
                label="Parameter Groups"
                :options="groupOptions"
                multiple
                use-chips
                dense
                clearable
              />
            </div>
            <div class="col-12 col-sm-4">
              <q-select
                v-model="filters.modified"
                label="Modified Status"
                :options="modifiedOptions"
                dense
                clearable
              />
            </div>
          </div>
        </div>
      </q-slide-transition>

      <!-- Parameter List -->
      <q-virtual-scroll
        :items="filteredParameters"
        virtual-scroll-slice-size="50"
        virtual-scroll-item-size="60"
        style="height: 400px"
        v-slot="{ item, index }"
      >
        <ParameterItem
          :key="item.name"
          :parameter="item"
          :index="index"
          @edit="editParameter"
          @reset="resetParameter"
        />
      </q-virtual-scroll>
    </q-card-section>

    <!-- Parameter Editor Dialog -->
    <ParameterEditDialog
      v-model="showEditDialog"
      :parameter="selectedParameter"
      @save="saveParameter"
    />
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkParametersStore } from '../../stores/mavlink-parameters'
import ParameterItem from './ParameterItem.vue'
import ParameterEditDialog from './ParameterEditDialog.vue'
import type { MAVLinkParameter } from '../../stores/mavlink-parameters'

const $q = useQuasar()
const parametersStore = useMAVLinkParametersStore()

const showFilters = ref(false)
const showEditDialog = ref(false)
const selectedParameter = ref<(MAVLinkParameter & { name: string }) | null>(null)
const filters = ref({
  search: '',
  groups: [] as string[],
  modified: ''
})

const modifiedOptions = [
  { label: 'All Parameters', value: '' },
  { label: 'Modified Only', value: 'modified' },
  { label: 'Default Only', value: 'default' }
]

const loading = computed(() => parametersStore.parameters.loading)
const totalParameters = computed(() => parametersStore.parameterCount)
const parameters = computed(() => parametersStore.parameterList)

const groupOptions = computed(() => {
  const groups = new Set<string>()
  parameters.value.forEach(param => {
    if (param.name.includes('_')) {
      const group = param.name.split('_')[0]
      if (group) {
        groups.add(group)
      }
    }
  })
  return Array.from(groups).sort().map(group => ({
    label: group,
    value: group
  }))
})

const activeFilters = computed(() => {
  let count = 0
  if (filters.value.search) count++
  if (filters.value.groups.length > 0) count++
  if (filters.value.modified) count++
  return count
})

const filteredParameters = computed(() => {
  let result = [...parameters.value]
  
  // Search filter
  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    result = result.filter(param =>
      param.name.toLowerCase().includes(search) ||
      (param.description && param.description.toLowerCase().includes(search))
    )
  }
  
  // Group filter
  if (filters.value.groups.length > 0) {
    result = result.filter(param => {
      if (!param.name.includes('_')) return false
      const group = param.name.split('_')[0]
      return group ? filters.value.groups.includes(group) : false
    })
  }
  
  // Modified filter
  if (filters.value.modified === 'modified') {
    result = result.filter(param => param.modified)
  } else if (filters.value.modified === 'default') {
    result = result.filter(param => !param.modified)
  }
  
  return result
})

async function refreshParameters() {
  try {
    await parametersStore.fetchParameters()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to refresh parameters',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function editParameter(parameter: MAVLinkParameter & { name: string }) {
  selectedParameter.value = parameter
  showEditDialog.value = true
}

async function saveParameter(name: string, value: number) {
  try {
    await parametersStore.setParameter(name, value)
    showEditDialog.value = false
    
    $q.notify({
      type: 'positive',
      message: `Parameter ${name} updated`,
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to update parameter',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function resetParameter(parameter: MAVLinkParameter & { name: string }) {
  $q.dialog({
    title: 'Reset Parameter',
    message: `Reset ${parameter.name} to its default value?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    try {
      parametersStore.resetParameter(parameter.name)
      
      $q.notify({
        type: 'positive',
        message: `Parameter ${parameter.name} reset`,
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
  })
}

function exportParameters() {
  try {
    const data = parametersStore.exportParameters()
    const blob = new Blob([data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `parameters-${Date.now()}.param`
    a.click()
    
    URL.revokeObjectURL(url)
    
    $q.notify({
      type: 'positive',
      message: 'Parameters exported',
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to export parameters',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

onMounted(() => {
  void refreshParameters()
})
</script>