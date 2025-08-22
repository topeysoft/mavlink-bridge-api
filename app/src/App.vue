<template>
  <div id="app">
    <div v-if="isAppLoading" id="initial-loading">
      <div class="loading-icon">
        <!-- Robot mower icon SVG -->
        <svg viewBox="0 0 24 24">
          <path
            d="M12,3A1,1 0 0,1 13,4V6H16A1,1 0 0,1 17,7V9H19A2,2 0 0,1 21,11V16A2,2 0 0,1 19,18H5A2,2 0 0,1 3,16V11A2,2 0 0,1 5,9H7V7A1,1 0 0,1 8,6H11V4A1,1 0 0,1 12,3M12,5V6H11V7H13V6H12V5M15,9H9V7H15V9M19,11H5V16H19V11M7,12A1,1 0 0,1 8,13A1,1 0 0,1 7,14A1,1 0 0,1 6,13A1,1 0 0,1 7,12M17,12A1,1 0 0,1 18,13A1,1 0 0,1 17,14A1,1 0 0,1 16,13A1,1 0 0,1 17,12Z"
          />
        </svg>
      </div>
      <div class="loading-text">YardRover</div>
      <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
    </div>

    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isAppLoading = ref(true);

onMounted(() => {
  // // Hide initial CSS loading screen
  // const initialLoading = document.getElementById('initial-loading');

  // // Minimum loading time to prevent flash
  // const minLoadTime = new Promise((resolve) => setTimeout(resolve, 1000));

  // // Wait for Vue to be ready and minimum time
  // await Promise.all([nextTick(), minLoadTime]);

  // // Fade out initial loading screen
  // if (initialLoading) {
  //   initialLoading.classList.add('fade-out');
  //   setTimeout(() => {
  //     if (initialLoading.parentNode) {
  //       initialLoading.parentNode.removeChild(initialLoading);
  //     }
  //   }, 500);
  // }

  // Hide Vue loading overlay
  isAppLoading.value = false;
});
</script>

<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

#app {
  height: 100vh;
  overflow: hidden;
}
</style>
