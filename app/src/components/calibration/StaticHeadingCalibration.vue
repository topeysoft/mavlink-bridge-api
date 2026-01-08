<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import { useCompassStore } from '@/stores/compass'
import { useGpsStore } from '@/stores/gps'

const props = defineProps<{
  mode: 'consumer' | 'expert'
}>()

const calibrationStore = useCalibrationStore()
const compassStore = useCompassStore()
const gpsStore = useGpsStore()

const state = computed(() => calibrationStore.calibrationStates.compass)
const isActive = computed(() => state.value.status === 'in_progress')

// GPS status
const hasGpsLock = computed(() => gpsStore.hasGoodFix)
const gpsFixType = computed(() => gpsStore.fixType)

// Heading input
const trueHeading = ref<number>(0)
const magneticHeading = computed(() => compassStore.heading)
const declination = computed(() => compassStore.declination)

// Calculate TRUE heading from magnetic
const calculatedTrueHeading = computed(() => {
  return Math.round((magneticHeading.value + declination.value + 360) % 360)
})

// Validation
const canStart = computed(() => {
  return hasGpsLock.value && trueHeading.value >= 0 && trueHeading.value < 360
})

const headingError = computed(() => {
  if (trueHeading.value < 0 || trueHeading.value >= 360) {
    return 'Heading must be between 0° and 359°'
  }
  return null
})

async function startCalibration() {
  if (!canStart.value) return
  await calibrationStore.startStaticHeadingCalibration(trueHeading.value)
}

function cancelCalibration() {
  calibrationStore.cancelCalibration('compass')
}

// Auto-fill with current heading suggestion
function useCurrentHeading() {
  trueHeading.value = calculatedTrueHeading.value
}
</script>

