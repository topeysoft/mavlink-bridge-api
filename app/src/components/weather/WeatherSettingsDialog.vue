<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click="close">
        <div class="modal-dialog" @click.stop>
          <div class="modal-header">
            <h3>Weather Settings</h3>
            <button class="close-button" @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <form @submit.prevent="saveSettings">
              <!-- Enable/Disable -->
              <div class="form-group">
                <label class="toggle-label">
                  <input type="checkbox" v-model="localSettings.enabled" class="toggle-input" />
                  <span class="toggle-slider"></span>
                  <span class="toggle-text">Enable Weather Integration</span>
                </label>
                <div class="form-hint">Automatically check weather before running tasks</div>
              </div>

              <!-- API Key -->
              <div class="form-group">
                <label>OpenWeatherMap API Key</label>
                <div class="input-group">
                  <input
                    v-model="localSettings.apiKey"
                    :type="showApiKey ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Enter your API key"
                  />
                  <button type="button" class="input-button" @click="showApiKey = !showApiKey">
                    <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <div class="form-hint">
                  <a href="https://openweathermap.org/api" target="_blank">Get a free API key</a>
                </div>
              </div>

              <!-- Location -->
              <div class="form-group">
                <label>Location</label>
                <div class="form-row">
                  <input
                    v-model.number="localSettings.location.lat"
                    type="number"
                    step="0.000001"
                    class="form-input"
                    placeholder="Latitude"
                  />
                  <input
                    v-model.number="localSettings.location.lon"
                    type="number"
                    step="0.000001"
                    class="form-input"
                    placeholder="Longitude"
                  />
                </div>
                <button type="button" class="link-button" @click="getCurrentLocation" :disabled="gettingLocation">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  {{ gettingLocation ? 'Getting location...' : 'Use Current Location' }}
                </button>
              </div>

              <!-- Update Interval -->
              <div class="form-group">
                <label>Update Interval (minutes)</label>
                <input
                  v-model.number="localSettings.updateInterval"
                  type="number"
                  min="5"
                  max="120"
                  class="form-input"
                />
                <div class="form-hint">How often to fetch weather data (5-120 minutes)</div>
              </div>

              <!-- Safety Thresholds -->
              <div class="form-group">
                <label>Safety Thresholds</label>
                <div class="form-hint">Tasks will be postponed if weather conditions exceed these thresholds</div>

                <div class="form-row">
                  <div class="form-col">
                    <label class="label-sm">Max Wind Speed (m/s)</label>
                    <input
                      v-model.number="localSettings.conditions.maxWindSpeed"
                      type="number"
                      step="0.1"
                      class="form-input"
                    />
                    <div class="form-hint">~22 mph = 10 m/s</div>
                  </div>
                  <div class="form-col">
                    <label class="label-sm">Max Rain Rate (mm/h)</label>
                    <input
                      v-model.number="localSettings.conditions.maxRainRate"
                      type="number"
                      step="0.1"
                      class="form-input"
                    />
                    <div class="form-hint">Light rain ~2 mm/h</div>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-col">
                    <label class="label-sm">Max Snow Rate (mm/h)</label>
                    <input
                      v-model.number="localSettings.conditions.maxSnowRate"
                      type="number"
                      step="0.1"
                      class="form-input"
                    />
                  </div>
                  <div class="form-col">
                    <label class="label-sm">Min Visibility (m)</label>
                    <input
                      v-model.number="localSettings.conditions.minVisibility"
                      type="number"
                      step="100"
                      class="form-input"
                    />
                    <div class="form-hint">1000m = 1km</div>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-col">
                    <label class="label-sm">Min Temperature (°C)</label>
                    <input
                      v-model.number="localSettings.conditions.minTemp"
                      type="number"
                      step="1"
                      class="form-input"
                    />
                    <div class="form-hint">0°C = 32°F</div>
                  </div>
                  <div class="form-col">
                    <label class="label-sm">Max Temperature (°C)</label>
                    <input
                      v-model.number="localSettings.conditions.maxTemp"
                      type="number"
                      step="1"
                      class="form-input"
                    />
                    <div class="form-hint">40°C = 104°F</div>
                  </div>
                </div>

                <!-- Avoid Conditions -->
                <div class="form-col">
                  <label class="label-sm">Avoid Weather Conditions</label>
                  <div class="tag-container">
                    <span
                      v-for="condition in localSettings.conditions.avoidConditions"
                      :key="condition"
                      class="tag"
                    >
                      {{ condition }}
                      <button type="button" @click="removeCondition(condition)" class="tag-remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </span>
                  </div>
                  <select v-model="selectedCondition" class="form-input" @change="addCondition">
                    <option value="">Select condition to avoid</option>
                    <option v-for="opt in availableConditions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <div class="form-hint">Tasks will be postponed during these conditions</div>
                </div>
              </div>

              <!-- Presets -->
              <div class="form-group">
                <label>Presets</label>
                <div class="preset-buttons">
                  <button type="button" class="btn-preset" @click="applyPreset('conservative')">
                    Conservative
                  </button>
                  <button type="button" class="btn-preset" @click="applyPreset('moderate')">
                    Moderate
                  </button>
                  <button type="button" class="btn-preset" @click="applyPreset('aggressive')">
                    Aggressive
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="close">Cancel</button>
            <button type="button" class="btn-secondary" @click="testConnection" :disabled="testing">
              {{ testing ? 'Testing...' : 'Test Connection' }}
            </button>
            <button type="button" class="btn-primary" @click="saveSettings">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useDialog } from '@/composables/useDialog'
