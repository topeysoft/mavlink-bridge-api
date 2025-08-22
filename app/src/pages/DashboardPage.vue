<template>
  <BasePage
    title="Dashboard"
    subtitle="System overview and status"
    :loading="loading"
    :error="error"
    @retry="loadData"
  >
    <template #actions>
      <q-btn
        round
        flat
        icon="refresh"
        @click="loadData"
        :loading="loading"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </template>

    <ResponsiveGrid :items="statusCards">
      <template #default="{ item }">
        <q-card>
          <q-card-section>
            <div class="row items-center no-wrap">
              <div class="col">
                <div class="text-caption text-grey-7">{{ (item as StatusCard).label }}</div>
                <div class="text-h6">{{ (item as StatusCard).value }}</div>
              </div>
              <div class="col-auto">
                <q-icon :name="(item as StatusCard).icon" size="24px" :color="(item as StatusCard).color" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </template>
    </ResponsiveGrid>
  </BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDeviceStore } from '../stores/device'
import BasePage from '../components/layout/BasePage.vue'
import ResponsiveGrid from '../components/layout/ResponsiveGrid.vue'

interface StatusCard {
  label: string
  value: string
  icon: string
  color: string
}

const deviceStore = useDeviceStore()

const loading = ref(false)
const error = ref<Error | null>(null)

const statusCards = computed(() => [
  {
    label: 'Status',
    value: deviceStore.isHealthy ? 'Healthy' : 'Degraded',
    icon: deviceStore.isHealthy ? 'mdi-check-circle' : 'mdi-alert-circle',
    color: deviceStore.isHealthy ? 'positive' : 'warning'
  },
  {
    label: 'Free Memory',
    value: `${(deviceStore.freeHeap / 1024).toFixed(0)} KB`,
    icon: 'mdi-memory',
    color: 'primary'
  },
  {
    label: 'CPU Usage',
    value: `${deviceStore.systemMetrics?.cpuUsage || 0}%`,
    icon: 'mdi-cpu-64-bit',
    color: 'info'
  },
  {
    label: 'Temperature',
    value: `${deviceStore.systemMetrics?.temperature || 0}°C`,
    icon: 'mdi-thermometer',
    color: 'orange'
  }
])

async function loadData() {
  loading.value = true
  error.value = null
  
  try {
    await deviceStore.fetchHealth()
  } catch (err) {
    error.value = err as Error
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})
</script>