<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    maximized
  >
    <q-card>
      <q-toolbar>
        <q-toolbar-title>Create Task</q-toolbar-title>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-toolbar>

      <q-card-section class="task-wizard">
        <q-stepper
          v-model="step"
          vertical
          color="primary"
          animated
          header-nav
        >
          <!-- Step 1: Basic Info -->
          <q-step
            :name="1"
            title="Task Information"
            icon="mdi-information"
            :done="step > 1"
          >
            <div class="q-gutter-md">
              <q-input
                v-model="taskData.name"
                label="Task Name"
                hint="A descriptive name for this task"
                :rules="[val => !!val || 'Name is required']"
              />
              
              <q-textarea
                v-model="taskData.description"
                label="Description"
                hint="Detailed description of what this task does"
                rows="3"
              />

              <q-select
                v-model="taskData.type"
                :options="taskTypeOptions"
                label="Task Type"
                emit-value
                map-options
                :rules="[val => !!val || 'Type is required']"
              />

              <q-select
                v-model="taskData.priority"
                :options="priorityOptions"
                label="Priority"
                emit-value
                map-options
              />
            </div>

            <q-stepper-navigation>
              <q-btn
                @click="step = 2"
                color="primary"
                label="Continue"
                :disable="!taskData.name || !taskData.type"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 2: Parameters -->
          <q-step
            :name="2"
            title="Task Parameters"
            icon="mdi-cog"
            :done="step > 2"
          >
            <div class="q-gutter-md">
              <!-- Mowing Parameters -->
              <div v-if="taskData.type === 'mowing'" class="parameter-section">
                <div class="text-subtitle1 q-mb-md">Mowing Parameters</div>
                
                <q-input
                  v-model.number="taskData.parameters.area.width"
                  label="Area Width (m)"
                  type="number"
                  min="1"
                />
                <q-input
                  v-model.number="taskData.parameters.area.height"
                  label="Area Height (m)"
                  type="number"
                  min="1"
                />
                <q-input
                  v-model.number="taskData.parameters.spacing"
                  label="Cut Spacing (m)"
                  type="number"
                  min="0.5"
                  step="0.1"
                />
                <q-input
                  v-model.number="taskData.parameters.height"
                  label="Cut Height (cm)"
                  type="number"
                  min="1"
                  max="10"
                />
                <q-select
                  v-model="taskData.parameters.pattern"
                  :options="mowingPatterns"
                  label="Mowing Pattern"
                  emit-value
                  map-options
                />
              </div>

              <!-- Survey Parameters -->
              <div v-if="taskData.type === 'survey'" class="parameter-section">
                <div class="text-subtitle1 q-mb-md">Survey Parameters</div>
                
                <q-input
                  v-model.number="taskData.parameters.altitude"
                  label="Survey Altitude (m)"
                  type="number"
                  min="1"
                  max="50"
                />
                <q-input
                  v-model.number="taskData.parameters.overlap"
                  label="Image Overlap (%)"
                  type="number"
                  min="20"
                  max="80"
                />
                <q-input
                  v-model.number="taskData.parameters.resolution"
                  label="Ground Resolution (cm/px)"
                  type="number"
                  min="0.5"
                  step="0.1"
                />
                <q-select
                  v-model="taskData.parameters.camera"
                  :options="cameraSettings"
                  label="Camera Settings"
                  emit-value
                  map-options
                />
              </div>

              <!-- Common Parameters -->
              <div class="parameter-section">
                <div class="text-subtitle1 q-mb-md">Execution Parameters</div>
                
                <q-input
                  v-model.number="taskData.parameters.speed"
                  label="Maximum Speed (m/s)"
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.1"
                />
                <q-input
                  v-model.number="taskData.parameters.batteryThreshold"
                  label="Minimum Battery (%)"
                  type="number"
                  min="10"
                  max="50"
                />
                <q-toggle
                  v-model="taskData.parameters.returnToStart"
                  label="Return to start position after completion"
                />
              </div>
            </div>

            <q-stepper-navigation>
              <q-btn
                flat
                @click="step = 1"
                color="primary"
                label="Back"
                class="q-mr-sm"
              />
              <q-btn
                @click="step = 3"
                color="primary"
                label="Continue"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 3: Area Selection -->
          <q-step
            :name="3"
            title="Area Definition"
            icon="mdi-map"
            :done="step > 3"
          >
            <div class="area-selection">
              <p>Define the area where this task will be executed:</p>
              
              <q-tabs
                v-model="areaMethod"
                dense
                active-color="primary"
                indicator-color="primary"
                class="q-mb-md"
              >
                <q-tab name="draw" label="Draw on Map" />
                <q-tab name="coordinates" label="Enter Coordinates" />
                <q-tab name="existing" label="Use Existing Area" />
              </q-tabs>

              <q-tab-panels v-model="areaMethod" animated>
                <q-tab-panel name="draw">
                  <div class="map-container">
                    <MapContainer
                      :center="mapCenter"
                      :zoom="15"
                      @area-defined="onAreaDefined"
                    />
                  </div>
                </q-tab-panel>

                <q-tab-panel name="coordinates">
                  <div class="coordinates-input q-gutter-md">
                    <q-input
                      v-model.number="taskData.area.centerLat"
                      label="Center Latitude"
                      type="number"
                      step="any"
                    />
                    <q-input
                      v-model.number="taskData.area.centerLng"
                      label="Center Longitude"
                      type="number"
                      step="any"
                    />
                    <div class="row q-col-gutter-sm">
                      <div class="col">
                        <q-input
                          v-model.number="taskData.area.width"
                          label="Width (m)"
                          type="number"
                          min="1"
                        />
                      </div>
                      <div class="col">
                        <q-input
                          v-model.number="taskData.area.height"
                          label="Height (m)"
                          type="number"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="existing">
                  <q-list>
                    <q-item
                      v-for="area in savedAreas"
                      :key="area.id"
                      clickable
                      @click="selectExistingArea(area)"
                      :active="selectedAreaId === area.id"
                    >
                      <q-item-section>
                        <q-item-label>{{ area.name }}</q-item-label>
                        <q-item-label caption>
                          {{ area.width }}m × {{ area.height }}m
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-tab-panel>
              </q-tab-panels>
            </div>

            <q-stepper-navigation>
              <q-btn
                flat
                @click="step = 2"
                color="primary"
                label="Back"
                class="q-mr-sm"
              />
              <q-btn
                @click="step = 4"
                color="primary"
                label="Continue"
                :disable="!isAreaValid"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 4: Schedule -->
          <q-step
            :name="4"
            title="Schedule"
            icon="mdi-calendar"
            :done="step > 4"
          >
            <div class="schedule-section q-gutter-md">
              <q-select
                v-model="taskData.schedule.type"
                :options="scheduleTypes"
                label="Schedule Type"
                emit-value
                map-options
              />

              <div v-if="taskData.schedule.type === 'once'">
                <q-input
                  v-model="taskData.schedule.datetime"
                  label="Execution Date & Time"
                  type="datetime-local"
                />
              </div>

              <div v-if="taskData.schedule.type === 'recurring'">
                <q-select
                  v-model="taskData.schedule.frequency"
                  :options="frequencyOptions"
                  label="Frequency"
                  emit-value
                  map-options
                />
                
                <q-input
                  v-model="taskData.schedule.startDate"
                  label="Start Date"
                  type="date"
                />
                
                <q-input
                  v-model="taskData.schedule.endDate"
                  label="End Date (optional)"
                  type="date"
                />

                <q-time
                  v-model="taskData.schedule.time"
                  format24h
                  class="q-mt-md"
                />
              </div>

              <q-toggle
                v-model="taskData.schedule.enabled"
                label="Enable automatic execution"
              />
            </div>

            <q-stepper-navigation>
              <q-btn
                flat
                @click="step = 3"
                color="primary"
                label="Back"
                class="q-mr-sm"
              />
              <q-btn
                @click="step = 5"
                color="primary"
                label="Continue"
              />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 5: Review -->
          <q-step
            :name="5"
            title="Review & Create"
            icon="mdi-check"
          >
            <div class="task-review">
              <div class="text-h6 q-mb-md">Task Summary</div>
              
              <q-list>
                <q-item>
                  <q-item-section>
                    <q-item-label overline>Name</q-item-label>
                    <q-item-label>{{ taskData.name }}</q-item-label>
                  </q-item-section>
                </q-item>
                
                <q-item>
                  <q-item-section>
                    <q-item-label overline>Type</q-item-label>
                    <q-item-label>{{ getTaskTypeLabel(taskData.type) }}</q-item-label>
                  </q-item-section>
                </q-item>
                
                <q-item>
                  <q-item-section>
                    <q-item-label overline>Area</q-item-label>
                    <q-item-label>
                      {{ taskData.area.width }}m × {{ taskData.area.height }}m
                      ({{ (taskData.area.width * taskData.area.height).toFixed(0) }}m²)
                    </q-item-label>
                  </q-item-section>
                </q-item>
                
                <q-item>
                  <q-item-section>
                    <q-item-label overline>Estimated Duration</q-item-label>
                    <q-item-label>{{ estimatedDuration }} minutes</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label overline>Schedule</q-item-label>
                    <q-item-label>{{ getScheduleDescription() }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <q-stepper-navigation>
              <q-btn
                flat
                @click="step = 4"
                color="primary"
                label="Back"
                class="q-mr-sm"
              />
              <q-btn
                @click="createTask"
                color="positive"
                label="Create Task"
                :loading="creating"
              />
            </q-stepper-navigation>
          </q-step>
        </q-stepper>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTaskStore } from '../../stores/tasks'
