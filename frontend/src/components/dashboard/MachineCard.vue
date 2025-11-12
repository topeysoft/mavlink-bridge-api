<template>
  <q-card
    flat
    bordered
    class="machine-card"
    :class="[`machine-card--${machine.status}`, { 'machine-card--selected': selected }]"
    @click="$emit('select', machine.id)"
  >
    <!-- Status indicator -->
    <div class="machine-card__status-bar" />

    <q-card-section class="machine-card__content">
      <!-- Header -->
      <div class="machine-card__header">
        <div class="machine-card__icon">
          <q-icon :name="machineIcon" size="20px" :color="statusColor" />
        </div>

        <div class="machine-card__info">
          <div class="machine-card__name">
            {{ machine.name }}
          </div>
          <div class="machine-card__type">
            {{ machine.type }}
          </div>
        </div>

        <div class="machine-card__actions">
          <q-btn flat round dense size="sm" icon="more_vert" @click.stop="showMenu = !showMenu">
            <q-menu v-model="showMenu" anchor="bottom right" self="top right">
              <q-list style="min-width: 150px">
                <q-item v-ripple clickable @click="handleAction('view')">
                  <q-item-section avatar>
                    <q-icon name="visibility" />
                  </q-item-section>
                  <q-item-section>View Details</q-item-section>
                </q-item>

                <q-item
                  v-if="machine.status === 'online'"
                  v-ripple
                  clickable
                  @click="handleAction('pause')"
                >
                  <q-item-section avatar>
                    <q-icon name="pause" />
                  </q-item-section>
                  <q-item-section>Pause</q-item-section>
                </q-item>

                <q-item
                  v-if="machine.status === 'offline'"
                  v-ripple
                  clickable
                  @click="handleAction('start')"
                >
                  <q-item-section avatar>
                    <q-icon name="play_arrow" />
                  </q-item-section>
                  <q-item-section>Start</q-item-section>
                </q-item>

                <q-item v-ripple clickable class="text-negative" @click="handleAction('stop')">
                  <q-item-section avatar>
                    <q-icon name="stop" color="negative" />
                  </q-item-section>
                  <q-item-section>Stop</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>

      <!-- Status -->
      <div class="machine-card__status">
        <q-chip :color="statusColor" text-color="white" size="sm" :icon="statusIcon">
          {{ statusText }}
        </q-chip>

        <div class="machine-card__last-seen">Last seen {{ formatTime(machine.lastSeen) }}</div>
      </div>

      <!-- Current Task -->
      <div v-if="machine.currentTask" class="machine-card__task">
        <q-icon name="assignment" size="16px" class="q-mr-xs" />
        <span class="machine-card__task-text">
          {{ machine.currentTask }}
        </span>
      </div>

      <!-- Battery Level -->
      <div class="machine-card__battery">
        <div class="machine-card__battery-label">
          <q-icon :name="batteryIcon" size="16px" :color="batteryColor" class="q-mr-xs" />
          <span>Battery</span>
        </div>

        <div class="machine-card__battery-level">
          <q-linear-progress
            :value="machine.batteryLevel / 100"
            :color="batteryColor"
            size="8px"
            rounded
            class="machine-card__battery-bar"
          />
          <span class="machine-card__battery-text"> {{ machine.batteryLevel }}% </span>
        </div>
      </div>

      <!-- Location (if available) -->
      <div v-if="machine.location" class="machine-card__location">
        <q-icon name="location_on" size="16px" class="q-mr-xs" />
        <span>
          X: {{ machine.location.x.toFixed(1) }}, Y: {{ machine.location.y.toFixed(1) }}
        </span>
      </div>
    </q-card-section>

    <!-- Quick Actions Footer -->
    <q-card-actions align="center" class="machine-card__footer">
      <q-btn
        v-if="machine.status === 'offline'"
        flat
        size="sm"
        color="positive"
        icon="play_arrow"
        label="Start"
        @click.stop="handleAction('start')"
      />

      <q-btn
        v-if="machine.status === 'online'"
        flat
        size="sm"
        color="warning"
        icon="pause"
        label="Pause"
        @click.stop="handleAction('pause')"
      />

      <q-btn
        flat
        size="sm"
        color="primary"
        icon="settings"
        label="Control"
        @click.stop="handleAction('control')"
      />
    </q-card-actions>

    <!-- Selection indicator -->
    <q-ripple />
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

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
  machine: Machine
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

