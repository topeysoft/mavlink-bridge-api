<script setup lang="ts">
import { computed } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import { useConnectionStore } from '@/stores/connection'
import CalibrationWizard from '@/components/calibration/CalibrationWizard.vue'
import ExpertCalibrationPanel from '@/components/calibration/ExpertCalibrationPanel.vue'

const calibrationStore = useCalibrationStore()
const connectionStore = useConnectionStore()

const uiMode = computed(() => calibrationStore.uiMode)
const isConnected = computed(() => connectionStore.isConnected)
const overallHealth = computed(() => calibrationStore.overallHealth)
const needsCalibration = computed(() => calibrationStore.needsCalibration)

function toggleMode() {
  const newMode = uiMode.value === 'consumer' ? 'expert' : 'consumer'
  calibrationStore.setUIMode(newMode)
}

function getHealthColor(health: number): string {
  if (health >= 80) return 'var(--status-success)'
  if (health >= 60) return 'var(--primary-green)'
  if (health >= 40) return 'var(--status-warning)'
  return 'var(--status-danger)'
}
</script>

<template>
  <div class="calibration-view">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <svg viewBox="0 0 24 24" fill="currentColor" class="title-icon">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Calibration
        </h1>
        <p class="page-subtitle">
          {{ uiMode === 'consumer' ? 'Step-by-step calibration wizard' : 'Advanced calibration controls' }}
        </p>

        <!-- Health indicator -->
        <div class="health-indicator">
          <div class="health-badge" :style="{ '--health-color': getHealthColor(overallHealth) }">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>{{ overallHealth }}% Health</span>
          </div>
          <div v-if="needsCalibration" class="warning-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <span>Needs Calibration</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <!-- Mode toggle -->
        <button class="mode-toggle" @click="toggleMode">
          <svg v-if="uiMode === 'consumer'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5H2v7h7V5zM22 5h-7v7h7V5zM9 17H2v7h7v-7zM22 17h-7v7h7v-7z"/>
          </svg>
          <span>{{ uiMode === 'consumer' ? 'Switch to Expert Mode' : 'Switch to Consumer Mode' }}</span>
        </button>
      </div>
    </div>

    <!-- Connection warning -->
    <div v-if="!isConnected" class="connection-warning">
      <svg viewBox="0 0 24 24" fill="currentColor" class="warning-icon">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
      <div class="warning-content">
        <h3>Not Connected to Vehicle</h3>
        <p>Please connect to your vehicle before starting calibration</p>
        <router-link to="/connect" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
          Go to Connection Page
        </router-link>
      </div>
    </div>

    <!-- Calibration content -->
    <div v-else class="calibration-content">
      <!-- Consumer Mode - Wizard -->
      <CalibrationWizard v-if="uiMode === 'consumer'" />

      <!-- Expert Mode - Panel -->
      <ExpertCalibrationPanel v-else />
    </div>

    <!-- Help section -->
    <div v-if="isConnected" class="help-section">
      <h3>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
        </svg>
        Calibration Tips
      </h3>
      <ul class="tips-list">
        <li>Always calibrate in an open area away from metal objects and electromagnetic interference</li>
        <li>Ensure the vehicle is powered on and stable before starting any calibration</li>
        <li>Follow the on-screen instructions carefully for each sensor</li>
        <li>Re-calibrate if you notice unusual behavior or after hardware changes</li>
        <li>Level calibration should be done first, followed by gyro and compass</li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.calibration-view {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-2xl);
  gap: var(--spacing-xl);

  @media (max-width: 768px) {
    flex-direction: column;
  }

  .header-content {
    flex: 1;

    .page-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-size-2xl);
      font-weight: 600;
      color: var(--primary-green);

      .title-icon {
        width: 36px;
        height: 36px;
      }
    }

    .page-subtitle {
      margin: 0 0 var(--spacing-lg) 0;
      color: var(--text-secondary);
      font-size: var(--font-size-base);
    }

    .health-indicator {
      display: flex;
      gap: var(--spacing-md);
      flex-wrap: wrap;

      .health-badge,
      .warning-badge {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-lg);
        border-radius: var(--border-radius);
        font-size: var(--font-size-sm);
        font-weight: 600;

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .health-badge {
        background: rgba(44, 95, 45, 0.1);
        color: var(--health-color);
        border: 2px solid var(--health-color);

        svg {
          color: var(--health-color);
        }
      }

      .warning-badge {
        background: rgba(251, 191, 36, 0.1);
        color: var(--status-warning);
        border: 2px solid var(--status-warning);

        svg {
          color: var(--status-warning);
        }
      }
    }
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--bg-primary);
    border: 2px solid var(--primary-green);
    border-radius: var(--border-radius);
    color: var(--primary-green);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--primary-green);
      color: white;
    }
  }
}

.connection-warning {
  @include card;
  padding: var(--spacing-2xl);
  text-align: center;
  background: rgba(251, 191, 36, 0.05);
  border: 2px solid var(--status-warning);

  .warning-icon {
    width: 64px;
    height: 64px;
    color: var(--status-warning);
    margin-bottom: var(--spacing-lg);
  }

  .warning-content {
    h3 {
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--text-primary);
      font-size: var(--font-size-xl);
    }

    p {
      margin: 0 0 var(--spacing-xl) 0;
      color: var(--text-secondary);
      font-size: var(--font-size-base);
    }
  }
}

.calibration-content {
  margin-bottom: var(--spacing-2xl);
}

.help-section {
  @include card;
  padding: var(--spacing-xl);
  background: rgba(44, 95, 45, 0.05);

  h3 {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--primary-green);
    font-size: var(--font-size-lg);

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .tips-list {
    margin: 0;
    padding-left: var(--spacing-xl);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: 1.8;

    li {
      margin-bottom: var(--spacing-sm);

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
