<template>
  <div class="machine-management-view">
    <!-- Header -->
    <div class="machine-management-view__header">
      <div class="machine-management-view__title-section">
        <h1 class="machine-management-view__title">Machine Management</h1>
        <div class="machine-management-view__subtitle">
          Monitor and control your robotic lawn mowers
        </div>
      </div>

      <div class="machine-management-view__actions">
        <q-btn
          color="primary"
          icon="add"
          label="Add Machine"
          @click="showAddMachineDialog = true"
        />
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="machine-management-view__stats">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6 col-md-3">
          <q-card class="machine-management-view__stat-card">
            <q-card-section class="text-center">
              <q-icon name="precision_manufacturing" size="32px" color="primary" />
              <div class="text-h6 q-mt-sm">{{ machines.length }}</div>
              <div class="text-caption text-grey-6">Total Machines</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card class="machine-management-view__stat-card">
            <q-card-section class="text-center">
              <q-icon name="play_circle" size="32px" color="positive" />
              <div class="text-h6 q-mt-sm">{{ activeMachines }}</div>
              <div class="text-caption text-grey-6">Active</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card class="machine-management-view__stat-card">
            <q-card-section class="text-center">
              <q-icon name="pause_circle" size="32px" color="warning" />
              <div class="text-h6 q-mt-sm">{{ idleMachines }}</div>
              <div class="text-caption text-grey-6">Idle</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card class="machine-management-view__stat-card">
            <q-card-section class="text-center">
              <q-icon name="warning" size="32px" color="negative" />
              <div class="text-h6 q-mt-sm">{{ errorMachines }}</div>
              <div class="text-caption text-grey-6">Errors</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="machine-management-view__content">
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey-6"
        active-color="primary"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="list" label="Machine List" icon="list" />
        <q-tab name="map" label="Location Map" icon="map" />
        <q-tab name="status" label="System Status" icon="monitor_heart" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- Machine List Tab -->
        <q-tab-panel name="list" class="q-pa-none">
          <div class="machine-management-view__list-container">
            <!-- Filters -->
            <div class="machine-management-view__filters">
              <q-input
                v-model="searchQuery"
                placeholder="Search machines..."
                outlined
                dense
                clearable
                class="machine-management-view__search"
              >
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>

              <q-select
                v-model="statusFilter"
                :options="statusOptions"
                label="Status"
                outlined
                dense
                class="machine-management-view__filter"
              />

              <q-select
                v-model="typeFilter"
                :options="typeOptions"
                label="Type"
                outlined
                dense
                class="machine-management-view__filter"
              />
            </div>

            <!-- Machine List -->
            <div class="machine-management-view__machines">
              <q-list separator>
                <q-item
                  v-for="machine in filteredMachines"
                  :key="machine.id"
                  clickable
                  class="machine-management-view__machine-item"
                  @click="selectMachine(machine)"
                >
                  <q-item-section avatar>
                    <q-avatar :color="getMachineStatusColor(machine.status)" text-color="white">
                      <q-icon :name="getMachineIcon(machine.type)" />
                    </q-avatar>
                  </q-item-section>

                  <q-item-section>
                    <q-item-label class="machine-management-view__machine-name">
                      {{ machine.name }}
                    </q-item-label>
                    <q-item-label caption> {{ machine.model }} • {{ machine.id }} </q-item-label>
                    <q-item-label caption>
                      Battery: {{ machine.battery }}% • Location:
                      {{ machine.currentZone || 'Unknown' }}
                    </q-item-label>
                  </q-item-section>

                  <q-item-section side>
                    <div class="machine-management-view__machine-status">
                      <q-chip
                        :color="getMachineStatusColor(machine.status)"
                        text-color="white"
                        :label="formatMachineStatus(machine.status)"
                        size="sm"
                      />
                      <div class="machine-management-view__machine-controls">
                        <q-btn
                          v-if="machine.status === 'idle'"
                          icon="play_arrow"
                          color="positive"
                          size="sm"
                          round
                          dense
                          @click.stop="startMachine(machine)"
                        >
                          <q-tooltip>Start Machine</q-tooltip>
                        </q-btn>
                        <q-btn
                          v-else-if="machine.status === 'working'"
                          icon="pause"
                          color="warning"
                          size="sm"
                          round
                          dense
                          @click.stop="pauseMachine(machine)"
                        >
                          <q-tooltip>Pause Machine</q-tooltip>
                        </q-btn>
                        <q-btn icon="more_vert" size="sm" round dense flat @click.stop>
                          <q-menu>
                            <q-list>
                              <q-item v-close-popup clickable @click="viewDetails(machine)">
                                <q-item-section avatar>
                                  <q-icon name="info" />
                                </q-item-section>
                                <q-item-section>View Details</q-item-section>
                              </q-item>
                              <q-item v-close-popup clickable @click="editMachine(machine)">
                                <q-item-section avatar>
                                  <q-icon name="edit" />
                                </q-item-section>
                                <q-item-section>Edit Machine</q-item-section>
                              </q-item>
                              <q-separator />
                              <q-item v-close-popup clickable @click="deleteMachine(machine)">
                                <q-item-section avatar>
                                  <q-icon name="delete" color="negative" />
                                </q-item-section>
                                <q-item-section class="text-negative">Delete</q-item-section>
                              </q-item>
                            </q-list>
                          </q-menu>
                        </q-btn>
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>

              <!-- Empty State -->
              <div v-if="filteredMachines.length === 0" class="machine-management-view__empty">
                <q-icon name="precision_manufacturing" size="64px" color="grey-4" />
                <div class="text-h6 text-grey-6 q-mt-md">
                  {{
                    machines.length === 0
                      ? 'No machines configured'
                      : 'No machines match your filters'
                  }}
                </div>
                <div class="text-body2 text-grey-5 q-mt-sm">
                  {{
                    machines.length === 0
                      ? 'Add your first robotic lawn mower to get started'
                      : 'Try adjusting your search or filters'
                  }}
                </div>
                <q-btn
                  v-if="machines.length === 0"
                  color="primary"
                  label="Add First Machine"
                  class="q-mt-md"
                  @click="showAddMachineDialog = true"
                />
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Location Map Tab -->
        <q-tab-panel name="map" class="q-pa-none">
          <div class="machine-management-view__map-container">
            <div class="machine-management-view__map-placeholder">
              <q-icon name="map" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">Machine Location Map</div>
              <div class="text-body2 text-grey-5 q-mt-sm">
                Real-time machine positions and yard coverage
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- System Status Tab -->
        <q-tab-panel name="status" class="q-pa-none">
          <div class="machine-management-view__status-container">
            <div class="machine-management-view__status-placeholder">
              <q-icon name="monitor_heart" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">System Status Overview</div>
              <div class="text-body2 text-grey-5 q-mt-sm">
                Real-time system health and performance metrics
              </div>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <!-- Machine Details Dialog -->
    <q-dialog
      v-model="showDetailsDialog"
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <MachineDetailView
        v-if="selectedMachine"
        :machine="selectedMachine"
        @back="showDetailsDialog = false"
        @update:machine="updateMachine"
      />
    </q-dialog>

    <!-- Add Machine Dialog -->
    <q-dialog v-model="showAddMachineDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add New Machine</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input v-model="newMachine.name" label="Machine Name" outlined class="q-mb-md" />
          <q-input v-model="newMachine.model" label="Model" outlined class="q-mb-md" />
          <q-select v-model="newMachine.type" :options="machineTypes" label="Type" outlined />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" color="grey" />
          <q-btn label="Add Machine" color="primary" @click="addMachine" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import MachineDetailView from './MachineDetailView.vue'

