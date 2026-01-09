<template>
  <div class="machine-maintenance">
    <!-- Maintenance Status Overview -->
    <div class="machine-maintenance__overview">
      <q-card class="machine-maintenance__status-card">
        <q-card-section>
          <div class="machine-maintenance__status-header">
            <h6 class="q-mt-none q-mb-md">Maintenance Status</h6>
            <q-badge
              :color="getMaintenanceStatusColor(maintenanceStatus.level)"
              :label="maintenanceStatus.level.toUpperCase()"
              class="machine-maintenance__status-badge"
            />
          </div>

          <div class="machine-maintenance__status-grid">
            <div class="machine-maintenance__status-item">
              <q-circular-progress
                :value="maintenanceStatus.overall"
                size="80px"
                :thickness="0.15"
                :color="getMaintenanceStatusColor(maintenanceStatus.level)"
                track-color="grey-3"
              >
                <div class="text-h6 text-weight-bold">{{ maintenanceStatus.overall }}%</div>
              </q-circular-progress>
              <div class="text-center q-mt-sm">
                <div class="text-subtitle2">Overall Health</div>
                <div class="text-caption text-grey-6">{{ maintenanceStatus.description }}</div>
              </div>
            </div>

            <div class="machine-maintenance__status-details">
              <div class="machine-maintenance__detail-item">
                <q-icon name="schedule" color="primary" />
                <div>
                  <div class="text-subtitle2">Next Service</div>
                  <div class="text-body2">
                    {{ formatNextService(maintenanceStatus.nextService) }}
                  </div>
                </div>
              </div>

              <div class="machine-maintenance__detail-item">
                <q-icon name="build" color="secondary" />
                <div>
                  <div class="text-subtitle2">Last Service</div>
                  <div class="text-body2">
                    {{ formatLastService(maintenanceStatus.lastService) }}
                  </div>
                </div>
              </div>

              <div class="machine-maintenance__detail-item">
                <q-icon
                  name="warning"
                  :color="maintenanceStatus.issues > 0 ? 'negative' : 'positive'"
                />
                <div>
                  <div class="text-subtitle2">Issues</div>
                  <div class="text-body2">{{ maintenanceStatus.issues }} active</div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Maintenance Items -->
    <div class="machine-maintenance__items">
      <h6 class="machine-maintenance__section-title">Maintenance Items</h6>

      <div class="row q-gutter-md">
        <div v-for="item in maintenanceItems" :key="item.id" class="col-12 col-md-6 col-lg-4">
          <q-card
            class="machine-maintenance__item-card"
            :class="{
              'machine-maintenance__item-card--warning': item.status === 'due',
              'machine-maintenance__item-card--error': item.status === 'overdue'
            }"
          >
            <q-card-section>
              <div class="machine-maintenance__item-header">
                <q-icon :name="item.icon" :color="getItemStatusColor(item.status)" size="24px" />
                <div class="machine-maintenance__item-title">
                  {{ item.name }}
                </div>
                <q-badge
                  :color="getItemStatusColor(item.status)"
                  :label="item.status.toUpperCase()"
                  class="machine-maintenance__item-badge"
                />
              </div>

              <div class="machine-maintenance__item-details">
                <div class="machine-maintenance__item-progress">
                  <q-linear-progress
                    :value="item.progressPercent / 100"
                    :color="getItemStatusColor(item.status)"
                    size="8px"
                    rounded
                  />
                  <div class="text-caption text-center q-mt-xs">
                    {{ item.progressText }}
                  </div>
                </div>

                <div class="machine-maintenance__item-info">
                  <div class="text-body2"><strong>Interval:</strong> {{ item.interval }}</div>
                  <div class="text-body2">
                    <strong>Last Done:</strong> {{ formatDate(item.lastDone) }}
                  </div>
                  <div class="text-body2">
                    <strong>Next Due:</strong> {{ formatDate(item.nextDue) }}
                  </div>
                </div>

                <div v-if="item.description" class="machine-maintenance__item-description">
                  {{ item.description }}
                </div>
              </div>

              <div class="machine-maintenance__item-actions">
                <q-btn
                  v-if="item.status !== 'good'"
                  color="primary"
                  icon="build"
                  label="Schedule"
                  dense
                  class="q-mr-sm"
                  @click="scheduleMaintenance(item)"
                />

                <q-btn
                  color="positive"
                  icon="check"
                  label="Mark Done"
                  dense
                  outline
                  @click="markDone(item)"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Maintenance Schedule -->
    <div class="machine-maintenance__schedule">
      <h6 class="machine-maintenance__section-title">Maintenance Schedule</h6>

      <q-card class="machine-maintenance__schedule-card">
        <q-card-section>
          <div class="machine-maintenance__schedule-controls">
            <q-btn
              color="primary"
              icon="add"
              label="Schedule Maintenance"
              @click="showScheduleDialog = true"
            />

            <q-btn
              color="secondary"
              icon="calendar_today"
              label="View Calendar"
              outline
              @click="showCalendarDialog = true"
            />
          </div>

          <q-separator class="q-my-md" />

          <div class="machine-maintenance__upcoming">
            <h6 class="q-mt-none q-mb-md">Upcoming Maintenance</h6>

            <div v-if="upcomingMaintenance.length === 0" class="machine-maintenance__no-upcoming">
              <q-icon name="event_available" size="48px" class="text-grey-4" />
              <div class="text-grey-6 q-mt-sm">No upcoming maintenance scheduled</div>
            </div>

            <q-list v-else>
              <q-item
                v-for="maintenance in upcomingMaintenance"
                :key="maintenance.id"
                class="machine-maintenance__upcoming-item"
              >
                <q-item-section avatar>
                  <q-icon
                    :name="maintenance.icon"
                    :color="maintenance.urgent ? 'negative' : 'primary'"
                    size="24px"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ maintenance.title }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ maintenance.description }}
                  </q-item-label>
                  <q-item-label caption class="text-primary">
                    {{ formatScheduledDate(maintenance.scheduledDate) }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="machine-maintenance__upcoming-actions">
                    <q-badge
                      v-if="maintenance.urgent"
                      color="negative"
                      label="URGENT"
                      class="q-mb-sm"
                    />

                    <q-btn dense flat round icon="edit" @click="editMaintenance(maintenance)" />
                    <q-btn
                      dense
                      flat
                      round
                      icon="delete"
                      color="negative"
                      @click="deleteMaintenance(maintenance.id)"
                    />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Maintenance History -->
    <div class="machine-maintenance__history">
      <h6 class="machine-maintenance__section-title">Recent Maintenance</h6>

      <q-card class="machine-maintenance__history-card">
        <q-card-section>
          <q-timeline color="primary">
            <q-timeline-entry
              v-for="history in maintenanceHistory"
              :key="history.id"
              :color="history.success ? 'positive' : 'negative'"
              :icon="history.icon"
              :subtitle="formatDate(history.date)"
            >
              <template #title>
                {{ history.title }}
              </template>

              <div class="machine-maintenance__history-content">
                <div class="text-body2">{{ history.description }}</div>

                <div v-if="history.technician" class="text-caption text-grey-6 q-mt-sm">
                  Performed by: {{ history.technician }}
                </div>

                <div v-if="history.cost" class="text-caption text-grey-6">
                  Cost: ${{ history.cost }}
                </div>

                <div v-if="history.notes" class="machine-maintenance__history-notes q-mt-sm">
                  <div class="text-caption text-grey-6">Notes:</div>
                  <div class="text-body2">{{ history.notes }}</div>
                </div>
              </div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>
      </q-card>
    </div>

    <!-- Schedule Maintenance Dialog -->
    <q-dialog v-model="showScheduleDialog" position="right" full-height>
      <ScheduleMaintenanceDialog
        :machine="machine"
        @save="handleScheduleSave"
        @close="showScheduleDialog = false"
      />
    </q-dialog>

    <!-- Maintenance Calendar Dialog -->
    <q-dialog v-model="showCalendarDialog" maximized>
      <MaintenanceCalendarDialog :machine="machine" @close="showCalendarDialog = false" />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'

// Components
import ScheduleMaintenanceDialog from './ScheduleMaintenanceDialog.vue'
import MaintenanceCalendarDialog from './MaintenanceCalendarDialog.vue'

// Types
interface Machine {
  id: string
  name: string
}

interface MaintenanceItem {
  id: string
  name: string
  icon: string
  status: 'good' | 'due' | 'overdue'
  interval: string
  lastDone: string
  nextDue: string
  progressPercent: number
  progressText: string
  description?: string
}

interface UpcomingMaintenance {
  id: string
  title: string
  description: string
  icon: string
  scheduledDate: string
  urgent: boolean
}

interface MaintenanceHistory {
  id: string
  title: string
  description: string
  icon: string
  date: string
  success: boolean
  technician?: string
  cost?: number
  notes?: string
}

// Props
defineProps<{
  machine: Machine
}>()

// Emits
const emit = defineEmits<{
  schedule: [data: any]
  update: []
}>()

// Composables
const $q = useQuasar()

// Local state
const showScheduleDialog = ref(false)
const showCalendarDialog = ref(false)

// Mock data
const maintenanceStatus = ref({
  level: 'good' as 'good' | 'warning' | 'critical',
  overall: 85,
  description: 'All systems operating normally',
  nextService: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  lastService: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  issues: 1
})

const maintenanceItems = ref<MaintenanceItem[]>([
  {
    id: '1',
    name: 'Blade Sharpening',
    icon: 'content_cut',
    status: 'due',
    interval: 'Every 100 hours',
    lastDone: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    nextDue: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    progressPercent: 85,
    progressText: '85 of 100 hours',
    description: 'Blades need sharpening for optimal cutting performance'
  },
  {
    id: '2',
    name: 'Battery Maintenance',
    icon: 'battery_std',
    status: 'good',
    interval: 'Every 6 months',
    lastDone: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    nextDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    progressPercent: 50,
    progressText: '3 of 6 months'
  },
  {
    id: '3',
    name: 'Wheel Cleaning',
    icon: 'tire_repair',
    status: 'overdue',
    interval: 'Every 50 hours',
    lastDone: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    nextDue: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    progressPercent: 110,
    progressText: '55 of 50 hours (overdue)',
    description: 'Wheels require cleaning to prevent grass buildup'
  }
])

const upcomingMaintenance = ref<UpcomingMaintenance[]>([
  {
    id: '1',
    title: 'Blade Sharpening',
    description: 'Scheduled blade maintenance and sharpening',
    icon: 'content_cut',
    scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    urgent: true
  },
  {
    id: '2',
    title: 'General Inspection',
    description: 'Monthly general inspection and cleaning',
    icon: 'search',
    scheduledDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    urgent: false
  }
])

const maintenanceHistory = ref<MaintenanceHistory[]>([
  {
    id: '1',
    title: 'Software Update',
    description: 'Updated to firmware version 2.1.4',
    icon: 'system_update',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    success: true,
    technician: 'Auto Update'
  },
  {
    id: '2',
    title: 'Sensor Calibration',
    description: 'Recalibrated obstacle detection sensors',
    icon: 'tune',
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    success: true,
    technician: 'John Smith',
    cost: 75,
    notes: 'All sensors functioning within normal parameters'
  }
])

// Methods
const getMaintenanceStatusColor = (level: string) => {
  const colors = {
    good: 'positive',
    warning: 'warning',
    critical: 'negative'
  }
  return colors[level as keyof typeof colors] || 'grey'
}

const getItemStatusColor = (status: string) => {
  const colors = {
    good: 'positive',
    due: 'warning',
    overdue: 'negative'
  }
  return colors[status as keyof typeof colors] || 'grey'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

const formatNextService = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'Due now'
  } else if (diffDays === 1) {
    return 'Tomorrow'
  } else if (diffDays < 7) {
    return `In ${diffDays} days`
  } else {
    return date.toLocaleDateString()
  }
}

