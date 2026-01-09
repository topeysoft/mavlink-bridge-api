<template>
  <q-item
    class="notification-item"
    :class="{
      'notification-item--unread': !notification.read,
      'notification-item--priority': notification.priority === 'high'
    }"
    clickable
    @click="handleClick"
  >
    <q-item-section avatar>
      <q-avatar
        :color="getTypeColor(notification.type)"
        :text-color="notification.type === 'info' ? 'dark' : 'white'"
        size="36px"
      >
        <q-icon :name="getTypeIcon(notification.type)" size="18px" />
      </q-avatar>
    </q-item-section>

    <q-item-section>
      <q-item-label class="notification-item__title">
        {{ notification.title }}
      </q-item-label>

      <q-item-label caption class="notification-item__message">
        {{ notification.message }}
      </q-item-label>

      <q-item-label caption class="notification-item__details">
        <span class="notification-item__time">
          {{ formatTime(notification.timestamp) }}
        </span>
        <span v-if="notification.source" class="notification-item__separator">•</span>
        <span v-if="notification.source" class="notification-item__source">
          {{ notification.source }}
        </span>
      </q-item-label>
    </q-item-section>

    <q-item-section side>
      <div class="notification-item__actions">
        <!-- Priority indicator -->
        <q-badge
          v-if="notification.priority === 'high'"
          color="negative"
          floating
          rounded
          class="notification-item__priority-badge"
        >
          !
        </q-badge>

        <!-- Unread indicator -->
        <q-badge
          v-if="!notification.read"
          color="primary"
          floating
          rounded
          class="notification-item__unread-badge"
        />

        <!-- Action buttons -->
        <div class="notification-item__buttons">
          <q-btn
            v-if="notification.actionable"
            flat
            round
            dense
            size="sm"
            icon="launch"
            color="primary"
            @click.stop="$emit('action', notification)"
          >
            <q-tooltip>Take Action</q-tooltip>
          </q-btn>

          <q-btn
            v-if="!notification.read"
            flat
            round
            dense
            size="sm"
            icon="mark_email_read"
            color="positive"
            @click.stop="markAsRead"
          >
            <q-tooltip>Mark as Read</q-tooltip>
          </q-btn>

          <q-btn flat round dense size="sm" icon="more_vert" @click.stop="showMenu = !showMenu">
            <q-menu v-model="showMenu" auto-close>
              <q-list dense>
                <q-item v-if="!notification.read" clickable @click="markAsRead">
                  <q-item-section avatar>
                    <q-icon name="mark_email_read" color="positive" />
                  </q-item-section>
                  <q-item-section>Mark as Read</q-item-section>
                </q-item>

                <q-item v-if="notification.read" clickable @click="markAsUnread">
                  <q-item-section avatar>
                    <q-icon name="mark_email_unread" color="warning" />
                  </q-item-section>
                  <q-item-section>Mark as Unread</q-item-section>
                </q-item>

                <q-item
                  v-if="notification.actionable"
                  clickable
                  @click="$emit('action', notification)"
                >
                  <q-item-section avatar>
                    <q-icon name="launch" color="primary" />
                  </q-item-section>
                  <q-item-section>Take Action</q-item-section>
                </q-item>

                <q-item clickable @click="$emit('details', notification)">
                  <q-item-section avatar>
                    <q-icon name="info" />
                  </q-item-section>
                  <q-item-section>View Details</q-item-section>
                </q-item>

                <q-item clickable @click="$emit('share', notification)">
                  <q-item-section avatar>
                    <q-icon name="share" />
                  </q-item-section>
                  <q-item-section>Share</q-item-section>
                </q-item>

                <q-separator />

                <q-item clickable @click="$emit('archive', notification)">
                  <q-item-section avatar>
                    <q-icon name="archive" />
                  </q-item-section>
                  <q-item-section>Archive</q-item-section>
                </q-item>

                <q-item clickable @click="$emit('delete', notification)">
                  <q-item-section avatar>
                    <q-icon name="delete" color="negative" />
                  </q-item-section>
                  <q-item-section>Delete</q-item-section>
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
        @update:model-value="$emit('select', notification, $event)"
        @click.stop
      />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Types
interface NotificationData {
  id: string
  title: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info' | 'system'
  priority: 'low' | 'medium' | 'high'
  timestamp: string
  read: boolean
  actionable: boolean
  source?: string
}

// Props
const props = defineProps<{
  notification: NotificationData
  selected?: boolean
  selectable?: boolean
}>()

// Emits
const emit = defineEmits<{
  click: [notification: NotificationData]
  select: [notification: NotificationData, selected: boolean]
  action: [notification: NotificationData]
  details: [notification: NotificationData]
  share: [notification: NotificationData]
  archive: [notification: NotificationData]
  delete: [notification: NotificationData]
  'mark-read': [notification: NotificationData]
  'mark-unread': [notification: NotificationData]
}>()

// Local state
const showMenu = ref(false)

// Methods
const getTypeIcon = (type: string) => {
  const icons = {
    success: 'check_circle',
    warning: 'warning',
    error: 'error',
    info: 'info',
    system: 'settings'
  }
  return icons[type as keyof typeof icons] || 'notifications'
}

const getTypeColor = (type: string) => {
  const colors = {
    success: 'positive',
    warning: 'warning',
    error: 'negative',
    info: 'info',
    system: 'primary'
  }
  return colors[type as keyof typeof colors] || 'grey'
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

const handleClick = () => {
  emit('click', props.notification)
  if (!props.notification.read) {
    markAsRead()
  }
}

const markAsRead = () => {
  emit('mark-read', props.notification)
}

const markAsUnread = () => {
  emit('mark-unread', props.notification)
}
</script>

<style lang="scss" scoped>
.notification-item {
  border-radius: 8px;
  margin-bottom: 2px;
  position: relative;

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.05);
  }

  &--unread {
    background-color: rgba(var(--q-primary-rgb), 0.02);
    border-left: 3px solid var(--q-primary);
    padding-left: 13px;
  }

  &--priority {
    background-color: rgba(var(--q-negative-rgb), 0.02);
    border-left: 3px solid var(--q-negative);
    padding-left: 13px;
  }
}

.notification-item__title {
  font-weight: 600;
  font-size: 0.875rem;
  line-height: 1.2;
}

.notification-item__message {
  font-size: 0.8rem;
  line-height: 1.3;
  margin-top: 2px;
  color: var(--q-grey-8);

  .body--dark & {
    color: var(--q-grey-4);
  }
}

.notification-item__details {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  margin-top: 4px;
}

.notification-item__time {
  color: var(--q-grey-6);
}

.notification-item__separator {
  color: var(--q-grey-5);
}

.notification-item__source {
  color: var(--q-primary);
  font-weight: 500;
}

.notification-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.notification-item__priority-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 12px;
  height: 12px;
  font-size: 8px;
  font-weight: bold;
  animation: pulse 1.5s ease-in-out infinite;
}

.notification-item__unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  font-size: 0;
}

.notification-item__buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

// Animations
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// Responsive adjustments
@media (max-width: 479px) {
  .notification-item__title {
    font-size: 0.8rem;
  }

  .notification-item__message {
    font-size: 0.75rem;
  }

  .notification-item__details {
    font-size: 0.7rem;
  }

  .notification-item__buttons {
    .q-btn {
      padding: 4px;
    }
  }

  .q-avatar {
    font-size: 32px;
  }
}
</style>
