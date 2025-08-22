<template>
  <div class="mission-map-view">
    <MapContainer
      :center="mapCenter"
      :zoom="mapZoom"
      :waypoints="waypoints"
      :vehicle-position="vehiclePosition"
      :show-trail="true"
      ref="mapRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionStore } from '../../stores/mission'
import { useMAVLinkStore } from '../../stores/mavlink'
import MapContainer from '@/components/map/MapContainer.vue'

const missionStore = useMissionStore()
const mavlinkStore = useMAVLinkStore()

const mapRef = ref()
const mapCenter = ref<[number, number]>([40.7128, -74.0060])
const mapZoom = ref(15)

const waypoints = computed(() => missionStore.waypoints)
const vehiclePosition = computed(() => {
  const vehicle = mavlinkStore.vehicleState
  return { 
    lat: vehicle.position.lat || 40.7128, 
    lng: vehicle.position.lng || -74.0060, 
    heading: vehicle.heading 
  }
})
</script>

<style lang="scss" scoped>
.mission-map-view {
  height: 100%;
  width: 100%;
}
</style>