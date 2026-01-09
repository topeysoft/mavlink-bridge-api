<template>
  <q-card class="schedule-maintenance-dialog" style="width: 500px; max-width: 90vw">
    <q-card-section class="schedule-maintenance-dialog__header">
      <div class="schedule-maintenance-dialog__title-section">
        <q-icon name="schedule" size="32px" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h6">Schedule Maintenance</div>
          <div class="text-subtitle2 text-grey-6">
            Schedule maintenance for {{ machine?.name || 'Unknown Machine' }}
          </div>
        </div>
      </div>

      <q-btn flat round icon="close" @click="closeDialog" />
    </q-card-section>

    <q-separator />

    <q-card-section class="schedule-maintenance-dialog__content">
      <div v-if="machine" class="schedule-maintenance-dialog__form">
        <div class="q-gutter-md">
          <!-- Maintenance Type -->
          <q-select
            v-model="maintenanceData.type"
            :options="maintenanceTypes"
            label="Maintenance Type"
            outlined
            emit-value
            map-options
            required
          />

          <!-- Priority -->
          <q-select
            v-model="maintenanceData.priority"
            :options="priorityOptions"
            label="Priority"
            outlined
            emit-value
            map-options
            required
          />

          <!-- Scheduled Date -->
          <q-input
            v-model="maintenanceData.scheduledDate"
            type="date"
            label="Scheduled Date"
            outlined
            required
          />

          <!-- Description -->
          <q-input
            v-model="maintenanceData.description"
            type="textarea"
            label="Description"
            outlined
            rows="3"
            placeholder="Enter maintenance description or notes..."
          />

          <!-- Estimated Duration -->
          <q-input
            v-model="maintenanceData.estimatedDuration"
            type="number"
            label="Estimated Duration (hours)"
            outlined
            min="0.5"
            step="0.5"
          />

          <!-- Assigned Technician -->
          <q-input
            v-model="maintenanceData.assignedTo"
            label="Assigned Technician"
            outlined
            placeholder="Enter technician name or ID"
          />

          <!-- Parts Required -->
          <q-input
            v-model="maintenanceData.partsRequired"
            type="textarea"
            label="Parts Required"
            outlined
            rows="2"
            placeholder="List any parts that will be needed..."
          />
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right" class="q-pa-md">
      <q-btn flat label="Cancel" color="grey" @click="closeDialog" />
      <q-btn
        unelevated
        label="Schedule Maintenance"
        color="primary"
        :loading="saving"
        @click="saveMaintenance"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
interface Machine {
  id: string
  name: string
}

interface Props {
  machine: Machine | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  save: [maintenance: MaintenanceSchedule]
  close: []
}>()

// Types
interface MaintenanceSchedule {
  id?: string
  machineId: string
  type: string
  priority: string
  scheduledDate: string
  description: string
  estimatedDuration: number
  assignedTo: string
  partsRequired: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  createdAt: string
}

// Local state
const saving = ref(false)
const showDialog = computed(() => props.machine !== null)

const maintenanceData = ref({
  type: '',
  priority: 'medium',
  scheduledDate: '',
  description: '',
  estimatedDuration: 1,
  assignedTo: '',
  partsRequired: ''
})

// Options
const maintenanceTypes = [
  { label: 'Routine Inspection', value: 'routine' },
  { label: 'Blade Replacement', value: 'blade-replacement' },
  { label: 'Battery Service', value: 'battery-service' },
  { label: 'Software Update', value: 'software-update' },
  { label: 'Sensor Calibration', value: 'sensor-calibration' },
  { label: 'Cleaning', value: 'cleaning' },
  { label: 'Emergency Repair', value: 'emergency-repair' },
  { label: 'Preventive Maintenance', value: 'preventive' }
]

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' }
]

// Methods
const saveMaintenance = async () => {
  if (!props.machine) return

  saving.value = true

  try {
    const maintenance: MaintenanceSchedule = {
      id: `maint-${Date.now()}`,
      machineId: props.machine.id,
      type: maintenanceData.value.type,
      priority: maintenanceData.value.priority,
      scheduledDate: maintenanceData.value.scheduledDate,
      description: maintenanceData.value.description,
      estimatedDuration: maintenanceData.value.estimatedDuration,
      assignedTo: maintenanceData.value.assignedTo,
      partsRequired: maintenanceData.value.partsRequired,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    }

    emit('save', maintenance)
    closeDialog()
  } finally {
    saving.value = false
  }
}

const closeDialog = () => {
  // Reset form
  maintenanceData.value = {
    type: '',
    priority: 'medium',
    scheduledDate: '',
    description: '',
    estimatedDuration: 1,
    assignedTo: '',
    partsRequired: ''
  }

  emit('close')
}
</script>

<style scoped lang="scss">
.schedule-maintenance-dialog {
  &__header {
    background-color: var(--q-primary);
    color: white;

    .schedule-maintenance-dialog__title-section {
      display: flex;
      align-items: center;
    }
  }

  &__content {
    min-height: 400px;
  }

  &__form {
    max-width: 100%;
  }
}
</style>
