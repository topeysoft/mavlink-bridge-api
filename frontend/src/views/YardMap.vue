<template>
  <q-page class="yard-map-page">
    <YardManagementView />
  </q-page>
</template>

<script setup lang="ts">
import YardManagementView from '@/components/yard/YardManagementView.vue'
</script>

<style scoped lang="scss">
.yard-map-page {
  height: 100%;
  min-height: 100vh;
}
</style>
