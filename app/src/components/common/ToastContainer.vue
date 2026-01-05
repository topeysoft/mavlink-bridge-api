<script setup lang="ts">
import { ref } from 'vue'
import Toast from './Toast.vue'

export interface ToastNotification {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
  dismissible: boolean
}

const toasts = ref<ToastNotification[]>([])

const addToast = (notification: Omit<ToastNotification, 'id'>) => {
  const id = `toast-${Date.now()}-${Math.random()}`
  const toast: ToastNotification = {
    id,
    ...notification
  }

  toasts.value.push(toast)

  if (notification.duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, notification.duration)
  }

  return id
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

// Expose methods to parent
defineExpose({
  addToast,
  removeToast
})
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      <TransitionGroup name="toast-list">
        <Toast
          v-for="toast in toasts"
          :key="toast.id"
          :message="toast.message"
          :type="toast.type"
          :duration="toast.duration"
          :dismissible="toast.dismissible"
          @dismiss="removeToast(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.toast-container {
  position: fixed;
  top: var(--spacing-xl);
  right: var(--spacing-xl);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  @media (max-width: 768px) {
    top: var(--spacing-md);
    right: var(--spacing-md);
    left: var(--spacing-md);
    max-width: calc(100vw - 2rem);
  }
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s ease;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-list-move {
  transition: transform 0.3s ease;
}
</style>
