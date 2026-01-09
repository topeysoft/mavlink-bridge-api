<template>
  <div class="notification-button">
    <q-btn
      flat
      round
      dense
      icon="notifications"
      :class="[
        'notification-button__btn',
        { 'notification-button__btn--has-unread': hasUnreadNotifications }
      ]"
      @click="toggleNotifications"
    >
      <!-- Notification badge -->
      <q-badge
        v-if="unreadCount > 0"
        floating
        rounded
        :label="unreadCount > 99 ? '99+' : unreadCount.toString()"
        color="negative"
        class="notification-button__badge"
      />
    </q-btn>

    <!-- Notifications menu -->
    <q-menu
      v-model="showNotifications"
      anchor="bottom right"
      self="top right"
      :offset="[0, 8]"
      class="notification-menu"
      max-width="400px"
      max-height="500px"
    >
      <q-card class="notification-menu__card">
        <!-- Header -->
        <q-card-section class="notification-menu__header">
          <div class="row items-center justify-between">
            <div class="text-h6">Notifications</div>
            <div class="row items-center q-gutter-sm">
              <q-btn
                v-if="hasUnreadNotifications"
                flat
                dense
                size="sm"
                label="Mark all read"
                @click="markAllAsRead"
              />
              <q-btn flat dense round icon="settings" size="sm" @click="openNotificationSettings" />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <!-- Notifications list -->
        <q-scroll-area class="notification-menu__scroll" style="height: 300px">
          <q-list v-if="notifications.length > 0" separator>
            <NotificationItem
              v-for="notification in notifications"
              :key="notification.id"
              :notification="notification"
              @click="handleNotificationClick"
              @mark-read="markAsRead"
              @dismiss="dismissNotification"
            />
          </q-list>

          <!-- Empty state -->
          <div v-else class="notification-menu__empty">
            <q-icon name="notifications_none" size="48px" class="text-grey-4" />
            <div class="text-grey-6 q-mt-md">No notifications</div>
          </div>
        </q-scroll-area>

        <!-- Footer -->
        <q-separator />
        <q-card-actions align="center" class="notification-menu__footer">
          <q-btn flat dense label="View all notifications" @click="viewAllNotifications" />
        </q-card-actions>
      </q-card>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'
import type { Notification } from '@/stores/notifications'

// Components
import NotificationItem from './NotificationItem.vue'

// Composables
const router = useRouter()
const notifications = useNotificationsStore()

// Local state
const showNotifications = ref(false)

// Computed properties
const unreadCount = computed(() => notifications.unreadCount)
const hasUnreadNotifications = computed(() => unreadCount.value > 0)

// Get recent notifications (last 10)
const recentNotifications = computed(() => notifications.notifications.slice(0, 10))

// Methods
const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const markAllAsRead = () => {
  notifications.markAllAsRead()
}

const markAsRead = (notificationId: string) => {
  notifications.markAsRead(notificationId)
}

const dismissNotification = (notificationId: string) => {
  notifications.removeNotification(notificationId)
}

const handleNotificationClick = (notification: Notification) => {
  // Mark as read when clicked
  if (!notification.read) {
    markAsRead(notification.id)
  }

  // Navigate to related page if action is specified
  if (notification.action?.route) {
    router.push(notification.action.route)
    showNotifications.value = false
  }
}

const openNotificationSettings = () => {
  router.push({ name: 'settings', query: { tab: 'notifications' } })
  showNotifications.value = false
}

const viewAllNotifications = () => {
  router.push({ name: 'notifications' })
  showNotifications.value = false
}
</script>

<style lang="scss" scoped>
.notification-button {
  position: relative;
}

.notification-button__btn {
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    color: var(--q-primary);
  }

  &--has-unread {
    color: var(--q-primary);
  }
}

.notification-button__badge {
  animation: pulse 2s infinite;
}

.notification-menu__card {
  min-width: 350px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.notification-menu__header {
  padding: 16px 20px 12px;
  background-color: var(--q-primary);
  color: white;

  .text-h6 {
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.notification-menu__scroll {
  .q-scrollarea__content {
    padding: 0;
  }
}

.notification-menu__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.notification-menu__footer {
  padding: 8px 16px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

// Dark mode adjustments
.body--dark {
  .notification-menu__header {
    background-color: var(--q-primary);
  }

  .notification-menu__card {
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
  }
}

// Pulse animation for unread badge
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

// Focus styles
.notification-button__btn:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
