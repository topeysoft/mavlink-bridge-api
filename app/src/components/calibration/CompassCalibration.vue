<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalibrationStore, type CompassCalibrationMethod } from '@/stores/calibration'
import { useCompassStore } from '@/stores/compass'
import StaticHeadingCalibration from './StaticHeadingCalibration.vue'
import AutoLearnCalibration from './AutoLearnCalibration.vue'

const props = defineProps<{
  mode: 'consumer' | 'expert'
}>()

const calibrationStore = useCalibrationStore()
const compassStore = useCompassStore()

const state = computed(() => calibrationStore.calibrationStates.compass)
const isActive = computed(() => state.value.status === 'in_progress')

// Method selection
const selectedMethod = ref<CompassCalibrationMethod>(state.value.compassMethod || 'standard')

// Compass visualization data
const compassHeading = computed(() => compassStore.heading)
const compassQuality = computed(() => compassStore.calibrationQuality)
const fieldStrength = computed(() => compassStore.fieldStrength)

// Consumer mode - simple question
const canMoveVehicle = ref<boolean | null>(null)
const showMethodSelection = ref(false)

// Consumer mode instructions for standard method
const instructions = computed(() => {
  if (state.value.progress < 25) {
    return 'Slowly rotate the vehicle 360° horizontally (like a carousel)'
  } else if (state.value.progress < 50) {
    return 'Tilt the vehicle forward and rotate 360°'
  } else if (state.value.progress < 75) {
    return 'Tilt the vehicle to the side and rotate 360°'
  } else {
    return 'Final rotation - keep rotating until complete'
  }
})

// Method descriptions
const methodDescriptions: Record<CompassCalibrationMethod, { title: string; description: string; icon: string }> = {
  standard: {
    title: 'Standard Rotation',
    description: 'Rotate vehicle through all orientations (best accuracy)',
    icon: '🔄'
  },
  large_vehicle: {
    title: 'Large Vehicle',
    description: 'Onboard calibration optimized for heavy vehicles',
    icon: '🚜'
  },
  static_heading: {
    title: 'Static Heading',
    description: 'No movement required - uses GPS and known heading',
    icon: '📍'
  },
  auto_learn: {
    title: 'Auto-Learn',
    description: 'Automatic calibration during normal driving',
    icon: '🤖'
  }
}

// Auto-select method for consumer based on answer
function handleVehicleMobilityAnswer(canMove: boolean) {
  canMoveVehicle.value = canMove
  if (!canMove) {
    // Show alternative methods
    showMethodSelection.value = true
  } else {
    selectedMethod.value = 'standard'
    calibrationStore.setCompassMethod('standard')
  }
}

function selectMethod(method: CompassCalibrationMethod) {
  selectedMethod.value = method
  calibrationStore.setCompassMethod(method)
  showMethodSelection.value = false
}

async function startCalibration() {
  await calibrationStore.startCalibration('compass')
}

function cancelCalibration() {
  calibrationStore.cancelCalibration('compass')
}

function resetMethodSelection() {
  canMoveVehicle.value = null
  showMethodSelection.value = false
  selectedMethod.value = 'standard'
}
</script>