// Props
interface Machine {
  id: string
  name: string
  model: string
  type: string
  status: 'idle' | 'working' | 'charging' | 'error' | 'maintenance'
  battery: number
  currentZone?: string
  lastActivity: string
}

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('list')
const searchQuery = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const showDetailsDialog = ref(false)
const showAddMachineDialog = ref(false)
const selectedMachine = ref<Machine | null>(null)

const newMachine = ref({
  name: '',
  model: '',
  type: 'lawn_mower'
})

// Mock data
const machines = ref<Machine[]>([
  {
    id: 'YR001',
    name: 'YardRover Alpha',
    model: 'YR-3000X',
    type: 'lawn_mower',
    status: 'working',
    battery: 85,
    currentZone: 'Front Yard',
    lastActivity: '2025-09-04T10:30:00Z'
  },
  {
    id: 'YR002',
    name: 'YardRover Beta',
    model: 'YR-2500',
    type: 'lawn_mower',
    status: 'charging',
    battery: 45,
    currentZone: 'Docking Station',
    lastActivity: '2025-09-04T09:15:00Z'
  },
  {
    id: 'YR003',
    name: 'YardRover Gamma',
    model: 'YR-3000X',
    type: 'lawn_mower',
    status: 'idle',
    battery: 95,
    currentZone: 'Back Yard',
    lastActivity: '2025-09-04T08:00:00Z'
  }
])

// Filter options
const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Working', value: 'working' },
  { label: 'Idle', value: 'idle' },
  { label: 'Charging', value: 'charging' },
  { label: 'Error', value: 'error' },
  { label: 'Maintenance', value: 'maintenance' }
]

const typeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Lawn Mower', value: 'lawn_mower' },
  { label: 'Trimmer', value: 'trimmer' },
  { label: 'Mulcher', value: 'mulcher' }
]

const machineTypes = [
  { label: 'Lawn Mower', value: 'lawn_mower' },
  { label: 'Trimmer', value: 'trimmer' },
  { label: 'Mulcher', value: 'mulcher' }
]

// Computed
const filteredMachines = computed(() => {
  let filtered = machines.value

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(machine => machine.status === statusFilter.value)
  }

  // Apply type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(machine => machine.type === typeFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      machine =>
        machine.name.toLowerCase().includes(query) ||
        machine.model.toLowerCase().includes(query) ||
        machine.id.toLowerCase().includes(query)
    )
  }

  return filtered
})

const activeMachines = computed(() => machines.value.filter(m => m.status === 'working').length)
const idleMachines = computed(() => machines.value.filter(m => m.status === 'idle').length)
const errorMachines = computed(() => machines.value.filter(m => m.status === 'error').length)

