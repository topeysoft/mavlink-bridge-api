<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Checkbox from '@/components/common/Checkbox.vue'
import { useFeaturesStore } from '@/stores/features'
import type { ZoneType, ZoneSummary } from '@client'

interface Props {
  compatibleZoneTypes: ZoneType[]
  availableZones: ZoneSummary[]
}

const props = defineProps<Props>()

const selectedZones = defineModel<string[]>('selectedZones', { required: true })

const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const title = computed(() => isConsumerMode.value ? 'Where should we work?' : 'Select Zones')

const description = computed(() =>
  isConsumerMode.value
    ? 'Choose the areas you want included in this job'
    : 'Select one or more zones for this mission'
)

const selectAllLabel = computed(() =>
  isConsumerMode.value ? 'Select all areas' : 'Select all zones'
)

const allSelected = computed(() =>
  props.availableZones.length > 0 &&
  props.availableZones.every(z => selectedZones.value.includes(z.id))
)

const someSelected = computed(() =>
  selectedZones.value.length > 0 && !allSelected.value
)

function formatArea(sqm: number): string {
  if (isConsumerMode.value) {
    // Convert to acres for consumer
    const acres = sqm / 4047
    if (acres < 0.1) {
      return `${Math.round(sqm)} sq ft`
    }
    return `${acres.toFixed(2)} acres`
  }
  // Technical mode uses sq meters
  if (sqm < 1000) {
    return `${Math.round(sqm)} m²`
  }
  return `${(sqm / 1000).toFixed(2)} km²`
}

function getZoneTypeLabel(type: ZoneType): string {
  const labels: Record<ZoneType, { consumer: string; technical: string }> = {
    lawn: { consumer: 'Lawn', technical: 'Lawn' },
    garden: { consumer: 'Garden', technical: 'Garden' },
    driveway: { consumer: 'Driveway', technical: 'Driveway' },
    patio: { consumer: 'Patio', technical: 'Patio' },
    pathway: { consumer: 'Path', technical: 'Pathway' },
    flower_bed: { consumer: 'Flower Bed', technical: 'Flower Bed' },
    vegetable_garden: { consumer: 'Veggie Garden', technical: 'Vegetable Garden' },
    pool_area: { consumer: 'Pool Area', technical: 'Pool Area' },
    play_area: { consumer: 'Play Area', technical: 'Play Area' },
    parking: { consumer: 'Parking', technical: 'Parking Area' }
  }
  const label = labels[type] || { consumer: type, technical: type }
  return isConsumerMode.value ? label.consumer : label.technical
}

function toggleZone(zoneId: string) {
  const index = selectedZones.value.indexOf(zoneId)
  if (index === -1) {
    selectedZones.value = [...selectedZones.value, zoneId]
  } else {
    selectedZones.value = selectedZones.value.filter(id => id !== zoneId)
  }
}

function toggleAll() {
  if (allSelected.value) {
    selectedZones.value = []
  } else {
    selectedZones.value = props.availableZones.map(z => z.id)
  }
}

function isZoneSelected(zoneId: string): boolean {
  return selectedZones.value.includes(zoneId)
}
</script>

<template>
  <div class="zone-selection-step" :class="{ 'consumer-step': isConsumerMode }">
    <div class="step-header">
      <h3 class="step-title">{{ title }}</h3>
      <p class="step-description">{{ description }}</p>
    </div>

    <div v-if="availableZones.length === 0" class="empty-state">
      <div class="empty-icon">🗺️</div>
      <p class="empty-message">
        {{ isConsumerMode
          ? 'No areas are set up yet. Add areas in Settings first.'
          : 'No compatible zones found. Create zones that match this template\'s requirements.'
        }}
      </p>
    </div>

    <template v-else>
      <div class="select-all-row">
        <Checkbox
          :model-value="allSelected"
          :indeterminate="someSelected"
          @update:model-value="toggleAll"
        >
          {{ selectAllLabel }}
        </Checkbox>
        <span class="zone-count">
          {{ selectedZones.length }} / {{ availableZones.length }}
          {{ isConsumerMode ? 'selected' : 'zones selected' }}
        </span>
      </div>

      <div class="zone-list">
        <Card
          v-for="zone in availableZones"
          :key="zone.id"
          class="zone-card"
          :class="{ 'selected': isZoneSelected(zone.id) }"
          @click="toggleZone(zone.id)"
        >
          <div class="zone-content">
            <Checkbox
              :model-value="isZoneSelected(zone.id)"
              @update:model-value="toggleZone(zone.id)"
              @click.stop
            />
            <div class="zone-info">
              <span class="zone-name">{{ zone.name }}</span>
              <span class="zone-meta">
                <span class="zone-type">{{ getZoneTypeLabel(zone.type) }}</span>
                <span class="zone-area">{{ formatArea(zone.area) }}</span>
              </span>
            </div>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.zone-selection-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.step-header {
  text-align: center;
}

.consumer-step .step-header {
  padding: var(--spacing-md) 0;
}

.step-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-step .step-title {
  font-size: var(--font-size-xl);
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2xl);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
}

.empty-message {
  color: var(--text-secondary);
  max-width: 300px;
}

.select-all-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.zone-count {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.zone-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.zone-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    border-color: var(--primary);
  }

  &.selected {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.05);
  }
}

.zone-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.consumer-step .zone-content {
  padding: var(--spacing-md);
}

.zone-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.zone-name {
  font-weight: 600;
  color: var(--text-primary);
}

.consumer-step .zone-name {
  font-size: var(--font-size-lg);
}

.zone-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.zone-type {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.zone-area {
  display: flex;
  align-items: center;
}
</style>
