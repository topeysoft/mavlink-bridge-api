<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { useFeaturesStore } from '@/stores/features'
import StandaloneLayout from '@/layouts/StandaloneLayout.vue'
import TechnicalConnection from '@/components/connection/TechnicalConnection.vue'
import ConsumerConnection from '@/components/connection/ConsumerConnection.vue'

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
  <StandaloneLayout title="YardRover">
    <!-- Consumer Mode: Friendly guided experience -->
    <ConsumerConnection v-if="isConsumerMode" />

    <!-- Technical Mode: Detailed technical interface -->
    <TechnicalConnection v-else />
  </StandaloneLayout>
</template>
