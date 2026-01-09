<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalibrationStore } from '@/stores/calibration'
import { useRTCMStore } from '@/stores/rtcm'
import Card from '@/components/common/Card.vue'
import ConsumerCalibrationStep from '@/components/consumer/ConsumerCalibrationStep.vue'
import ConsumerGPSBoostStep from '@/components/consumer/ConsumerGPSBoostStep.vue'
import Modal from '@/components/common/Modal.vue'

const calibrationStore = useCalibrationStore()
const rtcmStore = useRTCMStore()

const showCalibrationWizard = ref(false)
const showGPSBoostWizard = ref(false)

// Calibration status
const calibrationStatus = computed(() => {
  if (calibrationStore.needsCalibration) {
    return {
      state: 'warning',
      icon: '⚠️',
      label: 'Needs Attention',
      message: 'Some sensors need to be checked',
      color: 'var(--status-warning)'
    }
  }

  const health = calibrationStore.overallHealth
  if (health >= 80) {
    return {
      state: 'success',
      icon: '✓',
      label: 'All Good',
      message: 'Everything is working perfectly',
      color: 'var(--status-success)'
    }
  } else if (health >= 60) {
    return {
      state: 'info',
      icon: 'ℹ️',
      label: 'Good',
      message: 'Minor adjustments may improve performance',
      color: 'var(--status-info)'
    }
  } else {
    return {
      state: 'warning',
      icon: '⚠️',
      label: 'Recalibration Recommended',
      message: 'Sensors could use recalibration',
      color: 'var(--status-warning)'
    }
  }
})

// GPS Boost status
const gpsBoostStatus = computed(() => {
  if (rtcmStore.isConnected) {
    return {
      state: 'success',
      icon: '✓',
      label: 'Connected',
      message: `Pinpoint accuracy active`,
      color: 'var(--status-success)'
    }
  } else if (rtcmStore.currentState === 'connecting') {
    return {
      state: 'info',
      icon: '🔄',
      label: 'Connecting',
      message: 'Connecting to GPS Booster...',
      color: 'var(--status-info)'
    }
  } else if (rtcmStore.hasError) {
    return {
      state: 'error',
      icon: '❌',
      label: 'Disconnected',
      message: 'GPS Booster connection failed',
      color: 'var(--status-danger)'
    }
  } else {
    return {
      state: 'warning',
      icon: '📡',
      label: 'Not Configured',
      message: 'Set up GPS Boost for better accuracy',
      color: 'var(--text-secondary)'
    }
  }
})

function openCalibrationWizard() {
  showCalibrationWizard.value = true
}

function openGPSBoostWizard() {
  showGPSBoostWizard.value = true
}

function handleCalibrationComplete() {
  showCalibrationWizard.value = false
}

function handleGPSBoostComplete() {
  showGPSBoostWizard.value = false
}
</script>

<template>
  <div class="setup-quick-access">
    <h3 class="section-title">Technical Setup</h3>
    <p class="section-description">
      Configure your YardRover's sensors and GPS for optimal performance
    </p>

    <div class="cards-grid">
      <!-- Setup Check Card -->
      <Card class="setup-card">
        <div class="card-header">
          <div class="card-icon">📏</div>
          <div class="card-title-section">
            <h4 class="card-title">Setup Check</h4>
            <p class="card-subtitle">Sensor calibration for accurate navigation</p>
          </div>
        </div>

        <div class="card-content">
          <div class="status-section">
            <div class="status-badge" :style="{ '--badge-color': calibrationStatus.color }">
              <span class="status-icon">{{ calibrationStatus.icon }}</span>
              <span class="status-label">{{ calibrationStatus.label }}</span>
            </div>
            <p class="status-message">{{ calibrationStatus.message }}</p>
          </div>

          <div class="info-list">
            <div class="info-item">
              <span class="info-icon">🎯</span>
              <span class="info-text">Ensures accurate positioning</span>
            </div>
            <div class="info-item">
              <span class="info-icon">⏱️</span>
              <span class="info-text">Takes about 3 minutes</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button
            class="btn"
            :class="calibrationStatus.state === 'warning' ? 'btn-primary' : 'btn-outline'"
            @click="openCalibrationWizard"
          >
            {{ calibrationStore.needsCalibration ? 'Run Setup' : 'View Setup' }}
          </button>
        </div>
      </Card>

      <!-- GPS Boost Card -->
      <Card class="setup-card">
        <div class="card-header">
          <div class="card-icon">🛰️</div>
          <div class="card-title-section">
            <h4 class="card-title">GPS Boost</h4>
            <p class="card-subtitle">Pinpoint accuracy for precision work</p>
          </div>
        </div>

        <div class="card-content">
          <div class="status-section">
            <div class="status-badge" :style="{ '--badge-color': gpsBoostStatus.color }">
              <span class="status-icon">{{ gpsBoostStatus.icon }}</span>
              <span class="status-label">{{ gpsBoostStatus.label }}</span>
            </div>
            <p class="status-message">{{ gpsBoostStatus.message }}</p>
          </div>

          <div class="info-list">
            <div class="info-item">
              <span class="info-icon">📍</span>
              <span class="info-text">2cm accuracy (vs 2-5m standard)</span>
            </div>
            <div class="info-item">
              <span class="info-icon">✨</span>
              <span class="info-text">Perfect for complex patterns</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button
            class="btn"
            :class="!rtcmStore.isConnected ? 'btn-primary' : 'btn-outline'"
            @click="openGPSBoostWizard"
          >
            {{ rtcmStore.isConnected ? 'Reconfigure' : 'Configure' }}
          </button>
        </div>
      </Card>
    </div>

    <!-- Calibration Wizard Modal -->
    <Modal
      v-model="showCalibrationWizard"
      title="Setup Check"
      size="lg"
      :close-on-backdrop="false"
    >
      <ConsumerCalibrationStep
        :model-value="true"
        @complete="handleCalibrationComplete"
        @skip="handleCalibrationComplete"
      />
    </Modal>

    <!-- GPS Boost Wizard Modal -->
    <Modal
      v-model="showGPSBoostWizard"
      title="GPS Boost"
      size="lg"
      :close-on-backdrop="false"
    >
      <ConsumerGPSBoostStep
        :model-value="true"
        @complete="handleGPSBoostComplete"
        @skip="handleGPSBoostComplete"
      />
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.setup-quick-access {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.section-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xl);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.setup-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.card-icon {
  font-size: 48px;
  line-height: 1;
  flex-shrink: 0;
}

.card-title-section {
  flex: 1;
}

.card-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.card-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(0, 0, 0, 0.05);
  border: 2px solid var(--badge-color);
  border-radius: var(--radius-full);
  width: fit-content;
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--badge-color);
}

.status-icon {
  font-size: 16px;
  line-height: 1;
}

.status-label {
  line-height: 1;
}

.status-message {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.info-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.info-text {
  line-height: 1.4;
}

.card-footer {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: stretch;

  .btn {
    width: 100%;
  }
}

// Mobile responsive
@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
