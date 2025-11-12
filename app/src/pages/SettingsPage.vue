<template>
  <q-page class="settings-page q-pa-md">
    <div class="page-container">
      <h1 class="text-h4 text-primary q-mb-md">
        <q-icon name="settings" class="q-mr-sm" />
        Settings
      </h1>
      <p class="text-body1 text-secondary q-mb-lg">
        Configure your YardRover application and device preferences
      </p>

      <!-- User Profile -->
      <q-card class="nature-card q-mb-md">
        <q-card-section>
          <div class="text-h6 text-primary q-mb-md">
            <q-icon name="person" class="q-mr-sm" />
            User Profile
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="userSettings.username"
                label="Username"
                outlined
                readonly
              />
            </div>
            <div class="col-12 col-md-6">
              <q-input
                v-model="userSettings.email"
                label="Email"
                type="email"
                outlined
              />
            </div>
          </div>
          <div class="q-mt-md">
            <q-btn
              color="primary"
              label="Update Profile"
              @click="updateProfile"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Application Settings -->
      <q-card class="nature-card q-mb-md">
        <q-card-section>
          <div class="text-h6 text-primary q-mb-md">
            <q-icon name="settings_applications" class="q-mr-sm" />
            Application Settings
          </div>
          
          <div class="settings-group">
            <div class="setting-item">
              <q-toggle
                v-model="appSettings.darkMode"
                label="Dark Mode"
                color="primary"
              />
              <div class="text-caption text-grey">Switch to dark theme</div>
            </div>

            <div class="setting-item">
              <q-toggle
                v-model="appSettings.notifications"
                label="Notifications"
                color="primary"
              />
              <div class="text-caption text-grey">Receive task and system notifications</div>
            </div>

            <div class="setting-item">
              <q-toggle
                v-model="appSettings.autoRefresh"
                label="Auto Refresh Data"
                color="primary"
              />
              <div class="text-caption text-grey">Automatically refresh telemetry data</div>
            </div>

            <div class="setting-item">
              <div class="text-subtitle2 q-mb-sm">Refresh Interval</div>
              <q-slider
                v-model="appSettings.refreshInterval"
                :min="1"
                :max="30"
                :step="1"
                label
                label-always
                :suffix=" + ' seconds'"
                color="primary"
                :disable="!appSettings.autoRefresh"
              />
            </div>

            <div class="setting-item">
              <div class="text-subtitle2 q-mb-sm">Language</div>
              <q-select
                v-model="appSettings.language"
                :options="languageOptions"
                outlined
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Device Settings -->
      <q-card class="nature-card q-mb-md">
        <q-card-section>
          <div class="text-h6 text-primary q-mb-md">
            <q-icon name="precision_manufacturing" class="q-mr-sm" />
            Device Settings
          </div>
          
          <div class="settings-group">
            <div class="setting-item">
              <div class="text-subtitle2 q-mb-sm">Connection Timeout</div>
              <q-slider
                v-model="deviceSettings.connectionTimeout"
                :min="5"
                :max="60"
                :step="5"
                label
                label-always
                suffix=" seconds"
                color="primary"
              />
            </div>

            <div class="setting-item">
              <q-toggle
                v-model="deviceSettings.autoConnect"
                label="Auto-connect to last device"
                color="primary"
              />
              <div class="text-caption text-grey">Automatically connect on app startup</div>
            </div>

            <div class="setting-item">
              <q-toggle
                v-model="deviceSettings.gpsRequired"
                label="Require GPS Fix"
                color="primary"
              />
              <div class="text-caption text-grey">Require GPS fix before starting tasks</div>
            </div>

            <div class="setting-item">
              <div class="text-subtitle2 q-mb-sm">Emergency Stop Behavior</div>
              <q-select
                v-model="deviceSettings.emergencyBehavior"
                :options="emergencyOptions"
                outlined
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Data & Privacy -->
      <q-card class="nature-card q-mb-md">
        <q-card-section>
          <div class="text-h6 text-primary q-mb-md">
            <q-icon name="security" class="q-mr-sm" />
            Data & Privacy
          </div>
          
          <div class="settings-group">
            <div class="setting-item">
              <q-toggle
                v-model="privacySettings.telemetryCollection"
                label="Telemetry Collection"
                color="primary"
              />
              <div class="text-caption text-grey">Allow collection of anonymous usage data</div>
            </div>

            <div class="setting-item">
              <q-toggle
                v-model="privacySettings.locationHistory"
                label="Location History"
                color="primary"
              />
              <div class="text-caption text-grey">Store location history for analysis</div>
            </div>

            <div class="setting-item">
              <div class="text-subtitle2 q-mb-sm">Data Retention</div>
              <q-select
                v-model="privacySettings.dataRetention"
                :options="retentionOptions"
                outlined
                emit-value
                map-options
              />
            </div>

            <div class="setting-item q-mt-md">
              <q-btn
                color="warning"
                outline
                label="Clear All Data"
                @click="clearAllData"
              />
              <div class="text-caption text-grey">Remove all stored application data</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- About -->
      <q-card class="nature-card">
        <q-card-section>
          <div class="text-h6 text-primary q-mb-md">
            <q-icon name="info" class="q-mr-sm" />
            About
          </div>
          
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Application Version</q-item-label>
                <q-item-label caption>v1.0.0</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Build Date</q-item-label>
                <q-item-label caption>{{ buildDate }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Device Firmware</q-item-label>
                <q-item-label caption>{{ firmwareVersion || 'Not connected' }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="q-mt-md">
            <q-btn
              flat
              color="primary"
              label="Check for Updates"
              @click="checkUpdates"
            />
            <q-btn
              flat
              color="primary"
              label="Documentation"
              @click="openDocs"
              class="q-ml-sm"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Save Changes Dialog -->
    <q-dialog v-model="showSaveDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Save Changes?</div>
        </q-card-section>
        
        <q-card-section>
          You have unsaved changes. Would you like to save them?
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Discard" @click="discardChanges" />
          <q-btn flat label="Save" color="primary" @click="saveSettings" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useConnectionStore } from '@/stores/connection';
import { Notify } from 'quasar';

const userStore = useUserStore();
const connectionStore = useConnectionStore();

// State
const showSaveDialog = ref(false);
const hasUnsavedChanges = ref(false);

const userSettings = ref({
  username: userStore.userName,
  email: userStore.user?.email || ''
});

const appSettings = ref({
  darkMode: false,
  notifications: true,
  autoRefresh: true,
  refreshInterval: 5,
  language: 'en'
});

const deviceSettings = ref({
  connectionTimeout: 30,
  autoConnect: true,
  gpsRequired: false,
  emergencyBehavior: 'stop'
});

const privacySettings = ref({
  telemetryCollection: true,
  locationHistory: true,
  dataRetention: '30days'
});

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' }
];

