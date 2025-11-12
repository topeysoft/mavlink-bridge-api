<template>
  <div class="machine-detail-view">
    <!-- Header -->
    <div class="machine-detail-view__header">
      <div class="machine-detail-view__title-section">
        <q-btn flat round icon="arrow_back" class="q-mr-md" @click="$emit('back')" />
        <div>
          <h1 class="machine-detail-view__title">
            {{ machine.name }}
          </h1>
          <div class="machine-detail-view__subtitle">{{ machine.model }} • {{ machine.id }}</div>
        </div>
      </div>

      <div class="machine-detail-view__actions">
        <q-btn
          v-if="machine.status === 'idle'"
          color="positive"
          icon="play_arrow"
          label="Start"
          :loading="loading.start"
          @click="startMachine"
        />
        <q-btn
          v-else-if="machine.status === 'working'"
          color="warning"
          icon="pause"
          label="Pause"
          :loading="loading.pause"
          @click="pauseMachine"
        />
        <q-btn
          v-if="machine.status !== 'offline'"
          color="negative"
          icon="stop"
          label="Stop"
          :loading="loading.stop"
          outline
          @click="stopMachine"
        />
        <q-btn
          color="primary"
          icon="settings"
          label="Configure"
          outline
          @click="showConfigDialog = true"
        />
      </div>
    </div>

    <!-- Status Overview -->
    <div class="machine-detail-view__overview">
      <div class="row q-gutter-md">
        <div class="col-12 col-md-8">
          <q-card class="machine-detail-view__status-card">
            <q-card-section>
              <div class="machine-detail-view__status-grid">
                <!-- Current Status -->
                <div class="machine-detail-view__status-item">
                  <q-icon
                    :name="getStatusIcon(machine.status)"
                    :color="getStatusColor(machine.status)"
                    size="24px"
                  />
                  <div>
                    <div class="text-caption text-grey-6">Status</div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ machine.status.toUpperCase() }}
                    </div>
                  </div>
                </div>

                <!-- Battery Level -->
                <div class="machine-detail-view__status-item">
                  <q-icon
                    name="battery_std"
                    :color="getBatteryColor(machine.batteryLevel)"
                    size="24px"
                  />
                  <div>
                    <div class="text-caption text-grey-6">Battery</div>
                    <div class="text-subtitle1 text-weight-medium">{{ machine.batteryLevel }}%</div>
                  </div>
                </div>

                <!-- Signal Strength -->
                <div class="machine-detail-view__status-item">
                  <q-icon
                    name="signal_cellular_4_bar"
                    :color="getSignalColor(machine.signalStrength)"
                    size="24px"
                  />
                  <div>
                    <div class="text-caption text-grey-6">Signal</div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ machine.signalStrength }}%
                    </div>
                  </div>
                </div>

                <!-- Current Task -->
                <div class="machine-detail-view__status-item">
                  <q-icon name="assignment" color="primary" size="24px" />
                  <div>
                    <div class="text-caption text-grey-6">Current Task</div>
                    <div class="text-subtitle1 text-weight-medium">
                      {{ machine.currentTask || 'None' }}
                    </div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-4">
          <q-card class="machine-detail-view__location-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Location</h6>
              <div class="machine-detail-view__location">
                <q-icon name="location_on" color="negative" size="32px" />
                <div class="q-ml-sm">
                  <div class="text-subtitle2">
                    {{ machine.location.zone || 'Unknown Zone' }}
                  </div>
                  <div class="text-caption text-grey-6">
                    {{ machine.location.coordinates?.lat?.toFixed(6) }},
                    {{ machine.location.coordinates?.lng?.toFixed(6) }}
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Tabs Content -->
    <div class="machine-detail-view__content">
      <q-tabs v-model="activeTab" class="text-primary" indicator-color="primary" align="left">
        <q-tab name="diagnostics" icon="medical_services" label="Diagnostics" />
        <q-tab name="controls" icon="tune" label="Controls" />
        <q-tab name="history" icon="history" label="History" />
        <q-tab name="maintenance" icon="build" label="Maintenance" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- Diagnostics Panel -->
        <q-tab-panel name="diagnostics" class="q-pa-none">
          <MachineDiagnostics :machine="machine" @refresh="$emit('refresh')" />
        </q-tab-panel>

        <!-- Controls Panel -->
        <q-tab-panel name="controls" class="q-pa-none">
          <MachineControls :machine="machine" @command="handleCommand" @update="$emit('refresh')" />
        </q-tab-panel>

        <!-- History Panel -->
        <q-tab-panel name="history" class="q-pa-none">
          <MachineHistory :machine-id="machine.id" @task-selected="handleTaskSelected" />
        </q-tab-panel>

        <!-- Maintenance Panel -->
        <q-tab-panel name="maintenance" class="q-pa-none">
          <MachineMaintenance
            :machine="machine"
            @schedule="handleMaintenanceSchedule"
            @update="$emit('refresh')"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- Configuration Dialog -->
    <q-dialog v-model="showConfigDialog" position="right" full-height>
      <MachineConfigDialog
        :machine="machine"
        @save="handleConfigSave"
        @close="showConfigDialog = false"
      />
    </q-dialog>

    <!-- Emergency Stop Dialog -->
    <q-dialog v-model="showEmergencyDialog" persistent>
      <q-card class="q-pa-md">
        <q-card-section class="row items-center">
          <q-icon name="warning" color="negative" size="32px" />
          <span class="q-ml-sm text-h6">Emergency Stop</span>
        </q-card-section>

        <q-card-section>
          Are you sure you want to emergency stop {{ machine.name }}? This will immediately halt all
          operations.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showEmergencyDialog = false" />
          <q-btn
            color="negative"
            label="Emergency Stop"
            :loading="loading.emergency"
            @click="emergencyStop"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

