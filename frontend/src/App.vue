<template>
  <div id="app">
    <q-layout view="hHh lpR fFf">
      <!-- Header -->
      <q-header elevated class="bg-grass-green text-white">
        <q-toolbar>
          <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

          <q-toolbar-title>
            <q-icon name="eco" class="q-mr-sm" />
            YardRover Control
          </q-toolbar-title>

          <div>v1.0.0</div>
        </q-toolbar>
      </q-header>

      <!-- Navigation Drawer -->
      <q-drawer v-model="leftDrawerOpen" show-if-above bordered :width="250" :breakpoint="600">
        <q-scroll-area
          style="height: calc(100% - 150px); margin-top: 150px; border-right: 1px solid #ddd"
        >
          <q-list padding>
            <q-item
              v-for="route in navigationRoutes"
              :key="route.name"
              clickable
              v-ripple
              :to="route.path"
              exact-active-class="text-grass-green"
            >
              <q-item-section avatar>
                <q-icon :name="route.meta?.icon as string" />
              </q-item-section>

              <q-item-section>
                {{ route.meta?.title }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>

        <q-img
          class="absolute-top"
          src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=250&h=150&fit=crop&crop=center"
          style="height: 150px"
        >
          <div class="absolute-bottom bg-transparent">
            <q-avatar size="56px" class="q-mb-sm">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=56&h=56&fit=crop&crop=face&auto=format"
              />
            </q-avatar>
            <div class="text-weight-bold">YardRover User</div>
            <div>@yardrover</div>
          </div>
        </q-img>
      </q-drawer>

      <!-- Page Container -->
      <q-page-container>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </q-page-container>
    </q-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { routes } from './router/routes'

const leftDrawerOpen = ref(false)

const navigationRoutes = computed(() =>
  routes.filter(route => route.meta?.title && route.path !== '/')
)

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.text-grass-green {
  color: #4caf50 !important;
}
</style>
