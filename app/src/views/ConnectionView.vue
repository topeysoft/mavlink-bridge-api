<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useFeaturesStore } from '@/stores/features'
import DeviceDiscoveryCard from '@/components/connection/DeviceDiscoveryCard.vue'
import SavedDevicesList from '@/components/connection/SavedDevicesList.vue'
import ConsumerConnectionView from './ConsumerConnectionView.vue'

const connectionStore = useConnectionStore()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Auto-discover devices on mount (for technical users)
onMounted(async () => {
  if (!isConsumerMode.value) {
    // Run discovery automatically when page loads
    await connectionStore.discoverLocalDevices()
  }
})
</script>

<template>
  <!-- Consumer Mode: Friendly guided experience -->
  <ConsumerConnectionView v-if="isConsumerMode" />

  <!-- Technical Mode: Detailed technical interface -->
  <div v-else class="connection-view">
    <div class="connection-header">
      <h1>Device Connection</h1>
      <p class="connection-subtitle">
        Connect to your YardRover device to begin operation
      </p>
    </div>

    <div class="connection-content">
      <!-- Device Discovery -->
      <DeviceDiscoveryCard />

      <!-- Saved Devices -->
      <SavedDevicesList v-if="connectionStore.savedDevices.length > 0" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.connection-view {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.connection-header {
  margin-bottom: var(--spacing-xl);

  h1 {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  .connection-subtitle {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
  }
}

.connection-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}
</style>
