<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import HelpTooltip from '@/components/consumer/HelpTooltip.vue'
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

function saveSetting(settingName: string, value: any) {
  console.log(`Saving ${settingName}:`, value)
  // In real app, this would persist to backend/store
  success('Settings saved')
}
</script>

<template>
  <div class="consumer-settings">
    <h2 class="settings-title">Simple Settings</h2>
    <p class="settings-description">
      Adjust how your YardRover behaves. Need more options?
      <router-link to="/settings" class="settings-link">View all settings</router-link>
    </p>

    <div class="settings-grid">
      <!-- Notifications -->
      <Card>
        <div class="setting-item">
          <div class="setting-header">
            <div class="setting-info">
              <div class="setting-label">
                Job Notifications
                <HelpTooltip content="Get notified when jobs start, finish, or need attention" />
              </div>
              <div class="setting-desc">Alerts when jobs complete or have issues</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.notifications"
                @change="saveSetting('notifications', settings.notifications)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </Card>

      <!-- Auto Start -->
      <Card>
        <div class="setting-item">
          <div class="setting-header">
            <div class="setting-info">
              <div class="setting-label">
                Auto-Start Scheduled Jobs
                <HelpTooltip content="Automatically begin jobs at their scheduled time without confirmation" />
              </div>
              <div class="setting-desc">Start scheduled jobs without asking</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.autoStart"
                @change="saveSetting('autoStart', settings.autoStart)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </Card>

      <!-- Return Home -->
      <Card>
        <div class="setting-item">
          <div class="setting-header">
            <div class="setting-info">
              <div class="setting-label">
                Return Home After Jobs
                <HelpTooltip content="YardRover will return to its charging station when jobs finish" />
              </div>
              <div class="setting-desc">Go back to charging station when done</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.returnHome"
                @change="saveSetting('returnHome', settings.returnHome)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </Card>

      <!-- Low Battery Action -->
      <Card>
        <div class="setting-item">
          <div class="setting-header">
            <div class="setting-info">
              <div class="setting-label">
                Low Battery Action
                <HelpTooltip content="What should happen when battery gets below 20%" />
              </div>
              <div class="setting-desc">What to do when battery is low</div>
            </div>
          </div>
          <div class="radio-options">
            <label class="radio-option">
              <input
                type="radio"
                value="return-home"
                v-model="settings.lowBatteryAction"
                @change="saveSetting('lowBatteryAction', settings.lowBatteryAction)"
              />
              <div class="radio-content">
                <span class="radio-emoji">🏠</span>
                <div class="radio-text">
                  <div class="radio-label">Return Home</div>
                  <div class="radio-desc">Go back and charge automatically</div>
                </div>
              </div>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                value="stop"
                v-model="settings.lowBatteryAction"
                @change="saveSetting('lowBatteryAction', settings.lowBatteryAction)"
              />
              <div class="radio-content">
                <span class="radio-emoji">⏸️</span>
                <div class="radio-text">
                  <div class="radio-label">Stop in Place</div>
                  <div class="radio-desc">Pause and wait for help</div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </Card>

      <!-- Safety Pause -->
      <Card>
        <div class="setting-item">
          <div class="setting-header">
            <div class="setting-info">
              <div class="setting-label">
                Safety Pause
                <HelpTooltip content="Pause immediately if YardRover detects an obstacle or person nearby" />
              </div>
              <div class="setting-desc">Pause when obstacles detected</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.safetyPause"
                @change="saveSetting('safetyPause', settings.safetyPause)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.consumer-settings {
  padding: var(--spacing-xl);
  max-width: 1000px;
  margin: 0 auto;
}

.settings-title {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.settings-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-2xl);
}

.settings-link {
  color: var(--primary-green);
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.setting-item {
  padding: var(--spacing-md);
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}

.setting-info {
  flex: 1;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.setting-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  flex-shrink: 0;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background: var(--primary-green);

      &::before {
        transform: translateX(24px);
      }
    }

    &:focus + .toggle-slider {
      box-shadow: 0 0 0 2px var(--primary-green);
    }
  }
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border-color);
  border-radius: 24px;
  transition: all 0.3s;

  &::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
  }
}

.radio-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.radio-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;

  &:has(input:checked) {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.05);
  }

  &:hover {
    border-color: var(--primary-green);
  }

  input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}

.radio-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.radio-emoji {
  font-size: 28px;
  line-height: 1;
}

.radio-text {
  flex: 1;
}

.radio-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.radio-desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
