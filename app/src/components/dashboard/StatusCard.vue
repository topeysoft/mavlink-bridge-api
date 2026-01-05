<script setup lang="ts">
import { computed } from 'vue'
import { useVehicleStore } from '@/stores/vehicle'
import { useGpsStore } from '@/stores/gps'
import { useBatteryStore } from '@/stores/battery'

const vehicleStore = useVehicleStore()
const gpsStore = useGpsStore()
const batteryStore = useBatteryStore()

const systemStatus = computed(() => ({
  mode: vehicleStore.vehicleState.mode,
  gps: gpsStore.fixTypeString,
  battery: Math.round(batteryStore.batteryInfo.percent),
  attachment: 'Mower Deck',
  status: vehicleStore.vehicleState.armed ? 'Armed' : 'Ready'
}))
