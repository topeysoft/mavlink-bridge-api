<template>
  <div class="pattern-generator q-pa-md">
    <div class="text-subtitle1 q-mb-md">Pattern Generator</div>

    <q-select
      v-model="selectedPattern"
      :options="patternOptions"
      label="Pattern Type"
      emit-value
      map-options
      class="q-mb-md"
    />

    <!-- Survey Pattern Settings -->
    <div v-if="selectedPattern === 'survey'" class="pattern-settings">
      <q-input
        v-model.number="surveySettings.spacing"
        label="Line Spacing (m)"
        type="number"
        min="1"
        class="q-mb-md"
      />
      <q-input
        v-model.number="surveySettings.altitude"
        label="Altitude (m)"
        type="number"
        min="1"
        class="q-mb-md"
      />
      <q-input
        v-model.number="surveySettings.angle"
        label="Pattern Angle (degrees)"
        type="number"
        min="0"
        max="360"
        class="q-mb-md"
      />
      <q-toggle
        v-model="surveySettings.alternating"
        label="Alternating direction"
        class="q-mb-md"
      />
    </div>

    <!-- Mowing Pattern Settings -->
    <div v-if="selectedPattern === 'mowing'" class="pattern-settings">
      <q-input
        v-model.number="mowingSettings.spacing"
        label="Cut Width (m)"
        type="number"
        min="0.5"
        step="0.1"
        class="q-mb-md"
      />
      <q-input
        v-model.number="mowingSettings.overlap"
        label="Overlap (%)"
        type="number"
        min="0"
        max="50"
        class="q-mb-md"
      />
      <q-input
        v-model.number="mowingSettings.height"
        label="Cutting Height (m)"
        type="number"
        min="0.1"
        step="0.1"
        class="q-mb-md"
      />
      <q-select
        v-model="mowingSettings.direction"
        :options="directionOptions"
        label="Mowing Direction"
        emit-value
        map-options
        class="q-mb-md"
      />
    </div>

    <!-- Search Pattern Settings -->
    <div v-if="selectedPattern === 'search'" class="pattern-settings">
      <q-select
        v-model="searchSettings.type"
        :options="searchTypeOptions"
        label="Search Type"
        emit-value
        map-options
        class="q-mb-md"
      />
      <q-input
        v-model.number="searchSettings.radius"
        label="Search Radius (m)"
        type="number"
        min="10"
        class="q-mb-md"
      />
      <q-input
        v-model.number="searchSettings.altitude"
        label="Search Altitude (m)"
        type="number"
        min="5"
        class="q-mb-md"
      />
      <q-input
        v-if="searchSettings.type === 'spiral'"
        v-model.number="searchSettings.spacing"
        label="Spiral Spacing (m)"
        type="number"
        min="5"
        class="q-mb-md"
      />
    </div>

    <!-- Area Selection -->
    <div class="q-mb-md">
      <div class="text-caption text-grey-7 q-mb-sm">
        Select area on map or enter coordinates:
      </div>
      <q-input
        v-model.number="areaSettings.center.lat"
        label="Center Latitude"
        type="number"
        step="any"
        class="q-mb-sm"
      />
      <q-input
        v-model.number="areaSettings.center.lng"
        label="Center Longitude"
        type="number"
        step="any"
        class="q-mb-sm"
      />
      <div class="row q-col-gutter-sm">
        <div class="col">
          <q-input
            v-model.number="areaSettings.width"
            label="Width (m)"
            type="number"
            min="10"
          />
        </div>
        <div class="col">
          <q-input
            v-model.number="areaSettings.height"
            label="Height (m)"
            type="number"
            min="10"
          />
        </div>
      </div>
    </div>

    <!-- Pattern Preview -->
    <div class="pattern-preview q-mb-md">
      <div class="text-caption text-grey-7 q-mb-sm">Preview:</div>
      <div class="preview-stats">
        <div>Estimated waypoints: {{ estimatedWaypoints }}</div>
        <div>Estimated distance: {{ estimatedDistance.toFixed(0) }}m</div>
        <div>Estimated time: {{ formatTime(estimatedTime) }}</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="row q-gutter-sm">
      <q-btn
        label="Preview on Map"
        color="secondary"
        @click="previewPattern"
        class="col"
      />
      <q-btn
        label="Generate"
        color="primary"
        @click="generatePattern"
        class="col"
      />
    </div>

    <!-- Common Patterns -->
    <q-separator class="q-my-md" />
    
    <div class="text-subtitle2 q-mb-sm">Quick Patterns</div>
    <div class="row q-col-gutter-sm">
      <div class="col-6">
        <q-btn
          label="Small Lawn"
          color="positive"
          size="sm"
          class="full-width"
          @click="loadPreset('small-lawn')"
        />
      </div>
      <div class="col-6">
        <q-btn
          label="Large Field"
          color="positive"
          size="sm"
          class="full-width"
          @click="loadPreset('large-field')"
        />
      </div>
      <div class="col-6">
        <q-btn
          label="Perimeter"
          color="info"
          size="sm"
          class="full-width"
          @click="loadPreset('perimeter')"
        />
      </div>
      <div class="col-6">
        <q-btn
          label="Grid Survey"
          color="info"
          size="sm"
          class="full-width"
          @click="loadPreset('grid-survey')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