const emergencyOptions = [
  { label: 'Stop Immediately', value: 'stop' },
  { label: 'Return to Home', value: 'home' },
  { label: 'Land in Place', value: 'land' }
];

const retentionOptions = [
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: '90 Days', value: '90days' },
  { label: '1 Year', value: '1year' },
  { label: 'Forever', value: 'forever' }
];

const buildDate = new Date().toLocaleDateString();
const firmwareVersion = ref('1.2.3');

// Watch for changes
watch([userSettings, appSettings, deviceSettings, privacySettings], () => {
  hasUnsavedChanges.value = true;
}, { deep: true });

// Methods
function updateProfile() {
  console.log('Updating profile:', userSettings.value);
  Notify.create({
    type: 'positive',
    message: 'Profile updated successfully',
    position: 'top'
  });
}

function saveSettings() {
  // Save to localStorage or send to API
  localStorage.setItem('yardrover-settings', JSON.stringify({
    app: appSettings.value,
    device: deviceSettings.value,
    privacy: privacySettings.value
  }));
  
  hasUnsavedChanges.value = false;
  showSaveDialog.value = false;
  
  Notify.create({
    type: 'positive',
    message: 'Settings saved successfully',
    position: 'top'
  });
}

function discardChanges() {
  // Reload settings from localStorage
  loadSettings();
  hasUnsavedChanges.value = false;
  showSaveDialog.value = false;
}

function loadSettings() {
  const saved = localStorage.getItem('yardrover-settings');
  if (saved) {
    const settings = JSON.parse(saved);
    appSettings.value = { ...appSettings.value, ...settings.app };
    deviceSettings.value = { ...deviceSettings.value, ...settings.device };
    privacySettings.value = { ...privacySettings.value, ...settings.privacy };
  }
}

function clearAllData() {
  if (confirm('Are you sure you want to clear all application data? This cannot be undone.')) {
    localStorage.clear();
    Notify.create({
      type: 'warning',
      message: 'All data cleared',
      position: 'top'
    });
  }
}

function checkUpdates() {
  Notify.create({
    type: 'info',
    message: 'You are running the latest version',
    position: 'top'
  });
}

function openDocs() {
  window.open('https://docs.yardrover.com', '_blank');
}

// Load settings on mount
loadSettings();
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.settings-page {
  min-height: calc(100vh - 100px);
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.setting-item {
  padding: $spacing-sm 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  &:last-child {
    border-bottom: none;
  }
}
</style>