// Components
import MachineDiagnostics from './MachineDiagnostics.vue'
import MachineControls from './MachineControls.vue'
import MachineHistory from './MachineHistory.vue'
import MachineMaintenance from './MachineMaintenance.vue'
import MachineConfigDialog from './MachineConfigDialog.vue'

// Types
interface Machine {
  id: string
  name: string
  model: string
  status: 'idle' | 'working' | 'charging' | 'error' | 'offline'
  batteryLevel: number
  signalStrength: number
  currentTask?: string
  location: {
    zone?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
}

interface Command {
  type: string
  params?: Record<string, any>
}

// Props
defineProps<{
  machine: Machine
}>()

// Emits
const emit = defineEmits<{
  back: []
  refresh: []
  command: [command: Command]
}>()

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('diagnostics')
const showConfigDialog = ref(false)
const showEmergencyDialog = ref(false)
const loading = ref({
  start: false,
  pause: false,
  stop: false,
  emergency: false
})

// Methods
const getStatusIcon = (status: string) => {
  const icons = {
    idle: 'pause_circle',
    working: 'play_circle',
    charging: 'battery_charging_full',
    error: 'error',
    offline: 'cloud_off'
  }
  return icons[status as keyof typeof icons] || 'help'
}

const getStatusColor = (status: string) => {
  const colors = {
    idle: 'grey-6',
    working: 'positive',
    charging: 'info',
    error: 'negative',
    offline: 'grey-4'
  }
  return colors[status as keyof typeof colors] || 'grey-6'
}

const getBatteryColor = (level: number) => {
  if (level > 60) return 'positive'
  if (level > 30) return 'warning'
  return 'negative'
}

const getSignalColor = (strength: number) => {
  if (strength > 70) return 'positive'
  if (strength > 40) return 'warning'
  return 'negative'
}

const startMachine = async () => {
  loading.value.start = true
  try {
    emit('command', { type: 'start' })
    $q.notify({
      type: 'positive',
      message: 'Machine started successfully'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to start machine'
    })
  } finally {
    loading.value.start = false
  }
}

const pauseMachine = async () => {
  loading.value.pause = true
  try {
    emit('command', { type: 'pause' })
    $q.notify({
      type: 'info',
      message: 'Machine paused'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to pause machine'
    })
  } finally {
    loading.value.pause = false
  }
}

const stopMachine = async () => {
  const confirmed = await $q
    .dialog({
      title: 'Stop Machine',
      message: 'Are you sure you want to stop this machine?',
      cancel: true,
      persistent: true
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (!confirmed) return

  loading.value.stop = true
  try {
    emit('command', { type: 'stop' })
    $q.notify({
      type: 'info',
      message: 'Machine stopped'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to stop machine'
    })
  } finally {
    loading.value.stop = false
  }
}

const emergencyStop = async () => {
  loading.value.emergency = true
  try {
    emit('command', { type: 'emergency_stop' })
    showEmergencyDialog.value = false
    $q.notify({
      type: 'warning',
      message: 'Emergency stop activated'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Emergency stop failed'
    })
  } finally {
    loading.value.emergency = false
  }
}

const handleCommand = (command: Command) => {
  emit('command', command)
}

const handleConfigSave = (config: any) => {
  showConfigDialog.value = false
  emit('command', { type: 'update_config', params: config })
  emit('refresh')
}

const handleTaskSelected = (taskId: string) => {
  // Handle task selection from history
  console.log('Selected task:', taskId)
}

const handleMaintenanceSchedule = (schedule: any) => {
  emit('command', { type: 'schedule_maintenance', params: schedule })
  emit('refresh')
}
</script>

<style lang="scss" scoped>
.machine-detail-view {
  min-height: 100vh;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.machine-detail-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark);
    border-bottom-color: var(--q-grey-8);
  }
}

.machine-detail-view__title-section {
  display: flex;
  align-items: center;
}

.machine-detail-view__title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-detail-view__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-top: 4px;
}

.machine-detail-view__actions {
  display: flex;
  gap: 8px;
}

.machine-detail-view__overview {
  padding: 24px;
}

.machine-detail-view__status-card {
  .q-card__section {
    padding: 24px;
  }
}

.machine-detail-view__status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.machine-detail-view__status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.machine-detail-view__location-card {
  height: fit-content;

  .q-card__section {
    padding: 24px;
  }
}

.machine-detail-view__location {
  display: flex;
  align-items: center;
}

.machine-detail-view__content {
  background: white;
  min-height: 400px;

  .body--dark & {
    background: var(--q-dark);
  }

  .q-tabs {
    padding: 0 24px;
  }

  .q-tab-panels {
    background: transparent;
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-detail-view__header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .machine-detail-view__title-section {
    width: 100%;
  }

  .machine-detail-view__actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 599px) {
  .machine-detail-view__header {
    padding: 16px;
  }

  .machine-detail-view__overview {
    padding: 16px;
  }

  .machine-detail-view__status-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .machine-detail-view__actions {
    flex-wrap: wrap;
    gap: 8px;

    .q-btn {
      flex: 1;
      min-width: 120px;
    }
  }

  .machine-detail-view__title {
    font-size: 1.5rem;
  }
}
</style>
