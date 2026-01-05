<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFeaturesStore } from '@/stores/features'
import { useBatteryStore } from '@/stores/battery'
import { useGpsStore } from '@/stores/gps'
import { useImuStore } from '@/stores/imu'
import { useCompassStore } from '@/stores/compass'
import AlertsPanel from '@/components/dashboard/AlertsPanel.vue'
import QuickActionsCard from '@/components/dashboard/QuickActionsCard.vue'
import MapPreviewCard from '@/components/dashboard/MapPreviewCard.vue'
import ActivityTimeline from '@/components/dashboard/ActivityTimeline.vue'
import TelemetryCard from '@/components/dashboard/TelemetryCard.vue'
import BatteryWidget from '@/components/dashboard/widgets/BatteryWidget.vue'
import GpsWidget from '@/components/dashboard/widgets/GpsWidget.vue'
import SkeletonCard from '@/components/common/SkeletonCard.vue'
import ConsumerDashboardView from './ConsumerDashboardView.vue'

const router = useRouter()
const featuresStore = useFeaturesStore()
const batteryStore = useBatteryStore()
const gpsStore = useGpsStore()
const imuStore = useImuStore()
const compassStore = useCompassStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Loading state
const loading = ref(true)

// Battery level from live data
const batteryLevel = computed(() => Math.round(batteryStore.batteryInfo.percent))

// Dynamic battery color based on level
const batteryColor = computed(() => {
  if (batteryLevel.value > 60) return 'var(--status-success)'
  if (batteryLevel.value > 30) return 'var(--status-warning)'
  return 'var(--status-danger)'
})

// GPS status color
const gpsColor = computed(() => {
  if (!gpsStore.gpsInfo.hasLock) return 'var(--status-error)'
  if (gpsStore.gpsInfo.fixType >= 5) return 'var(--status-success)' // RTK
  if (gpsStore.gpsInfo.fixType >= 3) return 'var(--status-info)' // 3D fix
  return 'var(--status-warning)'
})

// IMU health color
const imuColor = computed(() => {
  const health = imuStore.health
  if (health === 'excellent') return 'var(--status-success)'
  if (health === 'good') return 'var(--status-info)'
  if (health === 'fair') return 'var(--status-warning)'
  return 'var(--status-danger)'
})

// Compass health color
const compassColor = computed(() => {
  if (compassStore.isCalibrated) return 'var(--status-success)'
  if (compassStore.calibrationQuality > 50) return 'var(--status-warning)'
  return 'var(--status-danger)'
})

// SVG icon paths
const icons: Record<string, string> = {
  mission: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/>',
  map: '<path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>',
  battery: '<path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/><rect x="9" y="6" width="6" height="12" rx="1" fill="white" opacity="0.3"/>',
  health: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
  gps: '<circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M1 12h6m6 0h6"></path>',
  imu: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="12" cy="12" r="4"/>',
  compass: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v4m0 12v4m10-10h-4m-12 0h-4"/><path d="M12 8l2 4-2 4-2-4z" fill="currentColor"/>'
}

const stats = computed(() => [
  { label: 'GPS Status', value: gpsStore.fixTypeString, icon: 'gps', color: gpsColor.value, route: null },
  { label: 'Battery Level', value: `${batteryLevel.value}%`, icon: 'battery', color: batteryColor.value, route: 'battery' },
  { label: 'IMU Status', value: imuStore.health.charAt(0).toUpperCase() + imuStore.health.slice(1), icon: 'imu', color: imuColor.value, route: null },
  { label: 'Compass', value: `${Math.round(compassStore.heading)}°`, icon: 'compass', color: compassColor.value, route: null }
])

// Navigate to a route
function navigateTo(routeName: string | null) {
  if (routeName) {
    router.push({ name: routeName })
  }
}

// Simulate loading data
onMounted(async () => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800))
  loading.value = false
})
</script>

<template>
  <!-- Consumer Mode Dashboard -->
  <ConsumerDashboardView v-if="isConsumerMode" />

  <!-- Technical Dashboard (Power User & Developer) -->
  <div v-else class="dashboard-view">
    <AlertsPanel />

    <!-- Stats Grid with Skeleton Loaders -->
    <div class="stats-grid">
      <template v-if="loading">
        <SkeletonCard v-for="i in 4" :key="i" variant="stat" />
      </template>
      <template v-else>
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="stat-card"
          :class="{ clickable: stat.route }"
          @click="navigateTo(stat.route)"
        >
          <div class="stat-icon-wrapper" :style="{ backgroundColor: stat.color }">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="white" v-html="icons[stat.icon]"></svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- Dashboard Grid with Skeleton Loaders -->
    <div class="dashboard-grid">
      <template v-if="loading">
        <SkeletonCard v-for="i in 4" :key="i" variant="default" />
      </template>
      <template v-else>
        <QuickActionsCard />
        <BatteryWidget />
        <GpsWidget />
        <MapPreviewCard />
        <ActivityTimeline />
        <TelemetryCard />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.dashboard-view {
  padding: var(--spacing-xl);
}

.stats-grid {
  @include auto-grid(250px);
  margin-bottom: var(--spacing-xl);
}

.stat-card {
  @include card;
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
  }

  &.clickable {
    cursor: pointer;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-3px);
    }

    &:active {
      transform: translateY(-1px);
    }
  }

  .stat-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
  }
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.dashboard-grid {
  @include auto-grid(400px);
  gap: var(--spacing-lg);
}
</style>
