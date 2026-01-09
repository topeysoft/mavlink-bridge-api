<template>
  <q-page class="api-demo-page">
    <div class="q-pa-md">
      <ApiDemo />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import ApiDemo from '@/components/ApiDemo.vue'
</script>

<style scoped>
.api-demo-page {
  background: #f5f5f5;
  min-height: 100vh;
}
</style>
