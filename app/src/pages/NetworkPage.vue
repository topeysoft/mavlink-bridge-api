<template>
  <q-page class="network-page">
    <div class="page-container">
      <h1 class="text-h4 text-primary q-mb-md">Network</h1>
      <p class="text-body1 text-secondary">
        Network and WiFi configuration
      </p>
      
      <q-card class="nature-card q-mt-lg">
        <q-card-section>
          <div class="text-h6 q-mb-md">Network Settings</div>
          <p>Network configuration interface will be implemented in later stages.</p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Network page - to be implemented later
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';
.network-page {
  padding: $spacing-lg;
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
}
</style>