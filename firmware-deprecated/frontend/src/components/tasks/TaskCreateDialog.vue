<template>
  <q-dialog :model-value="true" position="right" full-height @update:model-value="$emit('close')">
    <q-card style="width: 500px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Create Task</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="$emit('close')" />
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleSubmit">
          <div class="q-gutter-md">
            <!-- Basic Information -->
            <div class="text-subtitle2">Basic Information</div>

            <q-input
              v-model="taskData.title"
              label="Task Title"
              required
              outlined
              :rules="[val => !!val || 'Title is required']"
            />

            <q-select
              v-model="taskData.type"
              :options="taskTypeOptions"
              label="Task Type"
              required
              outlined
              @update:model-value="updateTaskTypeSettings"
            />

            <q-input
              v-model="taskData.description"
              label="Description"
              type="textarea"
              rows="3"
              outlined
            />

            <q-select
              v-model="taskData.priority"
              :options="priorityOptions"
              label="Priority"
              outlined
            />

            <!-- Machine Assignment -->
            <div class="text-subtitle2 q-mt-md">Machine Assignment</div>

            <q-select
              v-model="taskData.machineId"
              :options="availableMachines"
              label="Assign to Machine"
              outlined
              clearable
              hint="Leave empty for automatic assignment"
            />

            <!-- Zone Selection -->
            <div class="text-subtitle2 q-mt-md">Zone Selection</div>

            <q-select
              v-model="taskData.zones"
              :options="availableZones"
              label="Work Zones"
              multiple
              outlined
              hint="Select zones for this task"
            />

            <!-- Task Settings -->
            <div class="text-subtitle2 q-mt-md">Task Settings</div>

            <!-- Mowing Settings -->
            <div v-if="taskData.type === 'mowing'" class="q-gutter-md">
              <q-input
                v-model.number="taskData.settings.cuttingHeight"
                label="Cutting Height (mm)"
                type="number"
                min="20"
                max="100"
                outlined
              />

              <q-select
                v-model="taskData.settings.pattern"
                :options="mowingPatterns"
                label="Mowing Pattern"
                outlined
              />

              <div class="text-caption q-mb-sm">Speed: {{ taskData.settings.speed }}%</div>
              <q-slider
                v-model="taskData.settings.speed"
                :min="20"
                :max="100"
                :step="5"
                label
                :label-value="`${taskData.settings.speed}%`"
                color="primary"
              />
            </div>

            <!-- Trimming Settings -->
            <div v-if="taskData.type === 'trimming'" class="q-gutter-md">
              <q-input
                v-model.number="taskData.settings.trimHeight"
                label="Trim Height (mm)"
                type="number"
                min="10"
                max="50"
                outlined
              />

              <q-select
                v-model="taskData.settings.trimArea"
                :options="trimAreas"
                label="Trim Area"
                outlined
              />

              <q-toggle v-model="taskData.settings.edgeDetection" label="Enable Edge Detection" />
            </div>

            <!-- Maintenance Settings -->
            <div v-if="taskData.type === 'maintenance'" class="q-gutter-md">
              <q-select
                v-model="taskData.settings.maintenanceType"
                :options="maintenanceTypes"
                label="Maintenance Type"
                outlined
              />

              <q-input
                v-model.number="taskData.settings.duration"
                label="Estimated Duration (minutes)"
                type="number"
                min="5"
                max="120"
                outlined
              />

              <q-toggle
                v-model="taskData.settings.requiresSupervision"
                label="Requires Supervision"
              />
            </div>

            <!-- Custom Settings -->
            <div v-if="taskData.type === 'custom'" class="q-gutter-md">
              <q-input
                v-model="taskData.settings.customInstructions"
                label="Custom Instructions"
                type="textarea"
                rows="4"
                outlined
              />
            </div>

            <!-- Scheduling -->
            <div class="text-subtitle2 q-mt-md">Scheduling</div>

            <q-select
              v-model="schedulingOption"
              :options="schedulingOptions"
              label="When to Run"
              outlined
              @update:model-value="updateScheduling"
            />

            <div v-if="schedulingOption === 'scheduled'">
              <q-input
                v-model="taskData.scheduledFor"
                label="Scheduled Date & Time"
                type="datetime-local"
                outlined
              />
            </div>

            <!-- Advanced Options -->
            <q-expansion-item label="Advanced Options" icon="settings">
              <div class="q-pa-md q-gutter-md">
                <q-input
                  v-model.number="taskData.estimatedDuration"
                  label="Estimated Duration (minutes)"
                  type="number"
                  min="1"
                  max="480"
                  outlined
                />

                <q-input
                  v-model.number="taskData.maxRetries"
                  label="Max Retries on Failure"
                  type="number"
                  min="0"
                  max="5"
                  outlined
                />

                <q-toggle
                  v-model="taskData.settings.returnToBase"
                  label="Return to Base After Completion"
                />

                <q-toggle
                  v-model="taskData.settings.notifyOnCompletion"
                  label="Send Notification on Completion"
                />

                <q-select
                  v-model="taskData.settings.weatherConditions"
                  :options="weatherConditions"
                  label="Weather Requirements"
                  multiple
                  outlined
                />
              </div>
            </q-expansion-item>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn label="Cancel" color="grey" outline @click="$emit('close')" />
        <q-btn label="Create Task" color="primary" :loading="saving" @click="handleSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'