import type { TaskMetadata } from '../../stores/tasks'
import type { TaskData, TaskArea } from '../../stores/types'
import MapContainer from '../map/MapContainer.vue'

interface Props {
  modelValue: boolean
  template?: TaskData | undefined
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps<Props>()

// const props = defineProps<Props>() // Commented out as it's not used
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [task: TaskMetadata]
}>()

const $q = useQuasar()
const taskStore = useTaskStore()

const step = ref(1)
const creating = ref(false)
const areaMethod = ref('draw')
const selectedAreaId = ref('')

const taskData = ref({
  name: '',
  description: '',
  type: '',
  priority: 'medium',
  parameters: {
    area: { width: 20, height: 20 },
    spacing: 2,
    height: 5,
    pattern: 'parallel',
    altitude: 2,
    overlap: 20,
    resolution: 1.0,
    camera: 'high-res',
    speed: 1.5,
    batteryThreshold: 20,
    returnToStart: true
  },
  area: {
    centerLat: 40.7128,
    centerLng: -74.0060,
    width: 20,
    height: 20
  },
  schedule: {
    type: 'manual',
    enabled: false,
    datetime: '',
    frequency: 'daily',
    startDate: '',
    endDate: '',
    time: '09:00'
  }
})

const mapCenter = ref<[number, number]>([40.7128, -74.0060])
const savedAreas = ref([
  { id: '1', name: 'Front Yard', width: 15, height: 25 },
  { id: '2', name: 'Back Yard', width: 30, height: 20 },
  { id: '3', name: 'Side Garden', width: 10, height: 40 }
])

