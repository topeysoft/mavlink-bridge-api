<template>
  <q-card class="maintenance-calendar-dialog">
    <q-card-section class="maintenance-calendar-dialog__header">
      <div class="maintenance-calendar-dialog__title-section">
        <q-icon name="calendar_month" size="32px" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h6">Maintenance Calendar</div>
          <div class="text-subtitle2 text-grey-6">
            View and manage maintenance schedule for {{ machine?.name || 'Unknown Machine' }}
          </div>
        </div>
      </div>

      <q-btn flat round icon="close" @click="closeDialog" />
    </q-card-section>

    <q-separator />

    <q-card-section class="maintenance-calendar-dialog__content">
      <div v-if="machine" class="maintenance-calendar-dialog__calendar">
        <!-- Calendar Controls -->
        <div class="maintenance-calendar-dialog__controls row items-center q-mb-md">
          <q-btn flat icon="chevron_left" @click="previousMonth" />
          <div class="text-h6 q-mx-md">
            {{ currentMonthYear }}
          </div>
          <q-btn flat icon="chevron_right" @click="nextMonth" />
          <q-space />
          <q-btn color="primary" label="Today" @click="goToToday" />
        </div>

        <!-- Calendar Grid -->
        <div class="maintenance-calendar-dialog__grid">
          <!-- Days of week header -->
          <div class="maintenance-calendar-dialog__week-header">
            <div
              v-for="day in daysOfWeek"
              :key="day"
              class="maintenance-calendar-dialog__day-header"
            >
              {{ day }}
            </div>
          </div>

          <!-- Calendar days -->
          <div class="maintenance-calendar-dialog__days">
            <div
              v-for="day in calendarDays"
              :key="`${day.date}-${day.isCurrentMonth}`"
              class="maintenance-calendar-dialog__day"
              :class="{
                'maintenance-calendar-dialog__day--other-month': !day.isCurrentMonth,
                'maintenance-calendar-dialog__day--today': day.isToday,
                'maintenance-calendar-dialog__day--has-maintenance': day.hasMaintenance
              }"
              @click="selectDay(day)"
            >
              <div class="maintenance-calendar-dialog__day-number">
                {{ day.date.getDate() }}
              </div>
              <div v-if="day.hasMaintenance" class="maintenance-calendar-dialog__day-indicator">
                {{ day.maintenanceCount }}
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Day Details -->
        <div
          v-if="selectedDay && selectedDayMaintenance.length > 0"
          class="maintenance-calendar-dialog__details q-mt-lg"
        >
          <h6 class="q-mb-md">Maintenance for {{ selectedDay.date.toLocaleDateString() }}</h6>
          <q-list bordered>
            <q-item
              v-for="maintenance in selectedDayMaintenance"
              :key="maintenance.id"
              class="maintenance-calendar-dialog__maintenance-item"
            >
              <q-item-section avatar>
                <q-icon
                  :name="getMaintenanceIcon(maintenance.type)"
                  :color="getPriorityColor(maintenance.priority)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ getMaintenanceTypeLabel(maintenance.type) }}</q-item-label>
                <q-item-label caption>
                  {{ maintenance.description || 'No description' }}
                </q-item-label>
                <q-item-label caption>
                  Priority: {{ maintenance.priority }} | Duration:
                  {{ maintenance.estimatedDuration }}h
                  <span v-if="maintenance.assignedTo">
                    | Assigned to: {{ maintenance.assignedTo }}
                  </span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="getStatusColor(maintenance.status)" :label="maintenance.status" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right" class="q-pa-md">
      <q-btn flat label="Close" color="grey" @click="closeDialog" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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
  close: []
}>()

// Types
interface MaintenanceItem {
  id: string
  machineId: string
  type: string
  priority: string
  scheduledDate: string
  description: string
  estimatedDuration: number
  assignedTo: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  hasMaintenance: boolean
  maintenanceCount: number
}

// Local state
const currentDate = ref(new Date())
const selectedDay = ref<CalendarDay | null>(null)

// Mock maintenance data
const maintenanceItems = ref<MaintenanceItem[]>([
  {
    id: '1',
    machineId: props.machine?.id || '',
    type: 'routine',
    priority: 'medium',
    scheduledDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days from now
    description: 'Regular maintenance check',
    estimatedDuration: 2,
    assignedTo: 'John Doe',
    status: 'scheduled'
  },
  {
    id: '2',
    machineId: props.machine?.id || '',
    type: 'blade-replacement',
    priority: 'high',
    scheduledDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // 7 days from now
    description: 'Replace worn blades',
    estimatedDuration: 1,
    assignedTo: 'Jane Smith',
    status: 'scheduled'
  }
])

