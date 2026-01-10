<template>
  <div class="sync-indicator" :class="statusClass">
    <div class="sync-icon">
      <svg v-if="status === 'synced'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>

      <svg v-else-if="status === 'syncing'" width="16" height="16" viewBox="0 0 16 16" fill="none" class="spin">
        <path d="M8 2V5M8 11V14M14 8H11M5 8H2M12.2 3.8L10.5 5.5M5.5 10.5L3.8 12.2M12.2 12.2L10.5 10.5M5.5 5.5L3.8 3.8"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>

      <svg v-else-if="status === 'offline'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M4 12L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>

      <svg v-else-if="status === 'error'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M8 4V8M8 10V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>

      <svg v-else-if="status === 'conflict'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L13 14H3L8 2Z" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M8 7V10M8 11.5V12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>

    <span v-if="showLabel" class="sync-label">{{ label }}</span>

    <div v-if="pendingChanges > 0" class="pending-badge">
      {{ pendingChanges }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SyncStatus } from '@client'

interface Props {
  syncStatus: SyncStatus
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: true
})

const status = computed(() => props.syncStatus.status)
const pendingChanges = computed(() => props.syncStatus.pendingChanges)

const statusClass = computed(() => {
  return `sync-indicator--${status.value}`
})

const label = computed(() => {
  switch (status.value) {
    case 'synced':
      return 'Synced'
    case 'syncing':
      return 'Syncing...'
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Sync Error'
    case 'conflict':
      return 'Conflict'
    default:
      return 'Unknown'
  }
})

const formattedLastSync = computed(() => {
  if (!props.syncStatus.lastSync) return 'Never'

  const diff = Date.now() - props.syncStatus.lastSync
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.sync-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;

  &--synced {
    background-color: rgba(#2C5F2D, 0.1);
    color: $primary;

    .sync-icon svg {
      color: $primary;
    }
  }

  &--syncing {
    background-color: rgba(#87CEEB, 0.1);
    color: $secondary;

    .sync-icon svg {
      color: $secondary;
    }
  }

  &--offline {
    background-color: rgba(128, 128, 128, 0.1);
    color: #666;

    .sync-icon svg {
      color: #666;
    }
  }

  &--error {
    background-color: rgba(220, 53, 69, 0.1);
    color: #dc3545;

    .sync-icon svg {
      color: #dc3545;
    }
  }

  &--conflict {
    background-color: rgba(255, 193, 7, 0.1);
    color: #ffc107;

    .sync-icon svg {
      color: #ffc107;
    }
  }
}

.sync-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;

  svg {
    width: 100%;
    height: 100%;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.sync-label {
  line-height: 1;
}

.pending-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background-color: currentColor;
  color: white;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
}
</style>
