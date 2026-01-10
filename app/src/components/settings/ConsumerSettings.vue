<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import RadioGroup from '@/components/common/RadioGroup.vue'
import SettingItem from '@/components/settings/SettingItem.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import ThemeSettings from '@/components/settings/ThemeSettings.vue'
import UnitsSettings from '@/components/settings/UnitsSettings.vue'
import { useNotifications } from '@/composables/useNotifications'

const { success } = useNotifications()

// Simplified settings for consumer mode
const settings = ref({
  notifications: true,
  autoStart: false,
  returnHome: true,
  lowBatteryAction: 'return-home' as 'return-home' | 'stop',
  safetyPause: true
})

const lowBatteryOptions = [
  {
    value: 'return-home',
    label: 'Return Home',
    description: 'Go back and charge automatically',
    icon: '🏠'
  },
  {
    value: 'stop',
    label: 'Stop in Place',
    description: 'Pause and wait for help',
    icon: '⏸️'
  }
]

function saveSetting(settingName: string, value: any) {
  console.log(`Saving ${settingName}:`, value)
  // In real app, this would persist to backend/store
  success('Settings saved')
}
</script>

<template>
  <div class="consumer-settings">
    <!-- Appearance Section -->
    <SettingsSection
      title="Appearance"
      description="Customize how your YardRover app looks"
    >
      <div class="settings-grid">
        <ThemeSettings />
      </div>
    </SettingsSection>

    <!-- Measurements Section -->
    <SettingsSection
      title="Measurements"
      description="Choose your preferred units for distance and area"
    >
      <div class="settings-grid">
        <UnitsSettings />
      </div>
    </SettingsSection>

    <!-- Behavior & Notifications Section -->
    <SettingsSection
      title="Behavior & Notifications"
      description="Control how your YardRover acts and when it alerts you"
    >
      <div class="settings-grid">
        <!-- Notifications -->
        <Card>
          <SettingItem
            icon="🔔"
            label="Job Notifications"
            description="Alerts when jobs complete or have issues"
            help-text="Get notified when jobs start, finish, or need attention"
          >
            <ToggleSwitch
              v-model="settings.notifications"
              size="lg"
              @update:model-value="saveSetting('notifications', $event)"
            />
          </SettingItem>
        </Card>

        <!-- Auto Start -->
        <Card>
          <SettingItem
            icon="⏰"
            label="Auto-Start Scheduled Jobs"
            description="Start scheduled jobs without asking"
            help-text="Automatically begin jobs at their scheduled time without confirmation"
          >
            <ToggleSwitch
              v-model="settings.autoStart"
              size="lg"
              @update:model-value="saveSetting('autoStart', $event)"
            />
          </SettingItem>
        </Card>

        <!-- Return Home -->
        <Card>
          <SettingItem
            icon="🏠"
            label="Return Home After Jobs"
            description="Go back to charging station when done"
            help-text="YardRover will return to its charging station when jobs finish"
          >
            <ToggleSwitch
              v-model="settings.returnHome"
              size="lg"
              @update:model-value="saveSetting('returnHome', $event)"
            />
          </SettingItem>
        </Card>

        <!-- Low Battery Action -->
        <Card>
          <SettingItem
            icon="🔋"
            label="Low Battery Action"
            description="What to do when battery is low"
            help-text="What should happen when battery gets below 20%"
          >
            <template #content>
              <RadioGroup
                v-model="settings.lowBatteryAction"
                :options="lowBatteryOptions"
                name="lowBatteryAction"
                @update:model-value="saveSetting('lowBatteryAction', $event)"
              />
            </template>
          </SettingItem>
        </Card>

        <!-- Safety Pause -->
        <Card>
          <SettingItem
            icon="⚠️"
            label="Safety Pause"
            description="Pause when obstacles detected"
            help-text="Pause immediately if YardRover detects an obstacle or person nearby"
          >
            <ToggleSwitch
              v-model="settings.safetyPause"
              size="lg"
              @update:model-value="saveSetting('safetyPause', $event)"
            />
          </SettingItem>
        </Card>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped lang="scss">
.consumer-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--spacing-lg);
  max-width: 1400px;
}
</style>