const formatLastService = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 30) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

const formatScheduledDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Tomorrow'
  } else if (diffDays < 7) {
    return `In ${diffDays} days`
  } else {
    return date.toLocaleDateString()
  }
}

const scheduleMaintenance = (item: MaintenanceItem) => {
  emit('schedule', {
    itemId: item.id,
    type: 'item_maintenance',
    scheduledDate: item.nextDue
  })

  $q.notify({
    type: 'positive',
    message: `${item.name} scheduled for maintenance`
  })
}

const markDone = async (item: MaintenanceItem) => {
  const confirmed = await $q
    .dialog({
      title: 'Mark as Done',
      message: `Mark "${item.name}" as completed?`,
      cancel: true,
      persistent: true
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    // Update item status
    item.status = 'good'
    item.lastDone = new Date().toISOString()
    item.progressPercent = 0
    item.progressText = '0 of ' + item.interval.split(' ')[1] + ' hours'

    $q.notify({
      type: 'positive',
      message: `${item.name} marked as completed`
    })

    emit('update')
  }
}

const editMaintenance = (maintenance: UpcomingMaintenance) => {
  $q.notify({
    type: 'info',
    message: `Edit maintenance: ${maintenance.title}`
  })
}

const deleteMaintenance = async (maintenanceId: string) => {
  const confirmed = await $q
    .dialog({
      title: 'Delete Maintenance',
      message: 'Are you sure you want to delete this scheduled maintenance?',
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    const index = upcomingMaintenance.value.findIndex(m => m.id === maintenanceId)
    if (index !== -1) {
      upcomingMaintenance.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: 'Maintenance deleted'
      })
    }
  }
}

