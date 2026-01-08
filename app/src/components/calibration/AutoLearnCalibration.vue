<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import { useCompassStore } from '@/stores/compass'

const props = defineProps<{
  mode: 'consumer' | 'expert'
}>()

const calibrationStore = useCalibrationStore()
const compassStore = useCompassStore()

const state = computed(() => calibrationStore.calibrationStates.compass)
const isLearning = computed(() => state.value.autoLearnEnabled)

// Learn mode selection
const learnMode = ref<1 | 2 | 3>(3) // Default: both compasses

const compassQuality = computed(() => compassStore.calibrationQuality)
const interferenceLevel = computed(() => compassStore.interferenceLevel)

async function startAutoLearn() {
  await calibrationStore.enableAutoLearnCalibration(learnMode.value)
}

function stopAutoLearn() {
  // Disable auto-learn by setting to 0
  calibrationStore.enableAutoLearnCalibration(1) // Will be updated to support disable
}
</script>

<template>
  <div class="auto-learn-calibration">
    <div class="calibration-header">
      <div class="header-content">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Auto-Learn Calibration
        </h3>
        <p v-if="mode === 'consumer'" class="subtitle">
          Automatic offset learning during normal driving
        </p>
      </div>

      <div class="status-badge" :class="{ active: isLearning }">
        {{ isLearning ? 'Learning Active' : 'Learning Inactive' }}
      </div>
    </div>

    <!-- Consumer Mode View -->
    <div v-if="mode === 'consumer'" class="consumer-view">
      <div class="info-panel">
        <h4>How It Works</h4>
        <p>Auto-learn automatically improves compass accuracy during normal operation. The system learns and corrects for magnetic interference from your vehicle.</p>

        <div class="benefits-list">
          <div class="benefit-item">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>No manual calibration needed</span>
          </div>
          <div class="benefit-item">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Works while you drive normally</span>
          </div>
          <div class="benefit-item">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Continuously improves over time</span>
          </div>
          <div class="benefit-item">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Perfect for heavy vehicles</span>
          </div>
        </div>

        <div v-if="!isLearning" class="setup-instructions">
          <h4>To Get Started:</h4>
          <ol>
            <li>Enable auto-learn mode</li>
            <li>Drive your vehicle for at least 5 minutes</li>
            <li>Make several wide turns in different directions</li>
            <li>The system will automatically save corrections when ready</li>
          </ol>
        </div>

        <div v-else class="learning-status">
          <h4>Learning in Progress</h4>
          <p>Drive through varied maneuvers (turns, circles) for best results</p>

          <div class="quality-indicator">
            <div class="quality-bar">
              <div class="quality-fill" :style="{ width: `${compassQuality}%` }"></div>
            </div>
            <div class="quality-label">Quality: {{ compassQuality }}%</div>
          </div>

          <div class="interference-status" :class="interferenceLevel">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <span>Interference: {{ interferenceLevel.toUpperCase() }}</span>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button v-if="!isLearning" class="btn btn-primary" @click="startAutoLearn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Enable Auto-Learn
        </button>
        <button v-else class="btn btn-secondary" @click="stopAutoLearn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="6" width="12" height="12"/>
          </svg>
          Disable Auto-Learn
        </button>
      </div>
    </div>

    <!-- Expert Mode View -->
    <div v-else class="expert-view">
      <div class="mode-selection">
        <h4>COMPASS_LEARN Mode:</h4>
        <div class="mode-options">
          <label class="mode-option">
            <input v-model="learnMode" type="radio" :value="1" name="learn-mode" />
            <div class="option-content">
              <div class="option-title">Internal Only (1)</div>
              <div class="option-description">Learn offsets for internal compass only</div>
            </div>
          </label>

          <label class="mode-option">
            <input v-model="learnMode" type="radio" :value="2" name="learn-mode" />
            <div class="option-content">
              <div class="option-title">External Only (2)</div>
              <div class="option-description">Learn offsets for external compass only</div>
            </div>
          </label>

          <label class="mode-option">
            <input v-model="learnMode" type="radio" :value="3" name="learn-mode" />
            <div class="option-content">
              <div class="option-title">Both Compasses (3)</div>
              <div class="option-description">Learn offsets for all compasses (recommended)</div>
            </div>
          </label>
        </div>
      </div>

      <div class="status-panel">
        <h4>Current Status</h4>
        <div class="status-grid">
          <div class="status-item">
            <label>Auto-Learn:</label>
            <span :class="{ active: isLearning }">{{ isLearning ? 'ACTIVE' : 'INACTIVE' }}</span>
          </div>
          <div class="status-item">
            <label>Quality:</label>
            <span>{{ compassQuality }}%</span>
          </div>
          <div class="status-item">
            <label>Interference:</label>
            <span>{{ interferenceLevel.toUpperCase() }}</span>
          </div>
        </div>
      </div>

      <div class="expert-controls">
        <button v-if="!isLearning" class="btn btn-primary" @click="startAutoLearn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Enable Auto-Learn (Mode {{ learnMode }})
        </button>
        <button v-else class="btn btn-danger" @click="stopAutoLearn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Disable Auto-Learn
        </button>
      </div>

      <div class="technical-info">
        <h4>Technical Details</h4>
        <ul>
          <li><strong>COMPASS_LEARN Parameter:</strong> Enables automatic compass offset learning</li>
          <li><strong>Learning Algorithm:</strong> Uses GPS and attitude data to determine true heading</li>
          <li><strong>Convergence:</strong> Requires varied maneuvers (turns, figure-8s) for accurate results</li>
          <li><strong>Auto-Save:</strong> Offsets automatically saved when quality threshold met</li>
          <li><strong>Auto-Disable:</strong> Parameter resets to 0 after successful learning</li>
          <li><strong>Requirements:</strong> GPS lock and vehicle movement required</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.auto-learn-calibration {
  @include card;
  padding: var(--spacing-xl);
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

    &.active {
      background: var(--primary-green);
      color: white;
      animation: pulse 2s infinite;
    }
  }
}