import type { WeatherSettings } from '@/types/weather'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const weatherStore = useWeatherStore()
const dialog = useDialog()

const localSettings = ref<WeatherSettings>(JSON.parse(JSON.stringify(weatherStore.settings)))
const showApiKey = ref(false)
const gettingLocation = ref(false)
const testing = ref(false)
const selectedCondition = ref('')

const weatherConditionOptions = [
  'Thunderstorm',
  'Tornado',
  'Hurricane',
  'Squall',
  'Rain',
  'Drizzle',
  'Snow',
  'Fog',
  'Mist',
  'Dust',
  'Sand',
  'Ash'
]

const availableConditions = computed(() => {
  return weatherConditionOptions.filter(
    opt => !localSettings.value.conditions.avoidConditions.includes(opt)
  )
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    localSettings.value = JSON.parse(JSON.stringify(weatherStore.settings))
  }
})

async function getCurrentLocation() {
  if (!navigator.geolocation) {
    await dialog.alert('Geolocation is not supported by your browser', 'Geolocation Unavailable', { variant: 'error' })
    return
  }

  gettingLocation.value = true

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject)
    })

    localSettings.value.location.lat = position.coords.latitude
    localSettings.value.location.lon = position.coords.longitude
  } catch (error) {
    await dialog.alert('Failed to get current location', 'Location Error', { variant: 'error' })
  } finally {
    gettingLocation.value = false
  }
}

function addCondition() {
  if (selectedCondition.value && !localSettings.value.conditions.avoidConditions.includes(selectedCondition.value)) {
    localSettings.value.conditions.avoidConditions.push(selectedCondition.value)
    selectedCondition.value = ''
  }
}

function removeCondition(condition: string) {
  const index = localSettings.value.conditions.avoidConditions.indexOf(condition)
  if (index > -1) {
    localSettings.value.conditions.avoidConditions.splice(index, 1)
  }
}

function applyPreset(preset: 'conservative' | 'moderate' | 'aggressive') {
  switch (preset) {
    case 'conservative':
      localSettings.value.conditions = {
        maxWindSpeed: 5,
        maxRainRate: 0.5,
        maxSnowRate: 0.5,
        minVisibility: 2000,
        minTemp: 5,
        maxTemp: 35,
        avoidConditions: ['Thunderstorm', 'Tornado', 'Hurricane', 'Squall', 'Rain', 'Snow', 'Fog']
      }
      break
    case 'moderate':
      localSettings.value.conditions = {
        maxWindSpeed: 10,
        maxRainRate: 2,
        maxSnowRate: 1,
        minVisibility: 1000,
        minTemp: 0,
        maxTemp: 40,
        avoidConditions: ['Thunderstorm', 'Tornado', 'Hurricane', 'Squall']
      }
      break
    case 'aggressive':
      localSettings.value.conditions = {
        maxWindSpeed: 15,
        maxRainRate: 5,
        maxSnowRate: 3,
        minVisibility: 500,
        minTemp: -5,
        maxTemp: 45,
        avoidConditions: ['Tornado', 'Hurricane']
      }
      break
  }
}

async function testConnection() {
  if (!localSettings.value.apiKey) {
    await dialog.alert('Please enter an API key first', 'Missing API Key', { variant: 'warning' })
    return
  }

  if (localSettings.value.location.lat === 0 || localSettings.value.location.lon === 0) {
    await dialog.alert('Please set a location first', 'Missing Location', { variant: 'warning' })
    return
  }

  testing.value = true

  try {
    weatherStore.updateSettings(localSettings.value)
    await weatherStore.fetchWeather()
    await dialog.alert('Weather data fetched successfully!', 'Connection Successful', { variant: 'success' })
  } catch (error) {
    await dialog.alert('Failed to fetch weather data. Please check your API key and location.', 'Connection Failed', { variant: 'error' })
  } finally {
    testing.value = false
  }
}

function saveSettings() {
  weatherStore.updateSettings(localSettings.value)
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables';

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover {
      color: var(--text-primary);
    }
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;

    &.label-sm {
      font-size: 13px;
      margin-bottom: 6px;
    }
  }
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary-green);
  }
}

.input-group {
  display: flex;
  gap: 0;

  .form-input {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .input-button {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-left: none;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
    padding: 0 12px;
    cursor: pointer;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 18px;
      height: 18px;
    }

    &:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-col {
  display: flex;
  flex-direction: column;
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;

  a {
    color: var(--primary-green);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle-input {
  position: relative;
  width: 44px;
  height: 24px;
  appearance: none;
  background: var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:checked {
    background: var(--primary-green);
  }

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  &:checked::after {
    transform: translateX(20px);
  }
}

.toggle-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--primary-green);
  color: white;
  border-radius: 4px;
  font-size: 13px;

  .tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    color: white;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.btn-preset {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-green);
    color: var(--primary-green);
  }
}

.link-button {
  background: none;
  border: none;
  color: var(--primary-green);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 0;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;

  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-green-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-secondary);
    border-color: var(--text-secondary);
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;

  .modal-dialog {
    transition: transform 0.2s;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-dialog {
    transform: scale(0.95);
  }
}
</style>
