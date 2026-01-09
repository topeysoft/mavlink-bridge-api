<script setup lang="ts">
import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import { useDialog } from '@/composables/useDialog'
import Card from '@/components/common/Card.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import InfoBanner from '@/components/common/InfoBanner.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
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
  <SettingsSection
    title="Advanced Features"
    :description="isCustomMode ? 'Custom configuration' : 'Using preset for ' + featuresStore.userMode"
  >
    <template #actions>
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
    </template>

  <Card :no-padding="true">

    <div class="features-container">
      <div v-for="group in featureGroups" :key="group.title" class="feature-group">
        <h3 class="group-title">{{ group.title }}</h3>
        <div class="features-list">
          <div v-for="feature in group.features" :key="feature.key" class="feature-item">
            <div class="feature-info">
              <div class="feature-label">{{ feature.label }}</div>
              <div class="feature-description">{{ feature.description }}</div>
            </div>
            <ToggleSwitch
              :model-value="featuresStore.isFeatureEnabled(feature.key)"
              @update:model-value="handleToggle(feature.key)"
            />
          </div>
        </div>
      </div>
    </div>

    <InfoBanner variant="info">
      <p>
        Enabling custom features will override the preset for your user mode. Changes are saved automatically.
      </p>
    </InfoBanner>
  </Card>
  </SettingsSection>
</template>

<style scoped lang="scss">
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

</style>
