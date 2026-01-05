<script setup lang="ts">
import { computed } from 'vue'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import HomeLocationSettings from '@/components/settings/HomeLocationSettings.vue'
import ConnectionSettings from '@/components/settings/ConnectionSettings.vue'
import VehicleSettings from '@/components/settings/VehicleSettings.vue'
import SafetySettings from '@/components/settings/SafetySettings.vue'
import UnitsSettings from '@/components/settings/UnitsSettings.vue'
import ThemeSettings from '@/components/settings/ThemeSettings.vue'
import SystemInfo from '@/components/settings/SystemInfo.vue'
import UserModeSelector from '@/components/settings/UserModeSelector.vue'
import AdvancedFeaturesSettings from '@/components/settings/AdvancedFeaturesSettings.vue'
import ConsumerSettings from '@/components/settings/ConsumerSettings.vue'
import { useFeaturesStore } from '@/stores/features'

const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const breadcrumbItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Settings' }
]
</script>

<template>
  <div class="settings-view">
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Consumer Mode Settings -->
    <div v-if="isConsumerMode" class="settings-container">
      <!-- User Mode Selector -->
      <section class="settings-section">
        <UserModeSelector />
      </section>

      <!-- Simplified Consumer Settings -->
      <ConsumerSettings />
    </div>

    <!-- Advanced Settings (Power User & Developer) -->
    <div v-else class="settings-container">
      <!-- User Mode Section -->
      <section class="settings-section">
        <UserModeSelector />
      </section>

      <!-- Advanced Features (Power Users & Developers only) -->
      <section class="settings-section">
        <AdvancedFeaturesSettings />
      </section>

      <!-- Home Location Section -->
      <section class="settings-section">
        <HomeLocationSettings />
      </section>

      <!-- Other Settings Grid -->
      <div class="settings-grid">
        <ThemeSettings />
        <UnitsSettings />
        <ConnectionSettings />
        <VehicleSettings />
        <SafetySettings />
        <div class="grid-full">
          <SystemInfo />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  padding: var(--spacing-xl);
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.settings-section {
  padding-bottom: var(--spacing-xl);
  border-bottom: 2px solid var(--border-color);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);

  .grid-full {
    grid-column: 1 / -1;
  }
}
</style>
