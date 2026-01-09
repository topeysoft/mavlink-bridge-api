<template>
  <q-page class="dashboard-page">
    <DashboardView />
  </q-page>
</template>

<script setup lang="ts">
import DashboardView from '@/components/dashboard/DashboardView.vue'
</script>

<style scoped lang="scss">
.dashboard-page {
  height: 100%;
  min-height: 100vh;
}
</style>
