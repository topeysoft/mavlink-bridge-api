<template>
  <q-layout view="lHh LpR fFf">
    <!-- Header -->
    <q-header elevated class="bg-primary">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        
        <q-toolbar-title class="flex items-center">
          <AppLogo class="q-mr-sm" />
          <span>YardRover Control</span>
        </q-toolbar-title>
        
        <ConnectionIndicator />
      </q-toolbar>
    </q-header>
    
    <!-- Left Drawer -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
      :breakpoint="600"
    >
      <q-list>
        <q-item-label header class="text-primary">
          Navigation
        </q-item-label>
        
        <NavItem
          v-for="item in navigationItems"
          :key="item.path"
          v-bind="item"
        />
      </q-list>
    </q-drawer>
    
    <!-- Page Container -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppLogo from '@/components/common/AppLogo.vue';
import ConnectionIndicator from '@/components/common/ConnectionIndicator.vue';
import NavItem from '@/components/layout/NavItem.vue';

const leftDrawerOpen = ref(false);

const navigationItems = [
  {
    title: 'Dashboard',
    icon: 'dashboard',
    path: '/',
    color: 'primary'
  },
  {
    title: 'Connection',
    icon: 'wifi',
    path: '/connection',
    color: 'info'
  },
  {
    title: 'Control',
    icon: 'control_camera',
    path: '/control',
    color: 'accent'
  },
  {
    title: 'Missions',
    icon: 'map',
    path: '/missions',
    color: 'secondary'
  },
  {
    title: 'Tasks',
    icon: 'task_alt',
    path: '/tasks',
    color: 'positive'
  },
  {
    title: 'Parameters',
    icon: 'tune',
    path: '/parameters',
    color: 'purple'
  },
  {
    title: 'RTCM',
    icon: 'satellite',
    path: '/rtcm',
    color: 'orange'
  },
  {
    title: 'Network',
    icon: 'router',
    path: '/network',
    color: 'cyan'
  },
  {
    title: 'Health',
    icon: 'health_and_safety',
    path: '/health',
    color: 'green'
  },
  {
    title: 'Settings',
    icon: 'settings',
    path: '/settings',
    color: 'grey-7'
  }
];

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>

<style lang="scss">
@import '@/assets/styles/variables';
@import '@/assets/styles/mixins';

.q-header {
  @include nature-gradient($primary);
}
</style>