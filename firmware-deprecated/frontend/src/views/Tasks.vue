<template>
  <q-page class="tasks-page">
    <TaskManagementView />
  </q-page>
</template>

<script setup lang="ts">
import TaskManagementView from '@/components/tasks/TaskManagementView.vue'
</script>

<style scoped lang="scss">
.tasks-page {
  height: 100%;
  min-height: 100vh;
}
</style>

<style scoped lang="scss">
.tasks-page {
  .bg-earth-brown {
    background: linear-gradient(135deg, #795548, #5d4037);
  }
}
</style>