.consumer-view {
  .info-panel {
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    p {
      margin: 0 0 var(--spacing-lg) 0;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .benefits-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);

      .benefit-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--text-primary);

        svg {
          width: 20px;
          height: 20px;
          color: var(--status-success);
          flex-shrink: 0;
        }
      }
    }

    .setup-instructions {
      ol {
        margin: 0;
        padding-left: var(--spacing-xl);
        color: var(--text-secondary);

        li {
          margin-bottom: var(--spacing-sm);
        }
      }
    }

    .learning-status {
      p {
        color: var(--primary-green);
        font-weight: 500;
      }

      .quality-indicator {
        margin: var(--spacing-lg) 0;

        .quality-bar {
          height: 24px;
          background: var(--bg-primary);
          border-radius: var(--border-radius);
          overflow: hidden;
          margin-bottom: var(--spacing-sm);

          .quality-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--status-warning) 0%, var(--primary-green) 50%, var(--status-success) 100%);
            transition: width 0.5s ease;
          }
        }

        .quality-label {
          text-align: center;
          color: var(--text-secondary);
          font-weight: 600;
        }
      }

      .interference-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        border-radius: var(--border-radius);
        font-weight: 600;

        svg {
          width: 20px;
          height: 20px;
        }

        &.low {
          background: rgba(34, 197, 94, 0.1);
          color: var(--status-success);
        }

        &.medium {
          background: rgba(251, 191, 36, 0.1);
          color: var(--status-warning);
        }

        &.high {
          background: rgba(239, 68, 68, 0.1);
          color: var(--status-danger);
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
  }
}

.expert-view {
  .mode-selection {
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    .mode-options {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);

      .mode-option {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-md);
        padding: var(--spacing-lg);
        background: var(--bg-secondary);
        border: 2px solid var(--border-color);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: var(--primary-green);
        }

        input[type="radio"] {
          margin-top: 2px;
        }

        input[type="radio"]:checked ~ .option-content {
          .option-title {
            color: var(--primary-green);
          }
        }

        .option-content {
          flex: 1;

          .option-title {
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: var(--spacing-xs);
          }

          .option-description {
            font-size: var(--font-size-sm);
            color: var(--text-secondary);
          }
        }
      }
    }
  }

  .status-panel {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-xl);

    h4 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-primary);
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--spacing-md);

      .status-item {
        display: flex;
        justify-content: space-between;
        align-items: center;

        label {
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
        }

        span {
          font-weight: 600;
          color: var(--text-primary);

          &.active {
            color: var(--status-success);
          }
        }
      }
    }
  }

  .expert-controls {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .technical-info {
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
        margin-bottom: var(--spacing-sm);

        &:last-child {
          margin-bottom: 0;
        }

        strong {
          color: var(--text-primary);
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
