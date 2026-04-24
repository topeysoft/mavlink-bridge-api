<script setup lang="ts">
import Breadcrumb from '@/components/common/Breadcrumb.vue';
import LiveTelemetryCard from '@/components/monitoring/LiveTelemetryCard.vue';
import LiveMapCard from '@/components/monitoring/LiveMapCard.vue';
import AttitudeIndicator from '@/components/monitoring/AttitudeIndicator.vue';
import SystemResourcesCard from '@/components/monitoring/SystemResourcesCard.vue';
import MAVLinkStream from '@/components/monitoring/MAVLinkStream.vue';
import PositionCard from '@/components/monitoring/PositionCard.vue';
import ROS2TopicsCard from '@/components/monitoring/ROS2TopicsCard.vue';

const breadcrumbItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Monitoring' },
];
</script>

<template>
  <div class="monitoring-view">
    <Breadcrumb :items="breadcrumbItems" />

    <div class="monitoring-grid">
      <div class="grid-full">
        <LiveMapCard />
      </div>

      <div class="grid-full">
        <LiveTelemetryCard />
      </div>

      <AttitudeIndicator />
      <SystemResourcesCard />

      <div class="grid-full">
        <PositionCard />
      </div>

      <div class="grid-full">
        <MAVLinkStream />
      </div>

      <ROS2TopicsCard />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.monitoring-view {
  padding: var(--spacing-xl);
}

.monitoring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);

  .grid-full {
    grid-column: 1 / -1;
  }
}
</style>
