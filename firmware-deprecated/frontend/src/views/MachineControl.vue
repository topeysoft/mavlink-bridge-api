<template>
  <q-page class="control-page">
    <MachineManagementView />
  </q-page>
</template>

<script setup lang="ts">
import MachineManagementView from '@/components/machines/MachineManagementView.vue'
</script>

<style scoped lang="scss">
.control-page {
  height: 100%;
  min-height: 100vh;
}
</style>
