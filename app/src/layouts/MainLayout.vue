<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header -->
    <q-header elevated :class="headerClass">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
          v-if="!$q.platform.is.mobile"
        />

        <q-toolbar-title class="text-weight-bold">
          <q-icon name="mdi-robot-mower" class="q-mr-sm" />
          YardRover
        </q-toolbar-title>

        <q-space />

        <!-- Connection Status Chip -->
        <ConnectionStatus />

        <!-- Theme Toggle -->
        <q-btn
          flat
          round
          dense
          :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          @click="toggleTheme"
          class="q-ml-sm"
        >
          <q-tooltip>Toggle theme</q-tooltip>
        </q-btn>

        <!-- Settings -->
        <q-btn flat round dense icon="settings" to="/settings" class="q-ml-sm">
          <q-tooltip>Settings</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- Side Drawer -->
    <q-drawer v-model="leftDrawerOpen" show-if-above bordered :width="250" :breakpoint="768">
      <q-list>
        <q-item-label header class="text-grey-8"> Navigation </q-item-label>

        <NavMenuItem v-for="item in navigationItems" :key="item.path" v-bind="item" />
      </q-list>

      <!-- Device Info Footer -->
      <div class="absolute-bottom q-pa-md" v-if="deviceInfo">
        <q-card flat bordered>
          <q-card-section class="q-py-sm">
            <div class="text-caption text-grey-7">Device</div>
            <div class="text-subtitle2">{{ deviceInfo.name }}</div>
            <div class="text-caption text-grey-6">{{ deviceInfo.chipModel }}</div>
          </q-card-section>
        </q-card>
      </div>
    </q-drawer>

    <!-- Page Container -->
    <q-page-container>
      <!-- <router-view /> -->
      <router-view v-slot="{ Component }">
        <transition name="fade-transform" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </q-page-container>

    <!-- Mobile Bottom Navigation -->
    <q-footer v-if="$q.platform.is.mobile" elevated>
      <q-tabs v-model="currentTab" inline-label class="text-grey-7" active-color="primary">
        <q-route-tab
          v-for="item in mobileNavItems"
          :key="item.path"
          :name="item.path"
          :icon="item.icon"
          :label="item.label"
          :to="item.path"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import { useDeviceStore } from '../stores/device';
import ConnectionStatus from '../components/layout/ConnectionStatus.vue';
import NavMenuItem from '../components/layout/NavMenuItem.vue';

const $q = useQuasar();
const route = useRoute();
const deviceStore = useDeviceStore();

const leftDrawerOpen = ref(false);
const currentTab = ref(route.path);

const isDark = computed(() => $q.dark.isActive);
const deviceInfo = computed(() => deviceStore.deviceInfo);

const headerClass = computed(() => ({
  'bg-primary': !isDark.value,
  'bg-dark': isDark.value,
}));

const navigationItems = [
  {
    label: 'Dashboard',
    icon: 'mdi-view-dashboard',
    path: '/',
    description: 'System overview',
  },
  {
    label: 'Control',
    icon: 'mdi-gamepad-variant',
    path: '/control',
    description: 'Manual control',
  },
  {
    label: 'Missions',
    icon: 'mdi-map-marker-path',
    path: '/missions',
    description: 'Plan and execute missions',
  },
  {
    label: 'Tasks',
    icon: 'mdi-format-list-checks',
    path: '/tasks',
    description: 'Manage tasks',
  },
  {
    label: 'Parameters',
    icon: 'mdi-tune',
    path: '/parameters',
    description: 'MAVLink parameters',
  },
  {
    label: 'Network',
    icon: 'mdi-wifi',
    path: '/network',
    description: 'WiFi settings',
  },
  {
    label: 'Health',
    icon: 'mdi-heart-pulse',
    path: '/health',
    description: 'System health',
  },
  {
    label: 'RTCM',
    icon: 'mdi-satellite-variant',
    path: '/rtcm',
    description: 'GPS corrections',
  },
];

const mobileNavItems = navigationItems.slice(0, 5).map((item) => ({
  ...item,
  label: item.label.substring(0, 8), // Shorten labels for mobile
}));

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleTheme() {
  $q.dark.toggle();
  // Save preference
  localStorage.setItem('yardrover-theme', isDark.value ? 'dark' : 'light');
}

// Sync route with mobile tab
watch(route, (newRoute) => {
  currentTab.value = newRoute.path;
});

// Load theme preference
const savedTheme = localStorage.getItem('yardrover-theme');
if (savedTheme) {
  $q.dark.set(savedTheme === 'dark');
}
</script>

<style lang="scss" scoped>
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all 0.2s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
