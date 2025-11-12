<template>
  <q-card flat bordered class="machine-status-overview">
    <q-card-section class="machine-status-overview__header">
      <div class="row items-center justify-between">
        <div>
          <h3 class="machine-status-overview__title">Machine Status Overview</h3>
          <p class="machine-status-overview__subtitle">
            {{ activeMachines }} of {{ totalMachines }} machines active
          </p>
        </div>

        <div class="machine-status-overview__actions">
          <q-btn flat round dense icon="refresh" :loading="loading" @click="refreshMachines">
            <q-tooltip>Refresh Status</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="fullscreen" @click="$emit('expand')">
            <q-tooltip>Expand View</q-tooltip>
          </q-btn>

          <q-btn
            unelevated
            color="negative"
            size="sm"
            icon="stop"
            label="Emergency Stop"
            class="q-ml-sm"
            @click="$emit('emergency-stop')"
          />
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Machine Grid -->
    <q-card-section class="machine-status-overview__content">
      <div v-if="machines.length === 0" class="machine-status-overview__empty">
        <q-icon name="precision_manufacturing" size="48px" class="text-grey-4" />
        <div class="text-grey-6 q-mt-md">No machines found</div>
        <q-btn
          flat
          color="primary"
          label="Add Machine"
          class="q-mt-md"
          @click="$emit('add-machine')"
        />
      </div>

      <div v-else class="machine-grid">
        <MachineCard
          v-for="machine in machines"
          :key="machine.id"
          :machine="machine"
          @select="$emit('machine-select', machine.id)"
          @action="handleMachineAction"
        />
      </div>
    </q-card-section>

    <!-- Summary Footer -->
    <q-separator />
    <q-card-section class="machine-status-overview__footer">
      <div class="row items-center q-gutter-lg">
        <div class="machine-status-summary">
          <q-chip color="positive" text-color="white" size="sm" icon="check_circle">
            {{ onlineMachines }} Online
          </q-chip>

          <q-chip color="warning" text-color="white" size="sm" icon="warning">
            {{ warningMachines }} Warning
          </q-chip>

          <q-chip color="negative" text-color="white" size="sm" icon="error">
            {{ errorMachines }} Error
          </q-chip>

          <q-chip color="grey" text-color="white" size="sm" icon="power_off">
            {{ offlineMachines }} Offline
          </q-chip>
        </div>

        <q-space />

        <div class="machine-status-actions">
          <q-btn flat size="sm" label="View All" @click="$emit('view-all')" />
          <q-btn
            flat
            size="sm"
            label="Control Panel"
            color="primary"
            @click="$emit('control-panel')"
          />
        </div>
      </div>
    </q-card-section>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading" color="primary" />
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

// Components
import MachineCard from './MachineCard.vue'

// Types
interface Machine {
  id: string
  name: string
  type: string
  status: 'online' | 'offline' | 'warning' | 'error'
  batteryLevel: number
  currentTask?: string
  location?: {
    x: number
    y: number
  }
  lastSeen: string
  firmware: string
}

interface Props {
  machines: Machine[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
defineEmits<{
  'machine-select': [machineId: string]
  'emergency-stop': []
  expand: []
  'add-machine': []
  'view-all': []
  'control-panel': []
  refresh: []
}>()

// Local state
const refreshing = ref(false)

// Computed properties
const totalMachines = computed(() => props.machines.length)

const activeMachines = computed(() => props.machines.filter(m => m.status === 'online').length)

const onlineMachines = computed(() => props.machines.filter(m => m.status === 'online').length)

const offlineMachines = computed(() => props.machines.filter(m => m.status === 'offline').length)

const warningMachines = computed(() => props.machines.filter(m => m.status === 'warning').length)

const errorMachines = computed(() => props.machines.filter(m => m.status === 'error').length)

// Methods
const refreshMachines = async () => {
  refreshing.value = true
  try {
    // Emit refresh event to parent
    // $emit('refresh');

    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
  } finally {
    refreshing.value = false
  }
}

const handleMachineAction = (action: string, machineId: string) => {
  // Handle machine-specific actions
  switch (action) {
    case 'start':
      console.log('Starting machine:', machineId)
      break
    case 'stop':
      console.log('Stopping machine:', machineId)
      break
    case 'pause':
      console.log('Pausing machine:', machineId)
      break
    default:
      console.warn('Unknown machine action:', action)
  }
}
</script>

<style lang="scss" scoped>
.machine-status-overview {
  border-radius: 12px;
}

.machine-status-overview__header {
  padding: 20px 24px 16px;
}

.machine-status-overview__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-status-overview__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.machine-status-overview__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.machine-status-overview__content {
  padding: 24px;
  min-height: 200px;
}

.machine-status-overview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
}

.machine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.machine-status-overview__footer {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.machine-status-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.machine-status-actions {
  display: flex;
  gap: 8px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-status-overview__header {
    padding: 16px 20px 12px;

    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .machine-status-overview__actions {
      justify-content: center;
    }
  }

  .machine-status-overview__content {
    padding: 20px;
  }

  .machine-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }

  .machine-status-overview__footer {
    padding: 12px 20px;

    .row {
      flex-direction: column;
      gap: 12px;
    }

    .machine-status-summary {
      justify-content: center;
    }

    .machine-status-actions {
      justify-content: center;
    }
  }
}

@media (max-width: 599px) {
  .machine-status-overview__header {
    padding: 12px 16px;
  }

  .machine-status-overview__content {
    padding: 16px;
  }

  .machine-grid {
    grid-template-columns: 1fr;
  }

  .machine-status-overview__footer {
    padding: 12px 16px;
  }

  .machine-status-summary {
    gap: 6px;

    .q-chip {
      font-size: 0.7rem;
    }
  }

  .machine-status-actions {
    flex-direction: column;
    gap: 6px;
  }
}

// Focus styles
.machine-status-overview__actions .q-btn:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
