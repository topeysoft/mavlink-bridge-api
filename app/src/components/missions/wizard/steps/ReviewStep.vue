<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Badge from '@/components/common/Badge.vue'
import { useFeaturesStore } from '@/stores/features'
import { useZonesStore } from '@/stores/zones'
import type { MissionTemplate, WeatherCheckResult, PeripheralAvailabilityStatus } from '@client'

interface Props {
  template: MissionTemplate
  selectedZones: string[]
  scheduleType: 'now' | 'scheduled'
  scheduledTime: Date | null
  weatherStatus: WeatherCheckResult
  peripheralStatus: PeripheralAvailabilityStatus
}

const props = defineProps<Props>()

const missionName = defineModel<string>('missionName', { required: true })

const featuresStore = useFeaturesStore()
const zonesStore = useZonesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const title = computed(() => isConsumerMode.value ? 'Ready to go!' : 'Review Mission')

const description = computed(() =>
  isConsumerMode.value
    ? 'Check the details and start your job'
    : 'Review mission configuration before creation'
)

const templateName = computed(() =>
  isConsumerMode.value ? props.template.consumer_name : props.template.name
)

const templateDescription = computed(() =>
  isConsumerMode.value ? props.template.consumer_description : props.template.description
)

const zoneNames = computed(() => {
  return props.selectedZones.map(id => {
    const zone = zonesStore.zones.find(z => z.id === id)
    return zone?.name || id
  })
})

const scheduleLabel = computed(() => {
  if (props.scheduleType === 'now') {
    return isConsumerMode.value ? 'Starting now' : 'Immediate execution'
  }
  if (props.scheduledTime) {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }
    return props.scheduledTime.toLocaleDateString(undefined, options)
  }
  return isConsumerMode.value ? 'Not set' : 'No schedule'
})

