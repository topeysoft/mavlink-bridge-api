<template>
  <q-item
    class="system-alert-item"
    :class="`system-alert-item--${alert.severity}`"
    clickable
    @click="$emit('click', alert)"
  >
    <q-item-section avatar>
      <q-icon
        :name="getSeverityIcon(alert.severity)"
        :color="getSeverityColor(alert.severity)"
        size="20px"
      />
    </q-item-section>

    <q-item-section>
      <q-item-label class="system-alert-item__title">
        {{ alert.title }}
      </q-item-label>

      <q-item-label caption class="system-alert-item__message">
        {{ alert.message }}
      </q-item-label>

      <q-item-label caption class="system-alert-item__details">
        <span class="system-alert-item__source">
          {{ alert.source }}
        </span>
        <span class="system-alert-item__separator">•</span>
        <span class="system-alert-item__time">
          {{ formatTime(alert.timestamp) }}
        </span>
        <span v-if="alert.machineId" class="system-alert-item__separator">•</span>
        <span v-if="alert.machineId" class="system-alert-item__machine">
          {{ alert.machineId }}
        </span>
      </q-item-label>
    </q-item-section>

    <q-item-section side>
      <div class="system-alert-item__actions">
        <!-- Severity badge -->
        <q-badge
          :color="getSeverityColor(alert.severity)"
          :text-color="alert.severity === 'info' ? 'dark' : 'white'"
          class="system-alert-item__severity-badge"
        >
          {{ alert.severity }}
        </q-badge>

        <!-- Unread indicator -->
        <q-badge
          v-if="!alert.acknowledged"
          color="primary"
          floating
          rounded
          class="system-alert-item__unread-badge"
        />

        <!-- Action buttons -->
        <div class="system-alert-item__buttons">
          <q-btn
            v-if="!alert.acknowledged"
            flat
            round
            dense
            size="sm"
            icon="check"
            color="positive"
            @click.stop="$emit('acknowledge', alert)"
          >
            <q-tooltip>Acknowledge</q-tooltip>
          </q-btn>

          <q-btn
            v-if="alert.actionable"
            flat
            round
            dense
            size="sm"
            icon="build"
            color="primary"
            @click.stop="$emit('action', alert)"
          >
            <q-tooltip>Take Action</q-tooltip>
          </q-btn>

          <q-btn flat round dense size="sm" icon="more_vert" @click.stop="showMenu = !showMenu">
            <q-menu v-model="showMenu" auto-close>
              <q-list dense>
                <q-item v-if="!alert.acknowledged" clickable @click="$emit('acknowledge', alert)">
                  <q-item-section avatar>
                    <q-icon name="check" color="positive" />
                  </q-item-section>
                  <q-item-section>Acknowledge</q-item-section>
                </q-item>

                <q-item v-if="alert.actionable" clickable @click="$emit('action', alert)">
                  <q-item-section avatar>
                    <q-icon name="build" color="primary" />
                  </q-item-section>
                  <q-item-section>Take Action</q-item-section>
                </q-item>

                <q-item clickable @click="$emit('details', alert)">
                  <q-item-section avatar>
                    <q-icon name="info" />
                  </q-item-section>
                  <q-item-section>View Details</q-item-section>
                </q-item>

                <q-item clickable @click="$emit('share', alert)">
                  <q-item-section avatar>
                    <q-icon name="share" />
                  </q-item-section>
                  <q-item-section>Share</q-item-section>
                </q-item>

                <q-separator />

                <q-item clickable @click="$emit('dismiss', alert)">
                  <q-item-section avatar>
                    <q-icon name="close" color="negative" />
                  </q-item-section>
                  <q-item-section>Dismiss</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>
    </q-item-section>

    <!-- Selection checkbox -->
    <q-item-section v-if="selectable" side>
      <q-checkbox
        :model-value="selected"
        @update:model-value="$emit('select', alert, $event)"
        @click.stop
      />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Types
interface SystemAlert {
  id: string
  title: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  source: string
  timestamp: string
  machineId?: string
  acknowledged: boolean
  actionable: boolean
}

// Props
defineProps<{
  alert: SystemAlert
  selected?: boolean
  selectable?: boolean
}>()

// Emits
defineEmits<{
  click: [alert: SystemAlert]
  select: [alert: SystemAlert, selected: boolean]
  acknowledge: [alert: SystemAlert]
  action: [alert: SystemAlert]
  details: [alert: SystemAlert]
  share: [alert: SystemAlert]
  dismiss: [alert: SystemAlert]
}>()

// Local state
const showMenu = ref(false)

// Methods
const getSeverityIcon = (severity: string) => {
  const icons = {
    critical: 'error',
    warning: 'warning',
    info: 'info'
  }
  return icons[severity as keyof typeof icons] || 'info'
}

const getSeverityColor = (severity: string) => {
  const colors = {
    critical: 'negative',
    warning: 'warning',
    info: 'info'
  }
  return colors[severity as keyof typeof colors] || 'info'
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays}d ago`
  } else if (diffHours > 0) {
    return `${diffHours}h ago`
  } else if (diffMins > 0) {
    return `${diffMins}m ago`
  } else {
    return 'Just now'
  }
}
</script>

<style lang="scss" scoped>
.system-alert-item {
  border-radius: 8px;
  margin-bottom: 2px;
  position: relative;

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.05);
  }

  &--critical {
    border-left: 3px solid var(--q-negative);
    padding-left: 13px;
    background-color: rgba(var(--q-negative-rgb), 0.02);
  }

  &--warning {
    border-left: 3px solid var(--q-warning);
    padding-left: 13px;
    background-color: rgba(var(--q-warning-rgb), 0.02);
  }

  &--info {
    border-left: 3px solid var(--q-info);
    padding-left: 13px;
    background-color: rgba(var(--q-info-rgb), 0.02);
  }
}

.system-alert-item__title {
  font-weight: 600;
  font-size: 0.875rem;
  line-height: 1.2;
}

.system-alert-item__message {
  font-size: 0.8rem;
  line-height: 1.3;
  margin-top: 2px;
  color: var(--q-grey-8);

  .body--dark & {
    color: var(--q-grey-4);
  }
}

.system-alert-item__details {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  margin-top: 4px;
}

.system-alert-item__source {
  color: var(--q-primary);
  font-weight: 500;
}

.system-alert-item__separator {
  color: var(--q-grey-5);
}

.system-alert-item__time {
  color: var(--q-grey-6);
}

.system-alert-item__machine {
  color: var(--q-grey-7);
  font-family: monospace;
}

.system-alert-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.system-alert-item__severity-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.system-alert-item__unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  font-size: 0;
}

.system-alert-item__buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

// Responsive adjustments
@media (max-width: 479px) {
  .system-alert-item__title {
    font-size: 0.8rem;
  }

  .system-alert-item__message {
    font-size: 0.75rem;
  }

  .system-alert-item__details {
    font-size: 0.7rem;
  }

  .system-alert-item__severity-badge {
    font-size: 0.6rem;
  }

  .system-alert-item__buttons {
    .q-btn {
      padding: 4px;
    }
  }
}
</style>
