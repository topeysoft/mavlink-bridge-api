<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Component Status</div>
      
      <div class="row q-col-gutter-sm">
        <div
          v-for="component in components"
          :key="component.name"
          class="col-6 col-sm-4 col-md-3"
        >
          <div
            class="component-status-item"
            :class="`bg-${component.healthy ? 'positive' : 'negative'}`"
          >
            <q-icon
              :name="getComponentIcon(component.name)"
              size="24px"
              color="white"
            />
            <div class="text-caption text-white q-mt-xs">
              {{ component.name }}
            </div>
            <q-tooltip>
              Status: {{ component.status }}
              <span v-if="component.message">
                <br>{{ component.message }}
              </span>
            </q-tooltip>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
interface ComponentHealth {
  name: string
  healthy: boolean
  status: string
  lastUpdate: number
  message?: string
}

interface Props {
  components: ComponentHealth[]
}

defineProps<Props>()

function getComponentIcon(name: string): string {
  const iconMap: Record<string, string> = {
    'Storage': 'mdi-harddisk',
    'WiFi': 'mdi-wifi',
    'MAVLink': 'mdi-drone',
    'RTCM': 'mdi-satellite-variant',
    'WebSocket': 'mdi-connection',
    'Tasks': 'mdi-format-list-checks',
    'GPS': 'mdi-crosshairs-gps',
    'IMU': 'mdi-axis-arrow'
  }
  return iconMap[name] || 'mdi-chip'
}
</script>

<style lang="scss" scoped>
.component-status-item {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
</style>