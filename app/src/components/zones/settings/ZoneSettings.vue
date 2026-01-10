<template>
  <div class="zone-settings">
    <component
      :is="settingsComponent"
      v-if="settingsComponent"
      v-model="localSettings"
    />
    <div v-else class="no-settings">
      <p>No additional settings for this zone type.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ZoneType } from '@/types'
import MowingSettings from './MowingSettings.vue'

interface Props {
  zoneType: ZoneType
  modelValue: Record<string, any>
}

interface Emits {
  (e: 'update:modelValue', value: Record<string, any>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localSettings = ref<Record<string, any>>(props.modelValue || {})

// Map zone types to their settings components
const settingsComponentMap: Partial<Record<ZoneType, any>> = {
  mowing: MowingSettings,
  // TODO: Add other zone type settings components as they are created
  // patrol: PatrolSettings,
  // snow_clearing: SnowClearingSettings,
  // spraying: SprayingSettings,
  // watering: WateringSettings,
  // collection: CollectionSettings,
  // monitoring: MonitoringSettings,
  // staging: StagingSettings
}

const settingsComponent = computed(() => {
  return settingsComponentMap[props.zoneType]
})

watch(
  localSettings,
  (newValue) => {
    emit('update:modelValue', newValue)
  },
  { deep: true }
)

watch(
  () => props.modelValue,
  (newValue) => {
    localSettings.value = newValue || {}
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.zone-settings {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.no-settings {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}
</style>