const taskTypeOptions = [
  { label: 'Lawn Mowing', value: 'mowing' },
  { label: 'Area Survey', value: 'survey' },
  { label: 'Perimeter Check', value: 'perimeter' },
  { label: 'Maintenance', value: 'maintenance' }
]

const priorityOptions = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
]

const mowingPatterns = [
  { label: 'Parallel Lines', value: 'parallel' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Perimeter First', value: 'perimeter-first' }
]

const cameraSettings = [
  { label: 'High Resolution', value: 'high-res' },
  { label: 'Medium Resolution', value: 'medium-res' },
  { label: 'Fast Survey', value: 'fast' }
]

const scheduleTypes = [
  { label: 'Manual Execution', value: 'manual' },
  { label: 'Execute Once', value: 'once' },
  { label: 'Recurring', value: 'recurring' }
]

const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
]

const isAreaValid = computed(() => {
  return taskData.value.area.width > 0 && taskData.value.area.height > 0
})

const estimatedDuration = computed(() => {
  const area = taskData.value.area.width * taskData.value.area.height
  const speed = taskData.value.parameters.speed
  const baseTime = area / (speed * 60) // minutes
  
  switch (taskData.value.type) {
    case 'mowing':
      return Math.ceil(baseTime * 1.5) // Factor in turns and overlap
    case 'survey':
      return Math.ceil(baseTime * 0.8) // Faster for survey
    default:
      return Math.ceil(baseTime)
  }
})

function getTaskTypeLabel(type: string): string {
  const option = taskTypeOptions.find(o => o.value === type)
  return option?.label || type
}

function getScheduleDescription(): string {
  const schedule = taskData.value.schedule
  
  if (schedule.type === 'manual') {
    return 'Manual execution only'
  } else if (schedule.type === 'once') {
    return `Execute once on ${schedule.datetime}`
  } else if (schedule.type === 'recurring') {
    return `${schedule.frequency} at ${schedule.time}`
  }
  
  return 'Not scheduled'
}

function onAreaDefined(area: TaskArea) {
  taskData.value.area = {
    centerLat: area.centerLat,
    centerLng: area.centerLng,
    width: area.width || 20,
    height: area.height || 20
  }
}

function selectExistingArea(area: { id: string; name: string; width: number; height: number }) {
  selectedAreaId.value = area.id
  taskData.value.area = {
    centerLat: 40.7128, // Would be loaded from saved area
    centerLng: -74.0060,
    width: area.width,
    height: area.height
  }
}

function createTask() {
  creating.value = true
  
  try {
    const task = taskStore.createTask(taskData.value)
    
    $q.notify({
      type: 'positive',
      message: 'Task created successfully',
      position: 'top'
    })
    
    emit('created', task)
    emit('update:modelValue', false)
    
    // Reset form
    step.value = 1
    taskData.value = {
      name: '',
      description: '',
      type: '',
      priority: 'medium',
      parameters: {
        area: { width: 20, height: 20 },
        spacing: 2,
        height: 5,
        pattern: 'parallel',
        altitude: 2,
        overlap: 20,
        resolution: 1.0,
        camera: 'high-res',
        speed: 1.5,
        batteryThreshold: 20,
        returnToStart: true
      },
      area: {
        centerLat: 40.7128,
        centerLng: -74.0060,
        width: 20,
        height: 20
      },
      schedule: {
        type: 'manual',
        enabled: false,
        datetime: '',
        frequency: 'daily',
        startDate: '',
        endDate: '',
        time: '09:00'
      }
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to create task',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  } finally {
    creating.value = false
  }
}
</script>

<style lang="scss" scoped>
.task-wizard {
  max-width: 800px;
  margin: 0 auto;
}

.parameter-section {
  background: $grey-1;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  
  .body--dark & {
    background: $grey-9;
  }
}

.map-container {
  height: 300px;
  border: 1px solid $grey-4;
  border-radius: 4px;
  
  .body--dark & {
    border-color: $grey-7;
  }
}

.coordinates-input {
  max-width: 400px;
}

.task-review {
  max-width: 500px;
}
</style>