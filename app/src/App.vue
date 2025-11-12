<template>
  <div id="q-app">
    <router-view v-slot="{ Component, route }">
      <transition
        :name="getTransitionName(route)"
        mode="out-in"
        appear
      >
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { RouteLocationNormalized } from 'vue-router';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

// Transition logic
function getTransitionName(route: RouteLocationNormalized): string {
  // Custom transitions based on route
  if (route.name === 'login') {
    return 'fade';
  }
  if (route.name === 'dashboard') {
    return 'slide-up';
  }
  if (route.name === 'control') {
    return 'slide-left';
  }
  if (route.name === 'yard') {
    return 'zoom';
  }
  
  // Default transition
  return 'fade';
}

onMounted(() => {
  // Initialize seasonal theme based on current date
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) appStore.setTheme('spring');
  else if (month >= 5 && month <= 7) appStore.setTheme('summer');
  else if (month >= 8 && month <= 10) appStore.setTheme('autumn');
  else appStore.setTheme('winter');
});
</script>

<style lang="scss">
@import '@/assets/styles/main.scss';

#q-app {
  min-height: 100vh;
}

// Route Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s ease-out;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.4s ease-out;
}

.zoom-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.zoom-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

// Page loading animation
.page-enter-active {
  animation: pageSlideIn 0.5s ease-out;
}

@keyframes pageSlideIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

// Smooth scrolling for route changes
html {
  scroll-behavior: smooth;
}
</style>