<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/common/Button.vue'
import { useUnitsStore } from '@/stores/units'
import { useFeaturesStore } from '@/stores/features'
import type { Zone } from '@/types'
import { getZoneTypeName, getZoneTypeIcon } from '@/types'

const unitsStore = useUnitsStore()
const featuresStore = useFeaturesStore()

interface Props {
  zone: Zone & {
    status?: 'active' | 'inactive' | 'pending'
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
  toggleStatus: [id: string]
}>()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const zoneTypeName = computed(() => {
  return getZoneTypeName(props.zone.type, isConsumerMode.value)
})

const zoneTypeIcon = computed(() => {
  return getZoneTypeIcon(props.zone.type)
})
</script>

<template>
  <Card>
    <div class="zone-card-content">
      <div class="zone-header">
        <div class="zone-color" :style="{ backgroundColor: zone.color }"></div>
        <div class="zone-info">
          <h3 class="zone-name">
            <span class="zone-icon">{{ zoneTypeIcon }}</span>
            {{ zone.name }}
          </h3>
          <span class="zone-type">{{ zoneTypeName }}</span>
        </div>
        <StatusBadge :status="zone.status === 'active' ? 'success' : 'pending'" :label="zone.status" />
      </div>

      <div class="zone-stats">
        <div class="stat">
          <span class="stat-label">Area</span>
          <span class="stat-value">{{ unitsStore.formatArea(zone.area) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Last Modified</span>
          <span class="stat-value">{{ zone.lastModified }}</span>
        </div>
      </div>

      <div class="zone-actions">
        <Button variant="outline" size="sm" @click="emit('edit', zone.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </Button>
        <Button variant="outline" size="sm" @click="emit('toggleStatus', zone.id)">
          <svg v-if="zone.status === 'active'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          {{ zone.status === 'active' ? 'Deactivate' : 'Activate' }}
        </Button>
        <Button variant="danger" size="sm" @click="emit('delete', zone.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </Button>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.zone-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.zone-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.zone-color {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius);
  flex-shrink: 0;
}

.zone-info {
  flex: 1;
}

.zone-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zone-icon {
  font-size: 1.25rem;
}

.zone-type {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.zone-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.zone-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  svg {
    width: 14px;
    height: 14px;
  }
}
</style>