// Computed
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  // First day of the month
  const firstDay = new Date(year, month, 1)
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)

  // Start from the Sunday before the first day
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  // End on the Saturday after the last day
  const endDate = new Date(lastDay)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

  const days: CalendarDay[] = []
  const current = new Date(startDate)
  const today = new Date()

  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0]
    const dayMaintenance = maintenanceItems.value.filter(item => item.scheduledDate === dateKey)

    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === month,
      isToday: current.toDateString() === today.toDateString(),
      hasMaintenance: dayMaintenance.length > 0,
      maintenanceCount: dayMaintenance.length
    })

    current.setDate(current.getDate() + 1)
  }

  return days
})

const selectedDayMaintenance = computed(() => {
  if (!selectedDay.value) return []

  const dateKey = selectedDay.value.date.toISOString().split('T')[0]
  return maintenanceItems.value.filter(item => item.scheduledDate === dateKey)
})

// Methods
const previousMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

const goToToday = () => {
  currentDate.value = new Date()
}

const selectDay = (day: CalendarDay) => {
  selectedDay.value = day
}

const getMaintenanceIcon = (type: string) => {
  const icons: Record<string, string> = {
    routine: 'schedule',
    'blade-replacement': 'build',
    'battery-service': 'battery_charging_full',
    'software-update': 'system_update',
    'sensor-calibration': 'tune',
    cleaning: 'cleaning_services',
    'emergency-repair': 'priority_high',
    preventive: 'health_and_safety'
  }
  return icons[type] || 'build'
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: 'green',
    medium: 'orange',
    high: 'red',
    critical: 'purple'
  }
  return colors[priority] || 'grey'
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    scheduled: 'blue',
    'in-progress': 'orange',
    completed: 'green',
    cancelled: 'red'
  }
  return colors[status] || 'grey'
}

const getMaintenanceTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    routine: 'Routine Inspection',
    'blade-replacement': 'Blade Replacement',
    'battery-service': 'Battery Service',
    'software-update': 'Software Update',
    'sensor-calibration': 'Sensor Calibration',
    cleaning: 'Cleaning',
    'emergency-repair': 'Emergency Repair',
    preventive: 'Preventive Maintenance'
  }
  return labels[type] || type
}

const closeDialog = () => {
  selectedDay.value = null
  emit('close')
}

// Lifecycle
onMounted(() => {
  // Load maintenance data for the machine
  if (props.machine) {
    // In a real app, you would fetch this data from an API
    console.log(`Loading maintenance calendar for machine: ${props.machine.name}`)
  }
})
</script>

<style scoped lang="scss">
.maintenance-calendar-dialog {
  width: 800px;
  max-width: 95vw;
  height: 700px;
  max-height: 95vh;

  &__header {
    background-color: var(--q-primary);
    color: white;

    .maintenance-calendar-dialog__title-section {
      display: flex;
      align-items: center;
    }
  }

  &__content {
    height: calc(100% - 120px);
    overflow-y: auto;
  }

  &__controls {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
  }

  &__grid {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }

  &__week-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #f8f9fa;
  }

  &__day-header {
    padding: 12px;
    text-align: center;
    font-weight: 600;
    border-right: 1px solid #e0e0e0;

    &:last-child {
      border-right: none;
    }
  }

  &__days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  &__day {
    min-height: 80px;
    border-right: 1px solid #e0e0e0;
    border-bottom: 1px solid #e0e0e0;
    padding: 8px;
    cursor: pointer;
    position: relative;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f0f0f0;
    }

    &:nth-child(7n) {
      border-right: none;
    }

    &--other-month {
      background-color: #fafafa;
      color: #bbb;
    }

    &--today {
      background-color: #e3f2fd;

      .maintenance-calendar-dialog__day-number {
        color: #1976d2;
        font-weight: bold;
      }
    }

    &--has-maintenance {
      background-color: #fff3e0;

      &.maintenance-calendar-dialog__day--today {
        background-color: #e1f5fe;
      }
    }
  }

  &__day-number {
    font-size: 14px;
    margin-bottom: 4px;
  }

  &__day-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #ff9800;
    color: white;
    border-radius: 10px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }

  &__details {
    background: #f8f9fa;
    padding: 16px;
    border-radius: 8px;
  }

  &__maintenance-item {
    background: white;
    margin-bottom: 8px;
    border-radius: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