import type { PatternDefinition, SurveySettings, MowingSettings, SearchSettings } from '../../stores/mission'

const emit = defineEmits<{
  generate: [pattern: PatternDefinition]
}>()

const selectedPattern = ref('mowing')

const patternOptions = [
  { label: 'Lawn Mowing', value: 'mowing' },
  { label: 'Area Survey', value: 'survey' },
  { label: 'Search Pattern', value: 'search' }
]

const directionOptions = [
  { label: 'North-South', value: 'ns' },
  { label: 'East-West', value: 'ew' },
  { label: 'Diagonal NE-SW', value: 'ne-sw' },
  { label: 'Diagonal NW-SE', value: 'nw-se' }
]

const searchTypeOptions = [
  { label: 'Spiral', value: 'spiral' },
  { label: 'Expanding Square', value: 'square' },
  { label: 'Sector Scan', value: 'sector' }
]

const surveySettings = ref({
  spacing: 10,
  altitude: 15,
  angle: 0,
  alternating: true
})

const mowingSettings = ref({
  spacing: 2,
  overlap: 10,
  height: 0.5,
  direction: 'ns'
})

const searchSettings = ref({
  type: 'spiral',
  radius: 50,
  altitude: 20,
  spacing: 10
})

const areaSettings = ref({
  center: { lat: 40.7128, lng: -74.0060 },
  width: 50,
  height: 50
})

const estimatedWaypoints = computed(() => {
  switch (selectedPattern.value) {
    case 'mowing':
      return Math.ceil(areaSettings.value.height / mowingSettings.value.spacing) * 2
    case 'survey':
      return Math.ceil(areaSettings.value.width / surveySettings.value.spacing) * 2
    case 'search':
      return searchSettings.value.type === 'spiral' ? 20 : 16
    default:
      return 0
  }
})

const estimatedDistance = computed(() => {
  const area = areaSettings.value.width * areaSettings.value.height
  
  switch (selectedPattern.value) {
    case 'mowing':
      return area / mowingSettings.value.spacing * 1.2 // 20% overlap/turns
    case 'survey':
      return area / surveySettings.value.spacing * 1.1 // 10% overlap
    case 'search':
      return Math.PI * searchSettings.value.radius * 2
    default:
      return 0
  }
})

const estimatedTime = computed(() => {
  const avgSpeed = 3 // m/s
  return estimatedDistance.value / avgSpeed
})

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function previewPattern() {
  // Emit preview event to show pattern outline on map
}

function generatePattern() {
  const settings = getPatternSettings()
  const pattern: PatternDefinition = {
    type: selectedPattern.value,
    area: areaSettings.value,
    settings: settings as SurveySettings | MowingSettings | SearchSettings
  }
  
  emit('generate', pattern)
}

function getPatternSettings() {
  switch (selectedPattern.value) {
    case 'mowing':
      return mowingSettings.value
    case 'survey':
      return surveySettings.value
    case 'search':
      return searchSettings.value
    default:
      return {}
  }
}

function loadPreset(preset: string) {
  switch (preset) {
    case 'small-lawn':
      selectedPattern.value = 'mowing'
      areaSettings.value = { center: { lat: 40.7128, lng: -74.0060 }, width: 20, height: 30 }
      mowingSettings.value.spacing = 1.5
      break
    case 'large-field':
      selectedPattern.value = 'mowing'
      areaSettings.value = { center: { lat: 40.7128, lng: -74.0060 }, width: 100, height: 150 }
      mowingSettings.value.spacing = 3
      break
    case 'perimeter':
      selectedPattern.value = 'survey'
      surveySettings.value.spacing = 2
      surveySettings.value.altitude = 5
      break
    case 'grid-survey':
      selectedPattern.value = 'survey'
      surveySettings.value.spacing = 20
      surveySettings.value.altitude = 30
      break
  }
  
  generatePattern()
}
</script>

<style lang="scss" scoped>
.pattern-generator {
  max-height: 100%;
  overflow-y: auto;
}

.pattern-settings {
  background: var(--q-color-grey-1);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  
  .body--dark & {
    background: var(--q-color-grey-9);
  }
}

.pattern-preview {
  background: var(--q-color-blue-1);
  padding: 12px;
  border-radius: 4px;
  
  .body--dark & {
    background: var(--q-color-blue-10);
  }
}

.preview-stats {
  font-size: 12px;
  
  div {
    margin-bottom: 4px;
  }
}
</style>