<template>
  <div class="compass-calibration" :class="{ active: isActive }">
    <div class="calibration-header">
      <div class="header-content">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
            <path d="M12 2L8 6h8l-4-4zm0 20l4-4H8l4 4zM2 12l4-4v8l-4-4zm20 0l-4 4V8l4 4z"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          Compass Calibration
        </h3>
        <p v-if="mode === 'consumer'" class="subtitle">
          Calibrate the magnetometer for accurate heading information
        </p>
      </div>

      <div class="status-badge" :class="state.status">
        {{ state.status === 'success' ? 'Calibrated' : state.status === 'in_progress' ? 'Calibrating...' : 'Not Calibrated' }}
      </div>
    </div>

    <!-- Consumer Mode View -->
    <div v-if="mode === 'consumer'" class="consumer-view">
      <!-- Step 1: Vehicle Mobility Question -->
      <div v-if="canMoveVehicle === null && !isActive && state.status !== 'success'" class="mobility-question">
        <h4>Let's choose the best calibration method for your vehicle</h4>
        <p>Can you easily lift and move your vehicle to different positions?</p>

        <div class="answer-buttons">
          <button class="answer-btn yes" @click="handleVehicleMobilityAnswer(true)">
            <div class="answer-icon">✓</div>
            <div class="answer-text">
              <div class="answer-title">Yes, I can move it</div>
              <div class="answer-description">Use standard rotation method</div>
            </div>
          </button>

          <button class="answer-btn no" @click="handleVehicleMobilityAnswer(false)">
            <div class="answer-icon">✗</div>
            <div class="answer-text">
              <div class="answer-title">No, it's too heavy</div>
              <div class="answer-description">Use alternative method</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 2: Alternative Method Selection -->
      <div v-else-if="showMethodSelection" class="method-selection">
        <h4>Choose a calibration method:</h4>
        <p>Since your vehicle is difficult to move, here are your options:</p>

        <div class="method-cards">
          <div class="method-card recommended" @click="selectMethod('static_heading')">
            <div class="method-badge">Recommended</div>
            <div class="method-icon">{{ methodDescriptions.static_heading.icon }}</div>
            <h5>{{ methodDescriptions.static_heading.title }}</h5>
            <p>{{ methodDescriptions.static_heading.description }}</p>
            <ul class="method-requirements">
              <li>Requires GPS lock</li>
              <li>No movement needed</li>
              <li>Quick setup</li>
            </ul>
          </div>

          <div class="method-card" @click="selectMethod('auto_learn')">
            <div class="method-icon">{{ methodDescriptions.auto_learn.icon }}</div>
            <h5>{{ methodDescriptions.auto_learn.title }}</h5>
            <p>{{ methodDescriptions.auto_learn.description }}</p>
            <ul class="method-requirements">
              <li>Calibrates while driving</li>
              <li>Takes 5-10 minutes</li>
              <li>Continuous improvement</li>
            </ul>
          </div>

          <div class="method-card" @click="selectMethod('large_vehicle')">
            <div class="method-icon">{{ methodDescriptions.large_vehicle.icon }}</div>
            <h5>{{ methodDescriptions.large_vehicle.title }}</h5>
            <p>{{ methodDescriptions.large_vehicle.description }}</p>
            <ul class="method-requirements">
              <li>Optimized for heavy vehicles</li>
              <li>Some movement required</li>
              <li>Higher accuracy</li>
            </ul>
          </div>
        </div>

        <button class="btn btn-secondary" @click="resetMethodSelection">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
      </div>

      <!-- Step 3: Show Selected Method Component -->
      <div v-else>
        <!-- Static Heading Method -->
        <StaticHeadingCalibration v-if="selectedMethod === 'static_heading'" mode="consumer" />

        <!-- Auto-Learn Method -->
        <AutoLearnCalibration v-else-if="selectedMethod === 'auto_learn'" mode="consumer" />

        <!-- Standard or Large Vehicle Method -->
        <div v-else class="visual-guide">
          <!-- Compass visualization -->
          <div class="compass-display">
            <svg viewBox="0 0 200 200" class="compass-svg">
              <!-- Compass circle -->
              <circle cx="100" cy="100" r="80" fill="none" stroke="var(--border-color)" stroke-width="2"/>
              <circle cx="100" cy="100" r="70" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2"/>

              <!-- Cardinal directions -->
              <text x="100" y="30" text-anchor="middle" class="cardinal">N</text>
              <text x="170" y="105" text-anchor="middle" class="cardinal">E</text>
              <text x="100" y="180" text-anchor="middle" class="cardinal">S</text>
              <text x="30" y="105" text-anchor="middle" class="cardinal">W</text>

              <!-- Heading arrow -->
              <g :transform="`rotate(${compassHeading} 100 100)`">
                <path d="M100,40 L105,100 L100,90 L95,100 Z" fill="var(--primary-green)"/>
              </g>
            </svg>
            <div class="heading-value">{{ Math.round(compassHeading) }}°</div>
          </div>

          <!-- Instructions -->
          <div v-if="isActive" class="instructions">
            <div class="instruction-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 7l-5-5-5 5"/>
              </svg>
            </div>
            <p>{{ instructions }}</p>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
            </div>
            <div class="progress-text">{{ state.progress }}%</div>
          </div>

          <div v-else-if="state.status === 'success'" class="success-message">
            <svg viewBox="0 0 24 24" fill="currentColor" class="success-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <h4>Calibration Complete!</h4>
            <p>Quality: {{ state.quality }}%</p>
          </div>

          <div v-else class="ready-message">
            <p>{{ state.message || 'Ready to calibrate compass' }}</p>
            <p class="note">Find an open area away from metal objects and electromagnetic interference</p>
          </div>

          <div class="action-buttons">
            <button v-if="!isActive && state.status !== 'success'" class="btn btn-primary" @click="startCalibration">
              Start Calibration
            </button>
            <button v-if="isActive" class="btn btn-secondary" @click="cancelCalibration">
              Cancel
            </button>
            <button v-if="state.status === 'success'" class="btn btn-secondary" @click="resetMethodSelection">
              Calibrate Again
            </button>
            <button v-if="!isActive && canMoveVehicle !== null" class="btn btn-secondary" @click="resetMethodSelection">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Change Method
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Expert Mode View -->
    <div v-else class="expert-view">
      <!-- Method Selection Tabs -->
      <div class="method-tabs">
        <button
          v-for="(method, key) in methodDescriptions"
          :key="key"
          class="method-tab"
          :class="{ active: selectedMethod === key }"
          @click="selectMethod(key as CompassCalibrationMethod)"
        >
          <span class="tab-icon">{{ method.icon }}</span>
          <span class="tab-label">{{ method.title }}</span>
        </button>
      </div>

      <!-- Current Metrics (always visible) -->
      <div class="metrics-grid">
        <div class="metric-card">
          <label>Heading</label>
          <div class="value">{{ Math.round(compassHeading) }}°</div>
          <div class="sublabel">{{ compassStore.cardinalDirection }}</div>
        </div>

        <div class="metric-card">
          <label>Field Strength</label>
          <div class="value">{{ Math.round(fieldStrength) }}</div>
          <div class="sublabel">milligauss</div>
        </div>

        <div class="metric-card">
          <label>Quality</label>
          <div class="value" :class="{
            'text-success': compassQuality >= 70,
            'text-warning': compassQuality >= 40 && compassQuality < 70,
            'text-danger': compassQuality < 40
          }">
            {{ compassQuality }}%
          </div>
        </div>

        <div class="metric-card">
          <label>Interference</label>
          <div class="value" :class="{
            'text-success': compassStore.interferenceLevel === 'low',
            'text-warning': compassStore.interferenceLevel === 'medium',
            'text-danger': compassStore.interferenceLevel === 'high'
          }">
            {{ compassStore.interferenceLevel.toUpperCase() }}
          </div>
        </div>
      </div>

      <!-- Method-Specific Content -->
      <div class="method-content">
        <!-- Static Heading Method -->
        <StaticHeadingCalibration v-if="selectedMethod === 'static_heading'" mode="expert" />

        <!-- Auto-Learn Method -->
        <AutoLearnCalibration v-else-if="selectedMethod === 'auto_learn'" mode="expert" />

        <!-- Standard or Large Vehicle Method -->
        <div v-else>
          <div v-if="isActive" class="calibration-progress">
            <h4>Calibration Progress</h4>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${state.progress}%` }"></div>
            </div>
            <p class="progress-message">{{ state.message }}</p>
          </div>

          <div class="expert-controls">
            <button v-if="!isActive" class="btn btn-primary" @click="startCalibration">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              Start {{ selectedMethod === 'large_vehicle' ? 'Large Vehicle' : 'Standard' }} Calibration
            </button>
            <button v-else class="btn btn-danger" @click="cancelCalibration">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Cancel
            </button>
          </div>

          <div v-if="state.errors.length > 0" class="error-messages">
            <h4>Errors</h4>
            <ul>
              <li v-for="(error, index) in state.errors" :key="index">{{ error }}</li>
            </ul>
          </div>

          <div class="method-info">
            <h4>{{ methodDescriptions[selectedMethod].title }} Method</h4>
            <p>{{ methodDescriptions[selectedMethod].description }}</p>

            <div v-if="selectedMethod === 'large_vehicle'" class="technical-notes">
              <h5>Large Vehicle Optimization:</h5>
              <ul>
                <li>Uses onboard processing for better accuracy</li>
                <li>Automatically detects compass orientation</li>
                <li>Optimized for vehicles with high magnetic interference</li>
                <li>May require COMPASS_OFFS_MAX adjustment (850 → 2000-3000)</li>
              </ul>
            </div>

            <div v-else class="technical-notes">
              <h5>Standard Method Requirements:</h5>
              <ul>
                <li>Rotate vehicle 360° in horizontal plane</li>
                <li>Tilt nose down/up and rotate</li>
                <li>Tilt sides and rotate</li>
                <li>Avoid metal objects and electromagnetic interference</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.compass-calibration {
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

.consumer-view {
  .mobility-question {
    padding: var(--spacing-xl);
    text-align: center;

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
      font-size: var(--font-size-lg);
    }

    p {
      margin: 0 0 var(--spacing-xl) 0;
      color: var(--text-secondary);
      font-size: var(--font-size-base);
    }

    .answer-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-lg);
      max-width: 600px;
      margin: 0 auto;

      .answer-btn {
        display: flex;
        align-items: center;
        gap: var(--spacing-lg);
        padding: var(--spacing-xl);
        background: var(--bg-secondary);
        border: 3px solid var(--border-color);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        &.yes:hover {
          border-color: var(--status-success);
          background: rgba(34, 197, 94, 0.05);
        }

        &.no:hover {
          border-color: var(--primary-green);
          background: rgba(44, 95, 45, 0.05);
        }

        .answer-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          flex-shrink: 0;
        }

        &.yes .answer-icon {
          background: rgba(34, 197, 94, 0.1);
          color: var(--status-success);
        }

        &.no .answer-icon {
          background: rgba(44, 95, 45, 0.1);
          color: var(--primary-green);
        }

        .answer-text {
          flex: 1;
          text-align: left;

          .answer-title {
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: var(--spacing-xs);
          }

          .answer-description {
            font-size: var(--font-size-sm);
            color: var(--text-secondary);
          }
        }
      }
    }
  }

  .method-selection {
    h4 {
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--text-primary);
      font-size: var(--font-size-lg);
    }

    p {
      margin: 0 0 var(--spacing-xl) 0;
      color: var(--text-secondary);
    }

    .method-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-xl);

      .method-card {
        position: relative;
        padding: var(--spacing-xl);
        background: var(--bg-secondary);
        border: 2px solid var(--border-color);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-4px);
          border-color: var(--primary-green);
          box-shadow: var(--shadow-lg);
        }

        &.recommended {
          border-color: var(--primary-green);

          .method-badge {
            position: absolute;
            top: -12px;
            right: var(--spacing-md);
            padding: var(--spacing-xs) var(--spacing-md);
            background: var(--primary-green);
            color: white;
            font-size: var(--font-size-xs);
            font-weight: 600;
            border-radius: var(--border-radius);
            text-transform: uppercase;
          }
        }

        .method-icon {
          font-size: 48px;
          margin-bottom: var(--spacing-md);
          text-align: center;
        }

        h5 {
          margin: 0 0 var(--spacing-sm) 0;
          color: var(--text-primary);
          font-size: var(--font-size-base);
          text-align: center;
        }

        p {
          margin: 0 0 var(--spacing-md) 0;
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
          text-align: center;
        }

        .method-requirements {
          margin: 0;
          padding: 0;
          list-style: none;

          li {
            padding: var(--spacing-xs) 0;
            color: var(--text-tertiary);
            font-size: var(--font-size-xs);
            text-align: center;

            &::before {
              content: '✓ ';
              color: var(--status-success);
              font-weight: bold;
            }
          }
        }
      }
    }
  }

  .visual-guide {
    margin-bottom: var(--spacing-xl);
  }

  .compass-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);

    .compass-svg {
      width: 200px;
      height: 200px;

      .cardinal {
        fill: var(--text-secondary);
        font-size: 14px;
        font-weight: 600;
      }
    }

    .heading-value {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--primary-green);
    }
  }

  .instructions {
    margin-top: var(--spacing-xl);
    padding: var(--spacing-xl);
    background: linear-gradient(135deg, var(--primary-green) 0%, #87CEEB 100%);
    color: white;
    border-radius: var(--border-radius);
    text-align: center;

    .instruction-icon {
      display: flex;
      justify-content: center;
      margin-bottom: var(--spacing-md);

      svg {
        width: 48px;
        height: 48px;
        animation: rotate 3s linear infinite;
      }
    }

    p {
      margin: 0 0 var(--spacing-lg) 0;
      font-size: var(--font-size-lg);
      font-weight: 500;
    }

    .progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);

      .progress-fill {
        height: 100%;
        background: white;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      font-size: var(--font-size-sm);
      opacity: 0.9;
    }
  }

  .success-message,
  .ready-message {
    padding: var(--spacing-xl);
    text-align: center;

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
      margin: 0;
      color: var(--text-secondary);

      &.note {
        margin-top: var(--spacing-md);
        font-size: var(--font-size-sm);
        font-style: italic;
      }
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }
}

.expert-view {
  .method-tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xl);

    .method-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-md);
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--primary-green);
      }

      &.active {
        background: var(--primary-green);
        border-color: var(--primary-green);
        color: white;

        .tab-icon {
          transform: scale(1.2);
        }
      }

      .tab-icon {
        font-size: 24px;
        transition: transform 0.2s ease;
      }

      .tab-label {
        font-size: var(--font-size-sm);
        font-weight: 600;
        text-align: center;
      }
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .metric-card {
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
      &.text-warning { color: var(--status-warning); }
      &.text-danger { color: var(--status-danger); }
    }

    .sublabel {
      margin-top: var(--spacing-xs);
      color: var(--text-tertiary);
      font-size: var(--font-size-xs);
    }
  }

  .method-content {
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
        height: 24px;
        background: var(--bg-primary);
        border-radius: var(--border-radius);
        overflow: hidden;
        margin-bottom: var(--spacing-md);

        .progress-fill {
          height: 100%;
          background: var(--primary-green);
          transition: width 0.3s ease;
        }
      }

      .progress-message {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }
    }

    .expert-controls {
      display: flex;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
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

    .method-info {
      padding: var(--spacing-lg);
      background: rgba(44, 95, 45, 0.05);
      border-radius: var(--border-radius);

      h4 {
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--primary-green);
        font-size: var(--font-size-lg);
      }

      p {
        margin: 0 0 var(--spacing-md) 0;
        color: var(--text-secondary);
      }

      .technical-notes {
        h5 {
          margin: var(--spacing-md) 0 var(--spacing-sm) 0;
          color: var(--text-primary);
          font-size: var(--font-size-base);
        }

        ul {
          margin: 0;
          padding-left: var(--spacing-xl);
          color: var(--text-secondary);
          font-size: var(--font-size-sm);

          li {
            margin-bottom: var(--spacing-xs);
          }
        }
      }
    }
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