<template>
  <div class="static-heading-calibration" :class="{ active: isActive }">
    <div class="calibration-header">
      <div class="header-content">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
            <path d="M12 2L8 6h8l-4-4zm0 20l4-4H8l4 4zM2 12l4-4v8l-4-4zm20 0l-4 4V8l4 4z"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          Static Heading Calibration
        </h3>
        <p v-if="mode === 'consumer'" class="subtitle">
          Perfect for heavy vehicles that can't be easily moved
        </p>
      </div>

      <div class="status-badge" :class="state.status">
        {{ state.status === 'success' ? 'Calibrated' : state.status === 'in_progress' ? 'Calibrating...' : 'Ready' }}
      </div>
    </div>

    <!-- GPS Status Warning -->
    <div v-if="!hasGpsLock" class="warning-banner">
      <svg viewBox="0 0 24 24" fill="currentColor" class="warning-icon">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
      <div class="warning-content">
        <h4>GPS Lock Required</h4>
        <p>Move vehicle to an open area with clear sky view. Current fix: {{ gpsFixType || 'No Fix' }}</p>
      </div>
    </div>

    <!-- Consumer Mode View -->
    <div v-if="mode === 'consumer'" class="consumer-view">
      <div class="visual-guide">
        <!-- Current compass display -->
        <div class="compass-display">
          <svg viewBox="0 0 200 200" class="compass-svg">
            <circle cx="100" cy="100" r="80" fill="none" stroke="var(--border-color)" stroke-width="2"/>
            <circle cx="100" cy="100" r="70" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2"/>

            <!-- Cardinal directions -->
            <text x="100" y="30" text-anchor="middle" class="cardinal">N</text>
            <text x="170" y="105" text-anchor="middle" class="cardinal">E</text>
            <text x="100" y="180" text-anchor="middle" class="cardinal">S</text>
            <text x="30" y="105" text-anchor="middle" class="cardinal">W</text>

            <!-- Current heading arrow -->
            <g :transform="`rotate(${magneticHeading} 100 100)`">
              <path d="M100,40 L105,100 L100,90 L95,100 Z" fill="var(--text-tertiary)" opacity="0.5"/>
            </g>

            <!-- Target heading (if entered) -->
            <g v-if="trueHeading > 0" :transform="`rotate(${trueHeading} 100 100)`">
              <path d="M100,40 L105,100 L100,90 L95,100 Z" fill="var(--primary-green)"/>
            </g>
          </svg>
          <div class="heading-values">
            <div class="current-heading">Current: {{ Math.round(magneticHeading) }}° (Magnetic)</div>
            <div v-if="trueHeading > 0" class="target-heading">Target: {{ trueHeading }}° (TRUE)</div>
          </div>
        </div>

        <!-- Instructions -->
        <div v-if="!isActive" class="instructions-panel">
          <h4>How to Find TRUE Heading:</h4>
          <ol>
            <li>
              <strong>Use a Landmark:</strong> Point the vehicle at a known landmark (building, mountain) and look up its bearing on a map
            </li>
            <li>
              <strong>Use Another Compass:</strong> Use a calibrated compass or phone app
              <span class="note">Note: Add local declination ({{ Math.abs(declination).toFixed(1) }}° {{ declination >= 0 ? 'E' : 'W' }}) to magnetic heading</span>
            </li>
            <li>
              <strong>Use GPS Bearing:</strong> Drive straight for 50+ meters and use GPS course over ground
            </li>
          </ol>

          <div class="heading-input-section">
            <label for="true-heading">Enter TRUE Heading (0-359°):</label>
            <div class="input-with-button">
              <input
                id="true-heading"
                v-model.number="trueHeading"
                type="number"
                min="0"
                max="359"
                class="heading-input"
                :class="{ error: headingError }"
                placeholder="Enter heading in degrees"
              />
              <button class="btn btn-secondary btn-sm" @click="useCurrentHeading" title="Use current compass heading as reference">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L8 6h8l-4-4zm0 20l4-4H8l4 4z"/>
                </svg>
                Use Current
              </button>
            </div>
            <p v-if="headingError" class="error-message">{{ headingError }}</p>
            <p v-else-if="declination" class="hint-message">
              Local declination: {{ declination.toFixed(1) }}° {{ declination >= 0 ? 'East' : 'West' }}
            </p>
          </div>
        </div>

        <!-- Active calibration -->
        <div v-else class="calibration-active">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
          <p class="status-message">{{ state.message }}</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
          </div>
          <p class="progress-text">{{ state.progress }}% Complete</p>
        </div>

        <!-- Success message -->
        <div v-if="state.status === 'success'" class="success-message">
          <svg viewBox="0 0 24 24" fill="currentColor" class="success-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <h4>Calibration Complete!</h4>
          <p>Compass calibrated using heading {{ state.staticHeading }}°</p>
          <p>Quality: {{ state.quality }}%</p>
        </div>
      </div>

      <div class="action-buttons">
        <button v-if="!isActive && state.status !== 'success'" class="btn btn-primary" :disabled="!canStart" @click="startCalibration">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Start Calibration
        </button>
        <button v-if="isActive" class="btn btn-secondary" @click="cancelCalibration">
          Cancel
        </button>
        <button v-if="state.status === 'success'" class="btn btn-secondary" @click="trueHeading = 0">
          Calibrate Again
        </button>
      </div>
    </div>

    <!-- Expert Mode View -->
    <div v-else class="expert-view">
      <div class="info-grid">
        <div class="info-card">
          <label>GPS Status</label>
          <div class="value" :class="{ 'text-success': hasGpsLock, 'text-danger': !hasGpsLock }">
            {{ hasGpsLock ? '3D Lock' : (gpsFixType || 'No Fix') }}
          </div>
          <div class="sublabel">Required for calibration</div>
        </div>

        <div class="info-card">
          <label>Current Heading</label>
          <div class="value">{{ Math.round(magneticHeading) }}°</div>
          <div class="sublabel">Magnetic</div>
        </div>

        <div class="info-card">
          <label>Declination</label>
          <div class="value">{{ declination.toFixed(1) }}°</div>
          <div class="sublabel">{{ declination >= 0 ? 'East' : 'West' }}</div>
        </div>

        <div class="info-card">
          <label>TRUE Heading</label>
          <div class="value">{{ calculatedTrueHeading }}°</div>
          <div class="sublabel">Calculated</div>
        </div>
      </div>

      <div class="expert-controls">
        <div class="control-group">
          <label for="expert-heading">TRUE Heading (degrees):</label>
          <input
            id="expert-heading"
            v-model.number="trueHeading"
            type="number"
            min="0"
            max="359"
            class="input"
            :class="{ error: headingError }"
          />
          <p v-if="headingError" class="error-message">{{ headingError }}</p>
          <p v-else class="hint">Enter the vehicle's actual TRUE heading (geographic north, not magnetic)</p>
        </div>

        <div class="button-group">
          <button v-if="!isActive" class="btn btn-primary" :disabled="!canStart" @click="startCalibration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            Start Static Heading Calibration
          </button>
          <button v-else class="btn btn-danger" @click="cancelCalibration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
          </button>
        </div>
      </div>

      <div v-if="isActive" class="calibration-progress">
        <h4>Calibration Progress</h4>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${state.progress}%` }">
            <span v-if="state.progress > 10" class="progress-label">{{ state.progress }}%</span>
          </div>
        </div>
        <p class="progress-message">{{ state.message }}</p>
      </div>

      <div v-if="state.errors.length > 0" class="error-messages">
        <h4>Errors</h4>
        <ul>
          <li v-for="(error, index) in state.errors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <div class="technical-notes">
        <h4>Technical Notes</h4>
        <ul>
          <li>Static heading calibration requires active 3D GPS lock</li>
          <li>Heading must be TRUE (geographic north), not magnetic north</li>
          <li>To convert magnetic to TRUE: Add declination if East, subtract if West</li>
          <li>Most accurate when vehicle is precisely aligned with known landmark</li>
          <li>Vehicle must remain stationary during calibration</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.static-heading-calibration {
  @include card;
  padding: var(--spacing-xl);

  &.active {
    border-color: var(--primary-green);
  }
}

.calibration-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);

  .header-content {
    h3 {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-xl);
      color: var(--text-primary);

      .icon {
        width: 28px;
        height: 28px;
        color: var(--primary-green);
      }
    }

    .subtitle {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .status-badge {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--border-radius);
    font-size: var(--font-size-sm);
    font-weight: 600;
    background: var(--bg-secondary);
    color: var(--text-secondary);

    &.success {
      background: var(--status-success);
      color: white;
    }

    &.in_progress {
      background: var(--primary-green);
      color: white;
    }
  }
}

.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: rgba(251, 191, 36, 0.1);
  border: 2px solid var(--status-warning);
  border-radius: var(--border-radius);
  margin-bottom: var(--spacing-xl);

  .warning-icon {
    width: 32px;
    height: 32px;
    color: var(--status-warning);
    flex-shrink: 0;
  }

  .warning-content {
    flex: 1;

    h4 {
      margin: 0 0 var(--spacing-xs) 0;
      color: var(--text-primary);
      font-size: var(--font-size-base);
    }

    p {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }
}

.consumer-view {
  .compass-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);

    .compass-svg {
      width: 200px;
      height: 200px;

      .cardinal {
        fill: var(--text-secondary);
        font-size: 14px;
        font-weight: 600;
      }
    }

    .heading-values {
      text-align: center;

      .current-heading {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-xs);
      }

      .target-heading {
        font-size: var(--font-size-lg);
        color: var(--primary-green);
        font-weight: 600;
      }
    }
  }

  .instructions-panel {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    ol {
      margin: 0 0 var(--spacing-xl) 0;
      padding-left: var(--spacing-xl);
      color: var(--text-secondary);

      li {
        margin-bottom: var(--spacing-md);

        strong {
          color: var(--text-primary);
        }

        .note {
          display: block;
          margin-top: var(--spacing-xs);
          font-size: var(--font-size-xs);
          font-style: italic;
          color: var(--text-tertiary);
        }
      }
    }

    .heading-input-section {
      label {
        display: block;
        margin-bottom: var(--spacing-sm);
        font-weight: 600;
        color: var(--text-primary);
      }

      .input-with-button {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);

        .heading-input {
          flex: 1;
          padding: var(--spacing-md);
          font-size: var(--font-size-lg);
          text-align: center;
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          background: var(--bg-primary);
          color: var(--text-primary);

          &.error {
            border-color: var(--status-danger);
          }

          &:focus {
            outline: none;
            border-color: var(--primary-green);
          }
        }
      }

      .error-message {
        margin: 0;
        color: var(--status-danger);
        font-size: var(--font-size-sm);
      }

      .hint-message {
        margin: 0;
        color: var(--text-tertiary);
        font-size: var(--font-size-sm);
        font-style: italic;
      }
    }
  }

  .calibration-active {
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    text-align: center;
    margin-bottom: var(--spacing-xl);

    .spinner-container {
      display: flex;
      justify-content: center;
      margin-bottom: var(--spacing-lg);
    }

    .status-message {
      margin: 0 0 var(--spacing-lg) 0;
      color: var(--text-primary);
      font-size: var(--font-size-base);
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-primary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);

      .progress-fill {
        height: 100%;
        background: var(--primary-green);
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .success-message {
    padding: var(--spacing-xl);
    text-align: center;
    margin-bottom: var(--spacing-xl);

    .success-icon {
      width: 64px;
      height: 64px;
      color: var(--status-success);
      margin-bottom: var(--spacing-md);
    }

    h4 {
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--text-primary);
    }

    p {
      margin: 0 0 var(--spacing-xs) 0;
      color: var(--text-secondary);
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
  }
}

.expert-view {
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .info-card {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    text-align: center;

    label {
      display: block;
      margin-bottom: var(--spacing-sm);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .value {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--text-primary);

      &.text-success { color: var(--status-success); }
      &.text-danger { color: var(--status-danger); }
    }

    .sublabel {
      margin-top: var(--spacing-xs);
      color: var(--text-tertiary);
      font-size: var(--font-size-xs);
    }
  }

  .expert-controls {
    margin-bottom: var(--spacing-xl);

    .control-group {
      margin-bottom: var(--spacing-lg);

      label {
        display: block;
        margin-bottom: var(--spacing-sm);
        font-weight: 600;
        color: var(--text-primary);
      }

      .input {
        width: 100%;
        max-width: 300px;

        &.error {
          border-color: var(--status-danger);
        }
      }

      .error-message {
        margin: var(--spacing-xs) 0 0 0;
        color: var(--status-danger);
        font-size: var(--font-size-sm);
      }

      .hint {
        margin: var(--spacing-xs) 0 0 0;
        color: var(--text-tertiary);
        font-size: var(--font-size-sm);
      }
    }

    .button-group {
      display: flex;
      gap: var(--spacing-md);
    }
  }

  .calibration-progress {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    .progress-bar {
      height: 32px;
      background: var(--bg-primary);
      border-radius: var(--border-radius);
      overflow: hidden;
      margin-bottom: var(--spacing-md);

      .progress-fill {
        height: 100%;
        background: var(--primary-green);
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;

        .progress-label {
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 600;
        }
      }
    }

    .progress-message {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }
  }

  .error-messages {
    padding: var(--spacing-lg);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--status-danger);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--status-danger);
    }

    ul {
      margin: 0;
      padding-left: var(--spacing-xl);
      color: var(--text-secondary);
    }
  }

  .technical-notes {
    padding: var(--spacing-lg);
    background: rgba(44, 95, 45, 0.05);
    border-radius: var(--border-radius);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--primary-green);
      font-size: var(--font-size-base);
    }

    ul {
      margin: 0;
      padding-left: var(--spacing-xl);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);

      li {
        margin-bottom: var(--spacing-xs);

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
}
</style>
