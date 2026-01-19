<script setup lang="ts">
/**
 * PathConfigurationStep - Wizard step for configuring mission path
 *
 * Allows users to configure mowing patterns and preview the generated path.
 * Consumer mode shows minimal controls with smart defaults.
 * Power user mode shows full configuration options.
 */

import { ref, computed, watch, onMounted, nextTick, markRaw, type Component } from 'vue'
import Card from '@/components/common/Card.vue'
import MissionPathPreview from '@/components/missions/path/MissionPathPreview.vue'
import PathConfigurationPanel from '@/components/missions/path/PathConfigurationPanel.vue'
import PathStatistics from '@/components/missions/path/PathStatistics.vue'
import { useFeaturesStore } from '@/stores/features'
import { useZonesStore } from '@/stores/zones'
import {
  useMissionPathGeneration,
  DEFAULT_PATH_CONFIG,
  type PathConfiguration,
  type PatternType
} from '@/composables/useMissionPathGeneration'
import {
  getMissionTypeConfig,
  type TemplateCategory,
  type MissionTypeConfig
} from '@/config/missionTypeConfig'
import {
  MowingControls,
  SnowControls,
  SprayingControls,
  PatrolControls,
  CollectionControls,
  WateringControls,
  type TypeSpecificSettings
} from '@/components/missions/path/controls'
import type { Zone, ZoneSummary } from '@client'

interface Props {
  selectedZoneIds: string[]
  availableZones: ZoneSummary[]
  templateDefaults?: {
    mowing_pattern?: PatternType
    edge_mode?: 'trim' | 'skip' | 'overlap'
  }
  /** Template category for type-specific controls and rendering */
  templateCategory?: TemplateCategory
}

const props = defineProps<Props>()

const pathConfig = defineModel<PathConfiguration>('pathConfig', {
  default: () => ({ ...DEFAULT_PATH_CONFIG })
})

const typeSpecificSettings = defineModel<TypeSpecificSettings>('typeSettings', {
  default: () => ({})
})

const featuresStore = useFeaturesStore()
const zonesStore = useZonesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Mission type configuration
const missionTypeConfig = computed((): MissionTypeConfig | undefined => {
  if (props.templateCategory) {
    return getMissionTypeConfig(props.templateCategory)
  }
  return undefined
})

// Map control component names to actual components
const controlComponentMap: Record<string, Component> = {
  mowing: markRaw(MowingControls),
  snow: markRaw(SnowControls),
  spraying: markRaw(SprayingControls),
  patrol: markRaw(PatrolControls),
  collection: markRaw(CollectionControls),
  watering: markRaw(WateringControls)
}

// Get the type-specific control component
const typeSpecificControlComponent = computed((): Component | null => {
  if (!missionTypeConfig.value?.controlComponent) {
    return null
  }
  return controlComponentMap[missionTypeConfig.value.controlComponent] || null
})

// Path generation
const {
  setZones,
  setPathConfig: updateComposablePathConfig,
  pathPreviewData,
  generatedPath,
  isGenerating
} = useMissionPathGeneration()

// Map preview ref for invalidation
const mapPreviewRef = ref<InstanceType<typeof MissionPathPreview> | null>(null)

// ============================================================================
// Computed
// ============================================================================

const title = computed(() =>
  isConsumerMode.value ? 'Preview Your Job' : 'Configure Path'
)

const description = computed(() =>
  isConsumerMode.value
    ? 'Here\'s how we\'ll cover your selected areas'
    : 'Configure the mowing pattern and preview the generated path'
)

const selectedZones = computed((): Zone[] => {
  const zones: Zone[] = []
  for (const id of props.selectedZoneIds) {
    // Try to get full zone data from zones store
    const zone = zonesStore.getZoneById(id)
    if (zone) {
      zones.push(zone)
    } else {
      // Fallback to summary data with placeholder coordinates
      const summary = props.availableZones.find(z => z.id === id)
      if (summary) {
        // Create minimal zone object - coordinates will come from actual zone data
        zones.push({
          id: summary.id,
          name: summary.name,
          type: summary.type,
          area: summary.area,
          coordinates: [],
          color: '#2C5F2D',
          created: '',
          lastModified: ''
        })
      }
    }
  }
  return zones
})

const hasValidZones = computed(() => {
  return selectedZones.value.some(z => z.coordinates && z.coordinates.length >= 3)
})

const selectedZoneNames = computed(() => {
  return selectedZones.value.map(z => z.name).join(', ')
})

// ============================================================================
// Methods
// ============================================================================

function initializeDefaults() {
  // Apply template defaults if provided
  if (props.templateDefaults) {
    const updates: Partial<PathConfiguration> = {}

    if (props.templateDefaults.mowing_pattern) {
      updates.pattern = props.templateDefaults.mowing_pattern
    }

    if (props.templateDefaults.edge_mode) {
      updates.edgeMode = props.templateDefaults.edge_mode
    }

    if (Object.keys(updates).length > 0) {
      pathConfig.value = { ...pathConfig.value, ...updates }
    }
  }
}

