<script setup lang="ts">
import { ref } from 'vue'
import type { UserType } from '@/stores/onboarding'
import ConsumerCalibrationStep from '@/components/consumer/ConsumerCalibrationStep.vue'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
  'skip': []
}>()

const showCalibration = ref(true)

function handleComplete() {
  emit('complete')
}

function handleSkip() {
  emit('skip')
}
</script>

<template>
  <div class="calibration-step">
    <div v-if="props.userType === 'consumer'" class="step-container">
      <ConsumerCalibrationStep
        v-model="showCalibration"
        @complete="handleComplete"
        @skip="handleSkip"
      />
    </div>
    <div v-else class="step-container technical">
      <div class="step-header">
        <h2>Calibration (Optional)</h2>
        <p class="step-description">
          Calibrate sensors and compass for optimal performance
        </p>
      </div>

      <div class="option-content">
        <div class="option-icon">📏</div>
        <h3>Sensor Calibration</h3>
        <p>
          Calibrating your device's sensors ensures accurate navigation and positioning.
          This typically takes 5-10 minutes and involves moving the device through specific orientations.
        </p>

        <div class="action-buttons">
          <button class="btn btn-primary" @click="handleComplete">
            Start Calibration
          </button>
          <button class="btn btn-outline" @click="handleSkip">
            Skip for Now
          </button>
        </div>

        <div class="help-note">
          <span class="note-icon">💡</span>
          <span>You can calibrate later from the Settings page</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.calibration-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
}

.step-container {
  max-width: 600px;
  margin: 0 auto;
}

.step-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  .step-description {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
  }
}

.option-content {
  text-align: center;

  .option-icon {
    font-size: 64px;
    margin-bottom: var(--spacing-lg);
  }

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  p {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 var(--spacing-2xl);
  }
}

.action-buttons {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  .btn {
    flex: 1;
  }
}

.help-note {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);

  .note-icon {
    font-size: 18px;
  }
}
</style>
