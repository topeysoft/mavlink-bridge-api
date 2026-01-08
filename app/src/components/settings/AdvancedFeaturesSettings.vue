<script setup lang="ts">
import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import { useDialog } from '@/composables/useDialog'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const featuresStore = useFeaturesStore()
const dialog = useDialog()

interface FeatureGroup {
  title: string
  features: Array<{
    key: keyof typeof featuresStore.features.value
    label: string
    description: string
  }>
}

const featureGroups: FeatureGroup[] = [
  {
    title: 'Mission & Planning',
    features: [
      {
        key: 'missionTemplates',
        label: 'Mission Templates',
        description: 'Pre-built mission templates for common tasks',
      },
      {
        key: 'missionScheduling',
        label: 'Mission Scheduling',
        description: 'Schedule missions to run at specific times',
      },
    ],
  },
  {
    title: 'Vehicle Control',
    features: [
      {
        key: 'vehicleControl',
        label: 'Vehicle Control',
        description: 'Direct vehicle control interface with arm/disarm',
      },
      {
        key: 'flightModes',
        label: 'Flight Modes',
        description: 'Manual flight mode switching and configuration',
      },
      {
        key: 'mavlinkStream',
        label: 'MAVLink Stream',
        description: 'Live MAVLink message stream viewer',
      },
      {
        key: 'parameterEditor',
        label: 'Parameter Editor',
        description: 'Edit vehicle parameters and configuration',
      },
    ],
  },
  {
    title: 'Monitoring & Diagnostics',
    features: [
      {
        key: 'systemMonitoring',
        label: 'System Monitoring',
        description: 'System health and diagnostic information',
      },
      {
        key: 'telemetryCharts',
        label: 'Telemetry Charts',
        description: 'Advanced telemetry visualization and charts',
      },
      {
        key: 'logDownload',
        label: 'Log Download',
        description: 'Download and analyze vehicle logs',
      },
    ],
  },
  {
    title: 'Advanced Features',
    features: [
      {
        key: 'geofencing',
        label: 'Geofencing',
        description: 'Set up virtual boundaries and safety zones',
      },
      {
        key: 'rallyPoints',
        label: 'Rally Points',
        description: 'Configure alternate landing locations',
      },
      {
        key: 'batteryManagement',
        label: 'Battery Management',
        description: 'Advanced battery monitoring, health tracking, and auto-return',
      },
      {
        key: 'weatherIntegration',
        label: 'Weather Integration',
        description: 'Weather monitoring and automatic task postponement',
      },
      {
        key: 'rtcmClient',
        label: 'GPS Boost (RTK/RTCM)',
        description: 'RTK positioning for centimeter-level GPS accuracy',
      },
      {
        key: 'customCommands',
        label: 'Custom Commands',
        description: 'Send custom MAVLink commands to vehicle',
      },
      {
        key: 'scriptExecution',
        label: 'Script Execution',
        description: 'Run custom automation scripts',
      },
    ],
  },
  {
    title: 'Developer Tools',
    features: [
      {
        key: 'apiConsole',
        label: 'API Console',
        description: 'Direct API/MAVLink console for debugging',
      },
      {
        key: 'debugMode',
        label: 'Debug Mode',
        description: 'Show debug information and detailed logs',
      },
      {
        key: 'experimentalFeatures',
        label: 'Experimental Features',
        description: 'Enable beta and experimental functionality',
      },
    ],
  },
]

const isCustomMode = computed(() => featuresStore.useCustomFlags)

function handleToggle(feature: keyof typeof featuresStore.features.value) {
  if (!isCustomMode.value) {
    featuresStore.enableCustomFlags()
  }
  featuresStore.toggleFeature(feature)
}

async function handleResetToPreset() {
  const confirmed = await dialog.confirm(
    'Reset to preset for current user mode?\n\nAll custom feature toggles will be lost.'
  )
  if (confirmed) {
    featuresStore.resetToPreset()
  }
}

function handleExportConfig() {
  const config = featuresStore.exportConfiguration()
  const blob = new Blob([config], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yardrover-config-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleImportConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const content = e.target?.result as string
        const success = featuresStore.importConfiguration(content)
        if (success) {
          await dialog.alert('Configuration imported successfully', 'Success', { variant: 'success' })
        } else {
          await dialog.alert('Failed to import configuration. Please check the file format.', 'Import Failed', { variant: 'error' })
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}
</script>

<template>
  <Card>
    <template #header>
      <div class="section-header">
        <div>
          <div class="card-title">Advanced Features</div>
          <div class="card-subtitle">
            {{ isCustomMode ? 'Custom configuration' : 'Using preset for ' + featuresStore.userMode }}
          </div>
        </div>
        <div class="header-actions">
          <Button variant="outline" size="sm" @click="handleImportConfig">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import
          </Button>
          <Button variant="outline" size="sm" @click="handleExportConfig">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </Button>
          <Button v-if="isCustomMode" variant="outline" size="sm" @click="handleResetToPreset">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
              <path d="M21 3v5h-5"></path>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
              <path d="M3 21v-5h5"></path>
            </svg>
            Reset
          </Button>
        </div>
      </div>
    </template>

    <div class="features-container">
      <div v-for="group in featureGroups" :key="group.title" class="feature-group">
        <h3 class="group-title">{{ group.title }}</h3>
        <div class="features-list">
          <div v-for="feature in group.features" :key="feature.key" class="feature-item">
            <div class="feature-info">
              <div class="feature-label">{{ feature.label }}</div>
              <div class="feature-description">{{ feature.description }}</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="featuresStore.isFeatureEnabled(feature.key)"
                @change="handleToggle(feature.key)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="features-info">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <p>
        Enabling custom features will override the preset for your user mode. Changes are saved automatically.
      </p>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  svg {
    width: 14px;
    height: 14px;
  }
}

.features-container {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.feature-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.group-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.feature-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  gap: var(--spacing-md);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.feature-description {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: 1.4;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background: var(--primary-green);

      &::before {
        transform: translateX(20px);
      }
    }

    &:focus-visible + .toggle-slider {
      box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.2);
    }
  }
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border-color);
  border-radius: var(--radius-full);
  transition: all 0.2s;

  &::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
}

.features-info {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(59, 130, 246, 0.05);
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #3b82f6;
    margin-top: 2px;
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
  }
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;

    button {
      flex: 1;
    }
  }
}
</style>