const handleScheduleSave = (data: any) => {
  showScheduleDialog.value = false
  emit('schedule', data)
  emit('update')
}
</script>

<style lang="scss" scoped>
.machine-maintenance {
  padding: 24px;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.machine-maintenance__overview {
  margin-bottom: 32px;
}

.machine-maintenance__status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.machine-maintenance__status-badge {
  font-size: 0.7rem;
  font-weight: 600;
}

.machine-maintenance__status-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 32px;
  align-items: center;
}

.machine-maintenance__status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.machine-maintenance__status-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.machine-maintenance__detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.machine-maintenance__section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-maintenance__items {
  margin-bottom: 32px;
}

.machine-maintenance__item-card {
  height: 100%;

  &--warning {
    border-left: 4px solid var(--q-warning);
  }

  &--error {
    border-left: 4px solid var(--q-negative);
  }
}

.machine-maintenance__item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.machine-maintenance__item-title {
  flex: 1;
  font-weight: 600;
  font-size: 1rem;
}

.machine-maintenance__item-badge {
  font-size: 0.65rem;
  font-weight: 600;
}

.machine-maintenance__item-details {
  margin-bottom: 16px;
}

.machine-maintenance__item-progress {
  margin-bottom: 12px;
}

.machine-maintenance__item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.machine-maintenance__item-description {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--q-grey-7);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
    color: var(--q-grey-5);
  }
}

.machine-maintenance__item-actions {
  display: flex;
  gap: 8px;
}

.machine-maintenance__schedule {
  margin-bottom: 32px;
}

.machine-maintenance__schedule-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.machine-maintenance__no-upcoming {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  text-align: center;
}

.machine-maintenance__upcoming-item {
  border-radius: 8px;
  margin-bottom: 8px;

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.05);
  }
}

.machine-maintenance__upcoming-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.machine-maintenance__history {
  margin-bottom: 0;
}

.machine-maintenance__history-content {
  margin-top: 8px;
}

.machine-maintenance__history-notes {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-maintenance__status-grid {
    grid-template-columns: 1fr;
    gap: 24px;
    text-align: center;
  }

  .machine-maintenance__status-details {
    align-items: center;
  }
}

@media (max-width: 599px) {
  .machine-maintenance {
    padding: 16px;
  }

  .machine-maintenance__section-title {
    font-size: 1.1rem;
  }

  .machine-maintenance__schedule-controls {
    flex-direction: column;

    .q-btn {
      width: 100%;
    }
  }

  .machine-maintenance__item-actions {
    flex-direction: column;

    .q-btn {
      width: 100%;
    }
  }
}
</style>
