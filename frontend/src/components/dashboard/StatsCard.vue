<template>
  <q-card
    flat
    bordered
    class="stats-card"
    :class="[`stats-card--${color}`, { 'stats-card--clickable': clickable }]"
    @click="handleClick"
  >
    <q-card-section class="stats-card__content">
      <!-- Header row with icon and trend -->
      <div class="stats-card__header">
        <div class="stats-card__icon-container">
          <q-icon :name="icon" :color="color" size="24px" class="stats-card__icon" />
        </div>

        <div v-if="trend" class="stats-card__trend">
          <q-chip
            :color="trend.color"
            text-color="white"
            size="sm"
            dense
            :icon="trendIcon"
            class="stats-card__trend-chip"
          >
            {{ trend.value }}%
          </q-chip>
        </div>
      </div>

      <!-- Title -->
      <div class="stats-card__title">
        {{ title }}
      </div>

      <!-- Value section -->
      <div class="stats-card__value-container">
        <div class="stats-card__value">
          <span class="stats-card__primary-value">
            {{ formattedValue }}
          </span>
          <span v-if="suffix" class="stats-card__suffix">
            {{ suffix }}
          </span>
        </div>

        <div v-if="total !== undefined" class="stats-card__total">of {{ formattedTotal }}</div>
      </div>

      <!-- Progress bar for percentage values -->
      <div v-if="showProgress" class="stats-card__progress">
        <q-linear-progress
          :value="progressValue"
          :color="color"
          size="4px"
          rounded
          class="stats-card__progress-bar"
        />
      </div>

      <!-- Footer info -->
      <div v-if="subtitle || lastUpdated" class="stats-card__footer">
        <div v-if="subtitle" class="stats-card__subtitle">
          {{ subtitle }}
        </div>
        <div v-if="lastUpdated" class="stats-card__updated">
          Updated {{ formatTime(lastUpdated) }}
        </div>
      </div>
    </q-card-section>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading" color="primary" />

    <!-- Click ripple effect -->
    <q-ripple v-if="clickable" />
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Types
interface Trend {
  value: number
  direction: 'up' | 'down' | 'stable'
  color: string
}

interface Props {
  title: string
  value: number | string
  total?: number
  icon: string
  color?: string
  suffix?: string
  subtitle?: string
  trend?: Trend
  loading?: boolean
  lastUpdated?: Date
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
  loading: false,
  clickable: true
})

// Emits
defineEmits<{
  click: []
}>()

// Computed properties
const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const formattedTotal = computed(() => {
  if (props.total !== undefined) {
    return props.total.toLocaleString()
  }
  return ''
})

const showProgress = computed(() => {
  return props.total !== undefined && typeof props.value === 'number'
})

const progressValue = computed(() => {
  if (!showProgress.value) return 0
  return (props.value as number) / (props.total as number)
})

const trendIcon = computed(() => {
  if (!props.trend) return ''

  switch (props.trend.direction) {
    case 'up':
      return 'trending_up'
    case 'down':
      return 'trending_down'
    case 'stable':
      return 'trending_flat'
    default:
      return ''
  }
})

// Methods
const handleClick = () => {
  if (props.clickable) {
    // emit('click');
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}
</script>

<style lang="scss" scoped>
.stats-card {
  transition: all 0.2s ease;
  border-radius: 12px;
  background: var(--q-card-background);

  &--clickable {
    cursor: pointer;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

      .body--dark & {
        box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
      }
    }
  }

  // Color variants
  &--primary {
    border-left: 4px solid var(--q-primary);
  }

  &--positive {
    border-left: 4px solid var(--q-positive);
  }

  &--negative {
    border-left: 4px solid var(--q-negative);
  }

  &--warning {
    border-left: 4px solid var(--q-warning);
  }

  &--info {
    border-left: 4px solid var(--q-info);
  }
}

.stats-card__content {
  padding: 20px;
}

.stats-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.stats-card__icon-container {
  padding: 8px;
  border-radius: 8px;
  background-color: rgba(var(--q-primary-rgb), 0.1);

  .stats-card--positive & {
    background-color: rgba(var(--q-positive-rgb), 0.1);
  }

  .stats-card--negative & {
    background-color: rgba(var(--q-negative-rgb), 0.1);
  }

  .stats-card--warning & {
    background-color: rgba(var(--q-warning-rgb), 0.1);
  }

  .stats-card--info & {
    background-color: rgba(var(--q-info-rgb), 0.1);
  }
}

.stats-card__icon {
  display: block;
}

.stats-card__trend {
  margin-left: 8px;
}

.stats-card__trend-chip {
  font-size: 0.7rem;
  height: 20px;
}

.stats-card__title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--q-dark);
  margin-bottom: 8px;
  line-height: 1.3;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.stats-card__value-container {
  margin-bottom: 12px;
}

.stats-card__value {
  display: flex;
  align-items: baseline;
  margin-bottom: 4px;
}

.stats-card__primary-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--q-dark);
  line-height: 1;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.stats-card__suffix {
  font-size: 1rem;
  font-weight: 500;
  color: var(--q-grey-7);
  margin-left: 4px;
}

.stats-card__total {
  font-size: 0.8rem;
  color: var(--q-grey-6);
  font-weight: 500;
}

.stats-card__progress {
  margin-bottom: 12px;
}

.stats-card__progress-bar {
  height: 4px;
}

.stats-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.stats-card__subtitle {
  font-size: 0.75rem;
  color: var(--q-grey-6);
  font-weight: 500;
}

.stats-card__updated {
  font-size: 0.7rem;
  color: var(--q-grey-5);
  font-style: italic;
}

// Responsive adjustments
@media (max-width: 599px) {
  .stats-card__content {
    padding: 16px;
  }

  .stats-card__primary-value {
    font-size: 1.5rem;
  }

  .stats-card__header {
    margin-bottom: 8px;
  }

  .stats-card__footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

// Focus styles
.stats-card:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
