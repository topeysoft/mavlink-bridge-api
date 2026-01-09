<script setup lang="ts">
import { ref } from 'vue'
import type { UserType } from '@/stores/onboarding'
import ConsumerGPSBoostStep from '@/components/consumer/ConsumerGPSBoostStep.vue'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
  'skip': []
}>()

const showGPSBoost = ref(true)

function handleComplete() {
  emit('complete')
}

function handleSkip() {
  emit('skip')
}
</script>

<template>
  <div class="gps-boost-step">
    <div v-if="props.userType === 'consumer'" class="step-container">
      <ConsumerGPSBoostStep
        v-model="showGPSBoost"
        @complete="handleComplete"
        @skip="handleSkip"
      />
    </div>
    <div v-else class="step-container technical">
      <div class="step-header">
        <h2>RTK/GPS Setup (Optional)</h2>
        <p class="step-description">
          Configure RTK corrections for centimeter-level GPS accuracy
        </p>
      </div>

      <div class="option-content">
        <div class="option-icon">🛰️</div>
        <h3>Enhanced GPS Accuracy</h3>
        <p>
          RTK (Real-Time Kinematic) corrections can improve GPS accuracy from meters to centimeters.
          This requires either a local RTK base station or an NTRIP service subscription.
        </p>

        <div class="action-buttons">
          <button class="btn btn-primary" @click="handleComplete">
            Configure RTK
          </button>
          <button class="btn btn-outline" @click="handleSkip">
            Skip for Now
          </button>
        </div>

        <div class="help-note">
          <span class="note-icon">💡</span>
          <span>RTK can be configured later from the Settings page</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.gps-boost-step {
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
