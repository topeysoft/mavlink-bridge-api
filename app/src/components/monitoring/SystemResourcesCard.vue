<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'

interface SystemResources {
  cpu: number
  memory: { used: number; total: number }
  temperature: number
  storage: { used: number; total: number }
}

const resources = ref<SystemResources>({
  cpu: 45,
  memory: { used: 1240, total: 2048 },
  temperature: 52,
  storage: { used: 8.5, total: 16 }
})

const getTemperatureColor = (temp: number) => {
  if (temp < 50) return 'var(--status-success)'
  if (temp < 70) return 'var(--status-warning)'
  return 'var(--status-error)'
}
</script>

<template>
  <Card title="System Resources">
    <div class="resources-grid">
      <div class="resource">
        <ProgressBar
          :value="resources.cpu"
          :max="100"
          label="CPU Usage"
          color="var(--status-info)"
        />
      </div>

      <div class="resource">
        <ProgressBar
          :value="resources.memory.used"
          :max="resources.memory.total"
          label="Memory"
          color="var(--primary-green)"
        />
        <div class="resource-detail">
          {{ resources.memory.used }} MB / {{ resources.memory.total }} MB
        </div>
      </div>

      <div class="resource">
        <ProgressBar
          :value="resources.temperature"
          :max="85"
          label="Temperature"
          :color="getTemperatureColor(resources.temperature)"
        />
        <div class="resource-detail">{{ resources.temperature }}°C</div>
      </div>

      <div class="resource">
        <ProgressBar
          :value="resources.storage.used"
          :max="resources.storage.total"
          label="Storage"
          color="var(--status-warning)"
        />
        <div class="resource-detail">
          {{ resources.storage.used.toFixed(1) }} GB / {{ resources.storage.total }} GB
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.resources-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.resource {
  .resource-detail {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
  }
}
</style>