// Emits
defineEmits<{
  select: [machineId: string]
  action: [action: string, machineId: string]
}>()

// Local state
const showMenu = ref(false)

// Computed properties
const machineIcon = computed(() => {
  switch (props.machine.type.toLowerCase()) {
    case 'mower':
      return 'grass'
    case 'trimmer':
      return 'content_cut'
    case 'blower':
      return 'air'
    default:
      return 'precision_manufacturing'
  }
})

const statusColor = computed(() => {
  switch (props.machine.status) {
    case 'online':
      return 'positive'
    case 'warning':
      return 'warning'
    case 'error':
      return 'negative'
    case 'offline':
    default:
      return 'grey'
  }
})

const statusIcon = computed(() => {
  switch (props.machine.status) {
    case 'online':
      return 'check_circle'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'offline':
    default:
      return 'power_off'
  }
})

const statusText = computed(() => {
  switch (props.machine.status) {
    case 'online':
      return 'Online'
    case 'warning':
      return 'Warning'
    case 'error':
      return 'Error'
    case 'offline':
    default:
      return 'Offline'
  }
})

const batteryColor = computed(() => {
  const level = props.machine.batteryLevel
  if (level > 50) return 'positive'
  if (level > 20) return 'warning'
  return 'negative'
})

const batteryIcon = computed(() => {
  const level = props.machine.batteryLevel
  if (level > 90) return 'battery_full'
  if (level > 60) return 'battery_5_bar'
  if (level > 30) return 'battery_3_bar'
  if (level > 10) return 'battery_1_bar'
  return 'battery_alert'
})

// Methods
const handleAction = (action: string) => {
  showMenu.value = false
  // emit('action', action, props.machine.id);
}

const formatTime = (timeString: string) => {
  const date = new Date(timeString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}
</script>

<style lang="scss" scoped>
.machine-card {
  position: relative;
  border-radius: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

    .body--dark & {
      box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
    }
  }

  &--selected {
    border-color: var(--q-primary);
    box-shadow: 0 0 0 2px rgba(var(--q-primary-rgb), 0.2);
  }

  // Status variants
  &--online {
    .machine-card__status-bar {
      background-color: var(--q-positive);
    }
  }

  &--warning {
    .machine-card__status-bar {
      background-color: var(--q-warning);
    }
  }

  &--error {
    .machine-card__status-bar {
      background-color: var(--q-negative);
    }
  }

  &--offline {
    .machine-card__status-bar {
      background-color: var(--q-grey);
    }
  }
}

.machine-card__status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.machine-card__content {
  padding: 16px;
}

.machine-card__header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
}

.machine-card__icon {
  margin-right: 12px;
  padding: 8px;
  border-radius: 8px;
  background-color: rgba(var(--q-primary-rgb), 0.1);
}

.machine-card__info {
  flex: 1;
  min-width: 0;
}

.machine-card__name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--q-dark);
  margin-bottom: 2px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-card__type {
  font-size: 0.75rem;
  color: var(--q-grey-6);
  text-transform: capitalize;
}

.machine-card__actions {
  margin-left: 8px;
}

.machine-card__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.machine-card__last-seen {
  font-size: 0.7rem;
  color: var(--q-grey-5);
}

.machine-card__task {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 6px 8px;
  background-color: rgba(var(--q-info-rgb), 0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--q-info);
}

.machine-card__task-text {
  font-weight: 500;
}

.machine-card__battery {
  margin-bottom: 12px;
}

.machine-card__battery-label {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--q-dark);
  margin-bottom: 4px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-card__battery-level {
  display: flex;
  align-items: center;
  gap: 8px;
}

.machine-card__battery-bar {
  flex: 1;
}

.machine-card__battery-text {
  font-size: 0.7rem;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.machine-card__location {
  display: flex;
  align-items: center;
  font-size: 0.7rem;
  color: var(--q-grey-6);
}

.machine-card__footer {
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.05);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
    border-top-color: rgba(255, 255, 255, 0.05);
  }
}

// Responsive adjustments
@media (max-width: 599px) {
  .machine-card__content {
    padding: 12px;
  }

  .machine-card__header {
    margin-bottom: 8px;
  }

  .machine-card__status {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .machine-card__footer {
    padding: 6px 12px;

    .q-btn {
      font-size: 0.7rem;
      padding: 4px 8px;
    }
  }
}

// Focus styles
.machine-card:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
