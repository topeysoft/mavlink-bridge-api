<template>
  <div class="zone-type-selector">
    <h3 class="selector-title">{{ title }}</h3>
    <p v-if="description" class="selector-description">{{ description }}</p>

    <div class="zone-types-grid">
      <button
        v-for="type in availableTypes"
        :key="type"
        class="zone-type-button"
        :class="{ selected: modelValue === type }"
        @click="selectType(type)"
      >
        <div class="type-icon">{{ getZoneTypeIcon(type) }}</div>
        <div class="type-name">{{ getZoneTypeName(type, isConsumerMode) }}</div>
        <div class="type-description">{{ getZoneTypeDescription(type, isConsumerMode) }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZoneType } from '@/types'
import {
  getZoneTypeIcon,
  getZoneTypeName,
  getZoneTypeDescription,
  getAvailableZoneTypes
} from '@/types'
import { useFeaturesStore } from '@/stores/features'

interface Props {
  modelValue: ZoneType | null
  title?: string
  description?: string
}

interface Emits {
  (e: 'update:modelValue', value: ZoneType): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Select Zone Type',
  description: undefined
})

const emit = defineEmits<Emits>()

const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Get available zone types based on enabled features
const availableTypes = computed(() => {
  const enabledFeatures = new Set<string>()

  // Add enabled features from feature store
  if (featuresStore.isFeatureEnabled('security_patrol')) {
    enabledFeatures.add('security_patrol')
  }
  if (featuresStore.isFeatureEnabled('snow_clearing')) {
    enabledFeatures.add('snow_clearing')
  }
  if (featuresStore.isFeatureEnabled('precision_spraying')) {
    enabledFeatures.add('precision_spraying')
  }
  if (featuresStore.isFeatureEnabled('irrigation')) {
    enabledFeatures.add('irrigation')
  }
  if (featuresStore.isFeatureEnabled('debris_collection')) {
    enabledFeatures.add('debris_collection')
  }
  if (featuresStore.isFeatureEnabled('environmental_monitoring')) {
    enabledFeatures.add('environmental_monitoring')
  }

  return getAvailableZoneTypes(enabledFeatures)
})

function selectType(type: ZoneType) {
  emit('update:modelValue', type)
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.zone-type-selector {
  padding: 1rem;
}

.selector-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.selector-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.zone-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.zone-type-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: $primary;
    background: rgba($primary, 0.05);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: $primary;
    background: rgba($primary, 0.1);
    box-shadow: 0 0 0 3px rgba($primary, 0.2);
  }
}

.type-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.type-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
}

.type-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.4;
}
</style>
