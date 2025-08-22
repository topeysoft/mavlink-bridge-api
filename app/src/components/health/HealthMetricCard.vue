<template>
  <q-card class="health-metric-card">
    <q-card-section>
      <div class="row items-center no-wrap">
        <div class="col">
          <div class="text-caption text-grey-7">{{ label }}</div>
          <div class="text-h5 text-weight-bold">
            {{ formattedValue }}
            <span class="text-caption">{{ unit }}</span>
          </div>
          <div v-if="trend" class="row items-center q-mt-xs">
            <q-icon
              :name="trendIcon"
              :color="trendColor"
              size="16px"
            />
            <span :class="`text-${trendColor} text-caption q-ml-xs`">
              {{ Math.abs(trend) }}% {{ trend > 0 ? 'increase' : 'decrease' }}
            </span>
          </div>
        </div>
        <div class="col-auto">
          <q-circular-progress
            v-if="showProgress"
            :value="progressValue"
            :max="max"
            :thickness="0.2"
            :color="progressColor"
            size="60px"
            track-color="grey-3"
            show-value
          >
            <div class="text-caption">{{ Math.round(progressValue) }}%</div>
          </q-circular-progress>
          <q-icon
            v-else
            :name="icon"
            :color="statusColor"
            size="40px"
          />
        </div>
      </div>
    </q-card-section>
    
    <q-linear-progress
      v-if="showThreshold && threshold"
      :value="value / threshold"
      :color="value > threshold ? 'negative' : 'positive'"
      size="4px"
    />
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: number
  unit?: string
  icon?: string
  max?: number
  threshold?: number
  trend?: number
  format?: (value: number) => string
  showProgress?: boolean
  showThreshold?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  icon: 'mdi-information',
  max: 100,
  showProgress: false,
  showThreshold: false
})

const formattedValue = computed(() => {
  if (props.format) {
    return props.format(props.value)
  }
  return props.value.toFixed(props.value < 10 ? 1 : 0)
})

const progressValue = computed(() => {
  return (props.value / props.max) * 100
})

const progressColor = computed(() => {
  const percent = progressValue.value
  if (percent > 80) return 'negative'
  if (percent > 60) return 'warning'
  return 'positive'
})

const statusColor = computed(() => {
  if (props.threshold && props.value > props.threshold) return 'negative'
  if (props.threshold && props.value > props.threshold * 0.8) return 'warning'
  return 'positive'
})

const trendIcon = computed(() => {
  if (!props.trend) return ''
  return props.trend > 0 ? 'mdi-trending-up' : 'mdi-trending-down'
})

const trendColor = computed(() => {
  if (!props.trend) return 'grey'
  // For some metrics, increase is bad (CPU, memory)
  const increaseIsBad = ['CPU', 'Memory', 'Temperature'].some(m => 
    props.label.includes(m)
  )
  if (increaseIsBad) {
    return props.trend > 0 ? 'negative' : 'positive'
  }
  return props.trend > 0 ? 'positive' : 'negative'
})
</script>

<style lang="scss" scoped>
.health-metric-card {
  height: 100%;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
}
</style>