const estimatedDuration = computed(() => {
  // Calculate based on template time and zone areas
  const totalArea = props.selectedZones.reduce((sum, id) => {
    const zone = zonesStore.zones.find(z => z.id === id)
    return sum + (zone?.area_sqm || 0)
  }, 0)

  const acres = totalArea / 4047
  const minutes = Math.ceil(acres * props.template.estimated_time_per_acre)

  if (minutes < 60) {
    return isConsumerMode.value
      ? `About ${minutes} minutes`
      : `~${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  if (isConsumerMode.value) {
    return remainingMins > 0
      ? `About ${hours} hour${hours > 1 ? 's' : ''} ${remainingMins} minutes`
      : `About ${hours} hour${hours > 1 ? 's' : ''}`
  }
  return remainingMins > 0
    ? `~${hours}h ${remainingMins}m`
    : `~${hours}h`
})

const allPeripheralsReady = computed(() => props.peripheralStatus.all_required_available)

const nameLabel = computed(() => isConsumerMode.value ? 'Job Name' : 'Mission Name')
const namePlaceholder = computed(() => isConsumerMode.value ? 'Give your job a name' : 'Enter mission name')
</script>

<template>
  <div class="review-step" :class="{ 'consumer-step': isConsumerMode }">
    <div class="step-header">
      <h3 class="step-title">{{ title }}</h3>
      <p class="step-description">{{ description }}</p>
    </div>

    <!-- Mission Name Input -->
    <div class="name-input-section">
      <label class="input-label">{{ nameLabel }}</label>
      <input
        v-model="missionName"
        type="text"
        class="name-input"
        :placeholder="namePlaceholder"
      />
    </div>

    <!-- Template Summary -->
    <Card class="summary-card">
      <div class="summary-header">
        <span class="summary-emoji">{{ template.emoji }}</span>
        <div class="summary-info">
          <h4 class="summary-title">{{ templateName }}</h4>
          <p class="summary-description">{{ templateDescription }}</p>
        </div>
      </div>
    </Card>

    <!-- Details Grid -->
    <div class="details-grid">
      <!-- Zones -->
      <Card class="detail-card">
        <div class="detail-header">
          <span class="detail-icon">🗺️</span>
          <span class="detail-label">
            {{ isConsumerMode ? 'Areas' : 'Zones' }}
          </span>
        </div>
        <div class="detail-content">
          <div class="zone-tags">
            <span v-for="name in zoneNames" :key="name" class="zone-tag">
              {{ name }}
            </span>
          </div>
          <span class="detail-meta">
            {{ selectedZones.length }} {{ isConsumerMode ? 'area' : 'zone' }}{{ selectedZones.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </Card>

      <!-- Schedule -->
      <Card class="detail-card">
        <div class="detail-header">
          <span class="detail-icon">{{ scheduleType === 'now' ? '🚀' : '📅' }}</span>
          <span class="detail-label">
            {{ isConsumerMode ? 'When' : 'Schedule' }}
          </span>
        </div>
        <div class="detail-content">
          <span class="detail-value">{{ scheduleLabel }}</span>
        </div>
      </Card>

      <!-- Duration -->
      <Card class="detail-card">
        <div class="detail-header">
          <span class="detail-icon">⏱️</span>
          <span class="detail-label">
            {{ isConsumerMode ? 'How Long' : 'Est. Duration' }}
          </span>
        </div>
        <div class="detail-content">
          <span class="detail-value">{{ estimatedDuration }}</span>
        </div>
      </Card>

      <!-- Equipment Status -->
      <Card class="detail-card">
        <div class="detail-header">
          <span class="detail-icon">🔧</span>
          <span class="detail-label">
            {{ isConsumerMode ? 'Equipment' : 'Peripherals' }}
          </span>
        </div>
        <div class="detail-content">
          <Badge :variant="allPeripheralsReady ? 'success' : 'warning'" size="small">
            {{ allPeripheralsReady
              ? (isConsumerMode ? 'Ready' : 'All Available')
              : (isConsumerMode ? 'Check Needed' : 'Missing Required')
            }}
          </Badge>
          <div v-if="!allPeripheralsReady" class="missing-list">
            <span
              v-for="p in peripheralStatus.required.filter(r => !r.available)"
              :key="p.peripheral_type"
              class="missing-item"
            >
              {{ p.peripheral_type }}
            </span>
          </div>
        </div>
      </Card>
    </div>

    <!-- Weather Warning -->
    <Card v-if="!weatherStatus.suitable" class="warning-card">
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <div class="warning-info">
          <span class="warning-title">
            {{ isConsumerMode ? 'Weather Alert' : 'Weather Warning' }}
          </span>
          <span class="warning-message">
            {{ weatherStatus.reasons.length > 0 ? weatherStatus.reasons[0] : (isConsumerMode
              ? 'Weather conditions might affect the job'
              : 'Current conditions may not be optimal'
            ) }}
          </span>
        </div>
      </div>
    </Card>

    <!-- Peripheral Warning -->
    <Card v-if="!allPeripheralsReady" class="warning-card">
      <div class="warning-content">
        <span class="warning-icon">🔧</span>
        <div class="warning-info">
          <span class="warning-title">
            {{ isConsumerMode ? 'Equipment Needed' : 'Missing Peripherals' }}
          </span>
          <span class="warning-message">
            {{ isConsumerMode
              ? 'Some equipment needs to be connected before starting'
              : 'Required peripherals must be available to run this mission'
            }}
          </span>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped lang="scss">
.review-step {
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

.name-input-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.input-label {
  font-weight: 500;
  color: var(--text-primary);
}

.name-input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--bg-primary);
  color: var(--text-primary);

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
  }

  &::placeholder {
    color: var(--text-tertiary);
  }
}

.consumer-step .name-input {
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
}

.summary-card {
  background: var(--bg-secondary);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.consumer-step .summary-header {
  padding: var(--spacing-md);
}

.summary-emoji {
  font-size: 36px;
}

.consumer-step .summary-emoji {
  font-size: 48px;
}

.summary-info {
  flex: 1;
}

.summary-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-step .summary-title {
  font-size: var(--font-size-xl);
}

.summary-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

@media (max-width: 600px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}

.detail-card {
  padding: var(--spacing-md);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.detail-icon {
  font-size: 20px;
}

.detail-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.detail-value {
  font-weight: 600;
  color: var(--text-primary);
}

.detail-meta {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.zone-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.zone-tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.missing-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.missing-item {
  font-size: var(--font-size-xs);
  color: var(--warning);
}

.warning-card {
  border-left: 4px solid var(--warning);
  background: rgba(var(--warning-rgb), 0.05);
}

.warning-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
}

.warning-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.warning-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.warning-title {
  font-weight: 600;
  color: var(--text-primary);
}

.warning-message {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
