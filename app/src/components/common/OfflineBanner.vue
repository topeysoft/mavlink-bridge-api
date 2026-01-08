<template>
  <Transition name="slide-down">
    <div v-if="!isOnline" class="offline-banner">
      <div class="offline-content">
        <svg class="banner-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z"/>
        </svg>
        <span class="offline-message">
          You're offline. Some features may be unavailable.
        </span>
        <span v-if="offlineSince" class="offline-duration">
          {{ offlineDuration }}
        </span>
      </div>
    </div>
  </Transition>

  <Transition name="slide-down">
    <div v-if="showReconnected" class="reconnected-banner">
      <div class="offline-content">
        <svg class="banner-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z"/>
        </svg>
        <span class="offline-message">
          Connection restored
        </span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOfflineDetection } from '@/composables/useOfflineDetection'
import { useIntervalFn } from '@vueuse/core'

const { isOnline, wasOffline, offlineSince } = useOfflineDetection()
const showReconnected = ref(false)
const currentTime = ref(Date.now())

// Update current time every second for duration calculation
useIntervalFn(() => {
  currentTime.value = Date.now()
}, 1000)

// Show "reconnected" banner briefly when coming back online
watch(isOnline, (online, wasOnlineBefore) => {
  if (online && !wasOnlineBefore) {
    showReconnected.value = true
    setTimeout(() => {
      showReconnected.value = false
    }, 3000)
  }
})

const offlineDuration = computed(() => {
  if (!offlineSince.value) return ''

  const since = new Date(offlineSince.value).getTime()
  const seconds = Math.floor((currentTime.value - since) / 1000)

  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.offline-banner,
.reconnected-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.offline-banner {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
}

.reconnected-banner {
  background: linear-gradient(135deg, #51cf66 0%, #37b24d 100%);
  color: white;
}

.offline-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.banner-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.offline-message {
  flex: 1;
}

.offline-duration {
  font-size: 0.8rem;
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
}

// Slide down animation
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
