<template>
  <q-page class="tasks-page">
    <div class="page-container">
      <h1 class="text-h4 text-primary q-mb-md">Tasks</h1>
      <p class="text-body1 text-secondary">
        Manage and schedule tasks
      </p>
      
      <q-card class="nature-card q-mt-lg">
        <q-card-section>
          <div class="text-h6 q-mb-md">Task Management</div>
          <p>Task management interface will be implemented in Stage 6.</p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Tasks page - to be implemented in Stage 6
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';
.tasks-page {
  padding: $spacing-lg;
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
}
</style>