// Emits
const emit = defineEmits<{
  save: [task: any]
  close: []
}>()

// Composables
const $q = useQuasar()

// Local state
const saving = ref(false)
const schedulingOption = ref('immediate')

const taskData = ref({
  title: '',
  type: 'mowing',
  description: '',
  priority: 'medium',
  machineId: null,
  zones: [],
  scheduledFor: null,
  estimatedDuration: 30,
  maxRetries: 2,
  settings: {
    // Mowing settings
    cuttingHeight: 40,
    pattern: 'random',
    speed: 60,

    // Trimming settings
    trimHeight: 25,
    trimArea: 'edges',
    edgeDetection: true,

    // Maintenance settings
    maintenanceType: 'blade-cleaning',
    duration: 30,
    requiresSupervision: false,

    // Custom settings
    customInstructions: '',

    // Common settings
    returnToBase: true,
    notifyOnCompletion: true,
    weatherConditions: ['dry']
  }
})

// Options
const taskTypeOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Trimming', value: 'trimming' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
]

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' }
]

const schedulingOptions = [
  { label: 'Run Immediately', value: 'immediate' },
  { label: 'Schedule for Later', value: 'scheduled' }
]

const availableMachines = [
  { label: 'Mower-01 (Available)', value: 'mower-01' },
  { label: 'Mower-02 (Busy)', value: 'mower-02', disable: true },
  { label: 'Trimmer-01 (Available)', value: 'trimmer-01' },
  { label: 'Maintenance Bot (Available)', value: 'maintenance-01' }
]

const availableZones = [
  { label: 'Front Yard', value: 'front-yard' },
  { label: 'Back Yard', value: 'back-yard' },
  { label: 'Side Garden', value: 'side-garden' },
  { label: 'Perimeter', value: 'perimeter' },
  { label: 'Pool Area', value: 'pool-area' },
  { label: 'Entrance', value: 'entrance' }
]

const mowingPatterns = [
  { label: 'Random', value: 'random' },
  { label: 'Parallel Lines', value: 'parallel' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Checkerboard', value: 'checkerboard' }
]

const trimAreas = [
  { label: 'Edges Only', value: 'edges' },
  { label: 'Around Obstacles', value: 'obstacles' },
  { label: 'Full Perimeter', value: 'perimeter' },
  { label: 'Custom Areas', value: 'custom' }
]

const maintenanceTypes = [
  { label: 'Blade Cleaning', value: 'blade-cleaning' },
  { label: 'Sensor Calibration', value: 'sensor-calibration' },
  { label: 'Battery Check', value: 'battery-check' },
  { label: 'System Diagnostic', value: 'system-diagnostic' },
  { label: 'Filter Replacement', value: 'filter-replacement' }
]

const weatherConditions = [
  { label: 'Dry Weather Only', value: 'dry' },
  { label: 'Light Rain OK', value: 'light-rain' },
  { label: 'Any Weather', value: 'any' }
]

// Methods
const updateTaskTypeSettings = (newType: string) => {
  // Update estimated duration based on task type
  switch (newType) {
    case 'mowing':
      taskData.value.estimatedDuration = 45
      break
    case 'trimming':
      taskData.value.estimatedDuration = 25
      break
    case 'maintenance':
      taskData.value.estimatedDuration = 30
      break
    case 'custom':
      taskData.value.estimatedDuration = 30
      break
  }
}

const updateScheduling = (option: string) => {
  if (option === 'immediate') {
    taskData.value.scheduledFor = null
  }
}

const validateForm = () => {
  if (!taskData.value.title.trim()) {
    $q.notify({
      type: 'negative',
      message: 'Task title is required'
    })
    return false
  }

  if (taskData.value.zones.length === 0) {
    $q.notify({
      type: 'negative',
      message: 'At least one zone must be selected'
    })
    return false
  }

  if (schedulingOption.value === 'scheduled' && !taskData.value.scheduledFor) {
    $q.notify({
      type: 'negative',
      message: 'Scheduled date and time is required'
    })
    return false
  }

  return true
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  saving.value = true

  try {
    // Prepare task data
    const task = {
      ...taskData.value,
      id: Date.now().toString(),
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    emit('save', task)

    $q.notify({
      type: 'positive',
      message: 'Task created successfully'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to create task'
    })
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.q-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.q-card-section {
  &:nth-child(2) {
    flex: 1;
    overflow-y: auto;
  }
}

// Responsive adjustments
@media (max-width: 599px) {
  .q-card {
    width: 100vw !important;
    max-width: 100vw !important;
  }
}
</style>