function updatePathGeneration() {
  if (hasValidZones.value) {
    setZones(selectedZones.value)
    updateComposablePathConfig(pathConfig.value)
  }
}

// ============================================================================
// Watchers
// ============================================================================

// Update path generation when zones change
watch(selectedZones, () => {
  updatePathGeneration()
}, { deep: true, immediate: true })

// Update path generation when config changes
watch(pathConfig, () => {
  updatePathGeneration()
}, { deep: true })

// Invalidate map size when mounted (handles layout changes)
watch(() => mapPreviewRef.value, (ref) => {
  if (ref) {
    nextTick(() => {
      ref.invalidateSize?.()
    })
  }
})

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  initializeDefaults()
  updatePathGeneration()
})
</script>

<template>
  <div class="path-configuration-step" :class="{ 'consumer-mode': isConsumerMode }">
    <!-- Header -->
    <div class="step-header">
      <h3 class="step-title">{{ title }}</h3>
      <p class="step-description">{{ description }}</p>
    </div>

    <!-- No Valid Zones Warning -->
    <Card v-if="!hasValidZones" class="warning-card">
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <div class="warning-text">
          <strong>Zone data unavailable</strong>
          <p>
            {{ isConsumerMode
              ? 'We couldn\'t load the area details. The job will still work, but we can\'t show a preview.'
              : 'Zone coordinate data is not available. Path preview requires zone boundary data.'
            }}
          </p>
        </div>
      </div>
    </Card>

    <!-- Main Content -->
    <div v-else class="step-content">
      <!-- Consumer Mode: Full width map with stats -->
      <template v-if="isConsumerMode">
        <div class="preview-section">
          <MissionPathPreview
            ref="mapPreviewRef"
            :preview-data="pathPreviewData"
            :mission-type-config="missionTypeConfig"
            height="350px"
            :show-statistics="false"
            :show-layer-toggle="true"
          />
        </div>

        <!-- Type-specific controls for consumer mode -->
        <component
          v-if="typeSpecificControlComponent"
          :is="typeSpecificControlComponent"
          v-model="typeSpecificSettings"
          :disabled="isGenerating"
          class="type-controls consumer-type-controls"
        />

        <PathStatistics
          :statistics="generatedPath"
          :show-details="false"
          class="consumer-stats"
        />

        <div class="zone-summary">
          <span class="zone-label">Areas included:</span>
          <span class="zone-names">{{ selectedZoneNames }}</span>
        </div>
      </template>

      <!-- Power User Mode: Split view -->
      <template v-else>
        <div class="split-layout">
          <!-- Left: Controls -->
          <div class="controls-panel">
            <PathConfigurationPanel
              v-model="pathConfig"
              :disabled="isGenerating"
              :mission-type-config="missionTypeConfig"
            />

            <!-- Type-specific controls -->
            <component
              v-if="typeSpecificControlComponent"
              :is="typeSpecificControlComponent"
              v-model="typeSpecificSettings"
              :disabled="isGenerating"
              class="type-controls"
            />

            <PathStatistics
              :statistics="generatedPath"
              :show-details="true"
              class="stats-panel"
            />
          </div>

          <!-- Right: Map Preview -->
          <div class="preview-panel">
            <MissionPathPreview
              ref="mapPreviewRef"
              :preview-data="pathPreviewData"
              :mission-type-config="missionTypeConfig"
              height="100%"
              :show-statistics="true"
              :show-layer-toggle="true"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isGenerating" class="loading-overlay">
      <span class="loading-text">Generating path...</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.path-configuration-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  position: relative;
}

.step-header {
  text-align: center;
}

.consumer-mode .step-header {
  padding: var(--spacing-md) 0;
}

.step-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-mode .step-title {
  font-size: var(--font-size-xl);
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.warning-card {
  background: rgba(var(--warning-rgb), 0.1);
  border-color: var(--warning);
}

.warning-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.warning-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.warning-text {
  strong {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.preview-section {
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.consumer-stats {
  margin-top: var(--spacing-md);
}

.zone-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.zone-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.zone-names {
  color: var(--text-primary);
}

.split-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--spacing-lg);
  min-height: 400px;
}

@media (max-width: 768px) {
  .split-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .preview-panel {
    height: 300px;
  }
}

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.stats-panel {
  margin-top: auto;
}

.type-controls {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.consumer-type-controls {
  margin-top: var(--spacing-md);
}

.preview-panel {
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 300px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bg-primary-rgb), 0.7);
  border-radius: var(--radius-lg);
}

.loading-text {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
