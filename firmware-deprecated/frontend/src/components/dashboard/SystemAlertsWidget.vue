<template>
  <q-card flat bordered class="system-alerts-widget">
    <q-card-section class="system-alerts-widget__header">
      <div class="row items-center justify-between">
        <div>
          <h3 class="system-alerts-widget__title">System Alerts</h3>
          <p class="system-alerts-widget__subtitle">
            {{ activeAlerts }} active, {{ totalAlerts }} total
          </p>
        </div>

        <div class="system-alerts-widget__actions">
          <q-btn
            flat
            round
            dense
            icon="clear_all"
            :disable="alerts.length === 0"
            @click="$emit('clear-all')"
          >
            <q-tooltip>Clear All Alerts</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="settings" @click="$emit('settings')">
            <q-tooltip>Alert Settings</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="fullscreen" @click="$emit('expand')">
            <q-tooltip>View All Alerts</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <!-- Alert List -->
    <q-card-section class="system-alerts-widget__content">
      <div v-if="sortedAlerts.length === 0" class="system-alerts-widget__empty">
        <q-icon name="check_circle" size="48px" color="positive" />
        <div class="text-positive q-mt-md">All systems operational</div>
        <div class="text-grey-6 text-caption q-mt-xs">No active alerts or warnings</div>
      </div>

      <q-list v-else separator class="system-alerts-widget__list">
        <SystemAlertItem
          v-for="alert in displayAlerts"
          :key="alert.id"
          :alert="alert"
          @dismiss="$emit('alert-action', 'dismiss', alert.id)"
          @acknowledge="$emit('alert-action', 'acknowledge', alert.id)"
          @resolve="$emit('alert-action', 'resolve', alert.id)"
          @view-details="$emit('alert-action', 'view-details', alert.id)"
        />

        <q-item
          v-if="hasMoreAlerts"
          clickable
          class="system-alerts-widget__more"
          @click="$emit('expand')"
        >
          <q-item-section avatar>
            <q-icon name="more_horiz" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-primary">
              View {{ remainingAlerts }} more alerts
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="arrow_forward" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <!-- Summary Footer -->
    <q-separator v-if="alerts.length > 0" />
    <q-card-section v-if="alerts.length > 0" class="system-alerts-widget__footer">
      <div class="alert-summary">
        <div class="alert-summary__counts">
          <q-chip
            v-if="criticalCount > 0"
            color="negative"
            text-color="white"
            size="sm"
            icon="dangerous"
          >
            {{ criticalCount }} Critical
          </q-chip>

          <q-chip
            v-if="warningCount > 0"
            color="warning"
            text-color="dark"
            size="sm"
            icon="warning"
          >
            {{ warningCount }} Warning
          </q-chip>

          <q-chip v-if="infoCount > 0" color="info" text-color="white" size="sm" icon="info">
            {{ infoCount }} Info
          </q-chip>
        </div>

        <div class="alert-summary__actions">
          <q-btn
            flat
            size="sm"
            label="Acknowledge All"
            :disable="unacknowledgedAlerts === 0"
            @click="$emit('acknowledge-all')"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Components
import SystemAlertItem from './SystemAlertItem.vue'

// Types
interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  source: string // machine, system, weather, etc.
  timestamp: string
  acknowledged: boolean
  resolved: boolean
  persistent: boolean
  metadata?: Record<string, any>
  actions?: {
    id: string
    label: string
    icon?: string
    color?: string
  }[]
}

interface Props {
  alerts: Alert[]
  maxDisplay?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxDisplay: 5
})

// Emits
defineEmits<{
  'alert-action': [action: string, alertId: string]
  'clear-all': []
  'acknowledge-all': []
  settings: []
  expand: []
}>()

// Computed properties
const sortedAlerts = computed(() => {
  return [...props.alerts].sort((a, b) => {
    // Sort by: 1. Resolved status, 2. Type priority, 3. Timestamp
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1
    }

    const typePriority = { critical: 3, warning: 2, info: 1 }
    const aPriority = typePriority[a.type]
    const bPriority = typePriority[b.type]

    if (aPriority !== bPriority) {
      return bPriority - aPriority
    }

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
})

const displayAlerts = computed(() => sortedAlerts.value.slice(0, props.maxDisplay))

const hasMoreAlerts = computed(() => sortedAlerts.value.length > props.maxDisplay)

const remainingAlerts = computed(() => Math.max(0, sortedAlerts.value.length - props.maxDisplay))

const activeAlerts = computed(() => props.alerts.filter(alert => !alert.resolved).length)

const totalAlerts = computed(() => props.alerts.length)

const criticalCount = computed(
  () => props.alerts.filter(alert => alert.type === 'critical' && !alert.resolved).length
)

const warningCount = computed(
  () => props.alerts.filter(alert => alert.type === 'warning' && !alert.resolved).length
)

const infoCount = computed(
  () => props.alerts.filter(alert => alert.type === 'info' && !alert.resolved).length
)

const unacknowledgedAlerts = computed(
  () => props.alerts.filter(alert => !alert.acknowledged && !alert.resolved).length
)
</script>

<style lang="scss" scoped>
.system-alerts-widget {
  border-radius: 12px;
}

.system-alerts-widget__header {
  padding: 20px 24px 16px;
}

.system-alerts-widget__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.system-alerts-widget__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.system-alerts-widget__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.system-alerts-widget__content {
  padding: 0;
  min-height: 200px;
}

.system-alerts-widget__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  text-align: center;
  padding: 40px 24px;
}

.system-alerts-widget__list {
  .q-item {
    padding: 0;
  }
}

.system-alerts-widget__more {
  padding: 16px 24px;
  background-color: rgba(var(--q-primary-rgb), 0.05);

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.1);
  }
}

.system-alerts-widget__footer {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.alert-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.alert-summary__counts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-summary__actions {
  display: flex;
  gap: 8px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .system-alerts-widget__header {
    padding: 16px 20px 12px;

    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .system-alerts-widget__actions {
      justify-content: center;
    }
  }

  .system-alerts-widget__footer {
    padding: 12px 20px;
  }

  .alert-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .alert-summary__counts {
    justify-content: center;
  }

  .alert-summary__actions {
    justify-content: center;
  }
}

@media (max-width: 599px) {
  .system-alerts-widget__header {
    padding: 12px 16px;
  }

  .system-alerts-widget__footer {
    padding: 12px 16px;
  }

  .system-alerts-widget__empty {
    padding: 30px 16px;
  }

  .alert-summary__counts {
    gap: 6px;

    .q-chip {
      font-size: 0.7rem;
    }
  }
}

// Alert severity indicators
.system-alerts-widget__list {
  :deep(.alert-item--critical) {
    border-left: 4px solid var(--q-negative);
  }

  :deep(.alert-item--warning) {
    border-left: 4px solid var(--q-warning);
  }

  :deep(.alert-item--info) {
    border-left: 4px solid var(--q-info);
  }

  :deep(.alert-item--resolved) {
    opacity: 0.6;
  }
}
</style>
