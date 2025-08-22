<template>
  <q-card class="task-details-dialog" v-if="task">
    <q-toolbar>
      <q-toolbar-title>Task Details</q-toolbar-title>
      <q-btn flat round dense icon="close" @click="$emit('close')" />
    </q-toolbar>

    <q-card-section>
      <!-- Task Header -->
      <div class="task-header q-mb-lg">
        <div class="row items-center">
          <div class="col">
            <div class="text-h5">{{ task.name }}</div>
            <div class="text-subtitle2 text-grey-7">{{ task.type }} task</div>
          </div>
          <div class="col-auto">
            <q-chip
              :color="getStatusColor(task.status)"
              text-color="white"
              :label="task.status"
              class="text-uppercase"
            />
          </div>
        </div>
      </div>

      <!-- Task Information Tabs -->
      <q-tabs
        v-model="activeTab"
        dense
        active-color="primary"
        indicator-color="primary"
        align="left"
        class="q-mb-md"
      >
        <q-tab name="overview" label="Overview" />
        <q-tab name="parameters" label="Parameters" />
        <q-tab name="execution" label="Execution Log" />
        <q-tab name="map" label="Map View" />
      </q-tabs>

      <q-tab-panels v-model="activeTab" animated>
        <!-- Overview Tab -->
        <q-tab-panel name="overview">
          <div class="overview-content">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-list>
                  <q-item>
                    <q-item-section>
                      <q-item-label overline>Description</q-item-label>
                      <q-item-label>{{ task.description || 'No description provided' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label overline>Priority</q-item-label>
                      <q-item-label>
                        <q-chip
                          :color="getPriorityColor(task.priority || 'medium')"
                          text-color="white"
                          size="sm"
                          :label="task.priority || 'medium'"
                        />
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="task.startTime">
                    <q-item-section>
                      <q-item-label overline>Started</q-item-label>
                      <q-item-label>{{ formatDateTime(task.startTime) }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="task.duration">
                    <q-item-section>
                      <q-item-label overline>Duration</q-item-label>
                      <q-item-label>{{ formatDuration(task.duration) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <div class="col-12 col-md-6">
                <q-list>
                  <q-item v-if="task.area">
                    <q-item-section>
                      <q-item-label overline>Coverage Area</q-item-label>
                      <q-item-label>{{ task.area }}m² covered</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="task.efficiency">
                    <q-item-section>
                      <q-item-label overline>Efficiency</q-item-label>
                      <q-item-label>
                        <q-linear-progress
                          :value="task.efficiency / 100"
                          :color="getEfficiencyColor(task.efficiency)"
                          size="20px"
                          rounded
                          class="q-mt-sm"
                        >
                          <div class="absolute-full flex flex-center">
                            <q-badge
                              color="white"
                              text-color="black"
                              :label="`${task.efficiency}%`"
                            />
                          </div>
                        </q-linear-progress>
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label overline>Created</q-item-label>
                      <q-item-label>{{ formatDateTime(task.createdAt) }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label overline>Last Updated</q-item-label>
                      <q-item-label>{{ formatDateTime(task.updatedAt) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Parameters Tab -->
        <q-tab-panel name="parameters">
          <div class="parameters-content">
            <div v-if="task.parameters" class="q-gutter-md">
              <q-card flat bordered v-for="(section, sectionName) in groupedParameters" :key="sectionName">
                <q-card-section>
                  <div class="text-subtitle1 q-mb-md text-capitalize">{{ sectionName }} Parameters</div>
                  <q-markup-table flat>
                    <tbody>
                      <tr v-for="(value, key) in section" :key="key">
                        <td class="text-left text-capitalize">{{ String(key).replace(/([A-Z])/g, ' $1') }}</td>
                        <td class="text-right">{{ formatParameterValue(value) }}</td>
                      </tr>
                    </tbody>
                  </q-markup-table>
                </q-card-section>
              </q-card>
            </div>
            <div v-else class="text-center text-grey-6 q-py-xl">
              <q-icon name="mdi-cog-outline" size="48px" />
              <div>No parameters configured</div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Execution Log Tab -->
        <q-tab-panel name="execution">
          <div class="execution-log">
            <q-timeline color="primary">
              <q-timeline-entry
                v-for="log in executionLog"
                :key="log.id"
                :title="log.message"
                :subtitle="formatDateTime(log.timestamp)"
                :icon="getLogIcon(log.level)"
                :color="getLogColor(log.level)"
              >
                <div v-if="log.details" class="text-caption text-grey-7">
                  {{ log.details }}
                </div>
              </q-timeline-entry>
            </q-timeline>
          </div>
        </q-tab-panel>

        <!-- Map View Tab -->
        <q-tab-panel name="map">
          <div class="map-view">
            <div v-if="task.area" class="q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Task Area</div>
              <div class="map-placeholder">
                <div class="text-center q-pa-xl">
                  <q-icon name="mdi-map" size="48px" color="grey-5" />
                  <div class="q-mt-md">Map view would show task coverage area</div>
                  <div class="text-caption text-grey-7">
                    Area: {{ task.area }}m² | Path: {{ task.parameters?.pattern || 'N/A' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card-section>

    <q-card-actions align="right">
      <q-btn
        v-if="task.status === 'completed'"
        flat
        color="primary"
        label="Repeat Task"
        @click="repeatTask"
      />
      <q-btn flat label="Close" @click="$emit('close')" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TaskMetadata } from '../../stores/tasks'

interface Props {
  task: TaskMetadata & {
    type?: string
    parameters?: Record<string, unknown>
    area?: { width: number; height: number; centerLat: number; centerLng: number }
    priority?: string
    efficiency?: number
    estimatedDuration?: number
    actualDuration?: number
    startTime?: number
    endTime?: number
    duration?: number
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  repeat: [task: Props['task']]
}>()

// const $q = useQuasar() // Commented out as it's not used
const activeTab = ref('overview')

// Mock execution log data
const executionLog = computed(() => [
  {
    id: '1',
    timestamp: Date.now() - 1800000,
    level: 'info',
    message: 'Task started',
    details: 'Initializing task parameters and safety checks'
  },
  {
    id: '2',
    timestamp: Date.now() - 1500000,
    level: 'info',
    message: 'Moving to start position',
    details: 'GPS lock acquired, heading to starting coordinates'
  },
  {
    id: '3',
    timestamp: Date.now() - 1200000,
    level: 'success',
    message: 'Task execution began',
    details: 'Starting mowing pattern execution'
  },
  {
    id: '4',
    timestamp: Date.now() - 300000,
    level: 'warning',
    message: 'Battery level low',
    details: 'Battery at 25%, continuing with caution'
  },
  {
    id: '5',
    timestamp: Date.now() - 60000,
    level: 'success',
    message: 'Task completed successfully',
    details: 'All objectives achieved, returning to dock'
  }
])

const groupedParameters = computed(() => {
  if (!props.task.parameters) return {}
  
  const grouped: Record<string, Record<string, unknown>> = {}
  
  Object.entries(props.task.parameters).forEach(([key, value]) => {
    let category = 'general'
    
    if (key.includes('area') || key.includes('width') || key.includes('height')) {
      category = 'area'
    } else if (key.includes('speed') || key.includes('pattern') || key.includes('spacing')) {
      category = 'execution'
    } else if (key.includes('battery') || key.includes('threshold')) {
      category = 'safety'
    }
    
    if (!grouped[category]) grouped[category] = {}
    grouped[category]![key] = value
  })
  
  return grouped
})

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'completed': 'positive',
    'failed': 'negative',
    'running': 'primary',
    'pending': 'grey',
    'cancelled': 'warning'
  }
  return colors[status] || 'grey'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'high': 'negative',
    'medium': 'warning',
    'low': 'info'
  }
  return colors[priority] || 'grey'
}

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 80) return 'positive'
  if (efficiency >= 60) return 'warning'
  return 'negative'
}

function getLogIcon(level: string): string {
  const icons: Record<string, string> = {
    'info': 'mdi-information',
    'success': 'mdi-check',
    'warning': 'mdi-alert',
    'error': 'mdi-alert-circle'
  }
  return icons[level] || 'mdi-circle'
}

function getLogColor(level: string): string {
  const colors: Record<string, string> = {
    'info': 'primary',
    'success': 'positive',
    'warning': 'warning',
    'error': 'negative'
  }
  return colors[level] || 'grey'
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatParameterValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}

function repeatTask() {
  emit('repeat', props.task)
  emit('close')
}
</script>

<style lang="scss" scoped>
.task-details-dialog {
  min-width: 800px;
  max-width: 90vw;
}

.task-header {
  border-bottom: 1px solid $grey-3;
  padding-bottom: 16px;
  
  .body--dark & {
    border-color: $grey-8;
  }
}

.map-placeholder {
  height: 300px;
  border: 1px solid $grey-4;
  border-radius: 8px;
  background: $grey-1;
  
  .body--dark & {
    border-color: $grey-7;
    background: $grey-9;
  }
}

.execution-log {
  max-height: 400px;
  overflow-y: auto;
}
</style>