// Methods
const getMachineStatusColor = (status: string) => {
  switch (status) {
    case 'working':
      return 'positive'
    case 'idle':
      return 'grey-6'
    case 'charging':
      return 'info'
    case 'error':
      return 'negative'
    case 'maintenance':
      return 'warning'
    default:
      return 'grey-5'
  }
}

const getMachineIcon = (type: string) => {
  switch (type) {
    case 'lawn_mower':
      return 'grass'
    case 'trimmer':
      return 'content_cut'
    case 'mulcher':
      return 'scatter_plot'
    default:
      return 'precision_manufacturing'
  }
}

const formatMachineStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
}

const selectMachine = (machine: Machine) => {
  selectedMachine.value = machine
  showDetailsDialog.value = true
}

const viewDetails = (machine: Machine) => {
  selectMachine(machine)
}

const editMachine = (machine: Machine) => {
  $q.notify({
    type: 'info',
    message: `Edit ${machine.name} - Feature coming soon`
  })
}

const deleteMachine = (machine: Machine) => {
  $q.dialog({
    title: 'Delete Machine',
    message: `Are you sure you want to delete ${machine.name}?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    const index = machines.value.findIndex(m => m.id === machine.id)
    if (index > -1) {
      machines.value.splice(index, 1)
      $q.notify({
        type: 'positive',
        message: `${machine.name} deleted successfully`
      })
    }
  })
}

const startMachine = (machine: Machine) => {
  machine.status = 'working'
  $q.notify({
    type: 'positive',
    message: `${machine.name} started successfully`
  })
}

const pauseMachine = (machine: Machine) => {
  machine.status = 'idle'
  $q.notify({
    type: 'info',
    message: `${machine.name} paused`
  })
}

const addMachine = () => {
  if (newMachine.value.name && newMachine.value.model) {
    const machine: Machine = {
      id: `YR${String(machines.value.length + 1).padStart(3, '0')}`,
      name: newMachine.value.name,
      model: newMachine.value.model,
      type: newMachine.value.type,
      status: 'idle',
      battery: 100,
      lastActivity: new Date().toISOString()
    }

    machines.value.push(machine)
    showAddMachineDialog.value = false
    newMachine.value = { name: '', model: '', type: 'lawn_mower' }

    $q.notify({
      type: 'positive',
      message: `${machine.name} added successfully`
    })
  }
}

const updateMachine = (updatedMachine: Machine) => {
  const index = machines.value.findIndex(m => m.id === updatedMachine.id)
  if (index > -1) {
    machines.value[index] = { ...updatedMachine }
  }
}

// Lifecycle
onMounted(() => {
  // Initialize component
})
</script>

<style lang="scss" scoped>
.machine-management-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--q-grey-1);

  .body--dark & {
    background: var(--q-dark);
  }
}

.machine-management-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark-page);
    border-bottom-color: var(--q-grey-7);
  }
}

.machine-management-view__title-section {
  display: flex;
  flex-direction: column;
}

.machine-management-view__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-management-view__subtitle {
  color: var(--q-grey-7);
  font-size: 0.875rem;
  margin-top: 4px;
}

.machine-management-view__stats {
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-dark-page);
    border-bottom-color: var(--q-grey-7);
  }
}

.machine-management-view__stat-card {
  height: 100%;
}

.machine-management-view__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;

  .body--dark & {
    background: var(--q-dark-page);
  }
}

.machine-management-view__list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.machine-management-view__filters {
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  background: var(--q-grey-1);
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-bottom-color: var(--q-grey-7);
  }
}

.machine-management-view__search {
  flex: 1;
  max-width: 300px;
}

.machine-management-view__filter {
  min-width: 120px;
}

.machine-management-view__machines {
  flex: 1;
  overflow-y: auto;
}

.machine-management-view__machine-item {
  padding: 16px 24px;
  border-bottom: 1px solid var(--q-grey-2);

  .body--dark & {
    border-bottom-color: var(--q-grey-8);
  }

  &:hover {
    background: var(--q-grey-1);

    .body--dark & {
      background: var(--q-grey-9);
    }
  }
}

.machine-management-view__machine-name {
  font-weight: 500;
  font-size: 1rem;
}

.machine-management-view__machine-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.machine-management-view__machine-controls {
  display: flex;
  gap: 4px;
}

.machine-management-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  min-height: 300px;
}

.machine-management-view__map-container,
.machine-management-view__status-container {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.machine-management-view__map-placeholder,
.machine-management-view__status-placeholder {
  text-align: center;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-management-view__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .machine-management-view__filters {
    flex-direction: column;
    gap: 12px;
  }

  .machine-management-view__search {
    max-width: none;
  }
}

@media (max-width: 599px) {
  .machine-management-view__header {
    padding: 16px;
  }

  .machine-management-view__stats {
    padding: 12px 16px;
  }

  .machine-management-view__filters {
    padding: 12px 16px;
  }

  .machine-management-view__machine-item {
    padding: 12px 16px;
  }
}
</style>
