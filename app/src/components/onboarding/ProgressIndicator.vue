<script setup lang="ts">
import { computed } from 'vue'
import type { OnboardingStep } from '@/stores/onboarding'

interface Props {
  steps: OnboardingStep[]
  currentStepId: string
  variant?: 'dots' | 'line' | 'numbered'
  showLabels?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'line',
  showLabels: true
})

const currentStepIndex = computed(() => {
  return props.steps.findIndex(s => s.id === props.currentStepId)
})

function isStepActive(index: number): boolean {
  return index === currentStepIndex.value
}

function isStepCompleted(index: number): boolean {
  return index < currentStepIndex.value || props.steps[index].completed
}

function getStepStatus(step: OnboardingStep, index: number): 'completed' | 'active' | 'pending' | 'skipped' {
  if (step.skipped) return 'skipped'
  if (step.completed || isStepCompleted(index)) return 'completed'
  if (isStepActive(index)) return 'active'
  return 'pending'
}
</script>

<template>
  <div class="progress-indicator" :class="`variant-${variant}`">
    <!-- Dots Variant -->
    <template v-if="variant === 'dots'">
      <div class="dots-container">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="progress-dot"
          :class="getStepStatus(step, index)"
          :title="step.label"
        ></div>
      </div>
    </template>

    <!-- Line Variant (Default) -->
    <template v-else-if="variant === 'line'">
      <div class="line-container">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="step-item"
          :class="getStepStatus(step, index)"
        >
          <!-- Step Circle -->
          <div class="step-circle">
            <span v-if="getStepStatus(step, index) === 'completed'" class="step-icon">✓</span>
            <span v-else-if="getStepStatus(step, index) === 'skipped'" class="step-icon">−</span>
            <span v-else class="step-number">{{ index + 1 }}</span>
          </div>

          <!-- Connector Line -->
          <div v-if="index < steps.length - 1" class="step-connector" :class="getStepStatus(step, index)"></div>

          <!-- Label -->
          <div v-if="showLabels" class="step-label">
            {{ step.label }}
            <span v-if="step.optional" class="optional-badge">(Optional)</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Numbered Variant -->
    <template v-else-if="variant === 'numbered'">
      <div class="numbered-container">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="numbered-step"
          :class="getStepStatus(step, index)"
        >
          <div class="numbered-circle">
            <span v-if="getStepStatus(step, index) === 'completed'">✓</span>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div v-if="showLabels" class="numbered-label">{{ step.label }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.progress-indicator {
  width: 100%;
}

// Dots Variant
.variant-dots {
  .dots-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) 0;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.active {
      width: 24px;
      border-radius: 4px;
      background: $primary;
      box-shadow: 0 0 0 4px rgba($primary, 0.2);
    }

    &.completed {
      background: $positive;
      transform: scale(1.1);
    }

    &.skipped {
      background: var(--text-light);
      opacity: 0.5;
    }
  }
}

// Line Variant
.variant-line {
  .line-container {
    display: flex;
    align-items: flex-start;
    position: relative;
  }

  .step-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;

    &:last-child {
      flex: 0;
    }
  }

  .step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: var(--font-size-base);
    background: var(--bg-secondary);
    border: 3px solid var(--border-color);
    color: var(--text-light);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 2;
    position: relative;

    .step-icon {
      font-size: 18px;
    }

    .step-number {
      font-size: 16px;
    }
  }

  .step-item.active .step-circle {
    background: $primary;
    border-color: $primary;
    color: white;
    box-shadow: 0 0 0 6px rgba($primary, 0.2);
    transform: scale(1.1);
  }

  .step-item.completed .step-circle {
    background: $positive;
    border-color: $positive;
    color: white;
  }

  .step-item.skipped .step-circle {
    background: var(--bg-tertiary);
    border-color: var(--border-color);
    color: var(--text-light);
    opacity: 0.6;
  }

  .step-connector {
    position: absolute;
    top: 20px;
    left: 40px;
    right: calc(-100% + 40px);
    height: 3px;
    background: var(--border-color);
    transition: background 0.3s ease;
    z-index: 1;
  }

  .step-item.completed .step-connector,
  .step-item.active .step-connector {
    background: $positive;
  }

  .step-item.skipped .step-connector {
    background: var(--border-color);
    opacity: 0.4;
  }

  .step-label {
    margin-top: var(--spacing-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    text-align: center;
    max-width: 120px;
    line-height: 1.3;
    transition: color 0.3s ease;
  }

  .step-item.active .step-label {
    color: $primary;
    font-weight: 700;
  }

  .step-item.completed .step-label {
    color: var(--text-primary);
  }

  .step-item.skipped .step-label {
    color: var(--text-light);
    opacity: 0.6;
    text-decoration: line-through;
  }

  .optional-badge {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--text-light);
    margin-top: 2px;
  }
}

// Numbered Variant
.variant-numbered {
  .numbered-container {
    display: flex;
    gap: var(--spacing-lg);
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .numbered-step {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .numbered-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    color: var(--text-light);
    transition: all 0.3s ease;
  }

  .numbered-step.active .numbered-circle {
    background: $primary;
    border-color: $primary;
    color: white;
    box-shadow: 0 0 0 4px rgba($primary, 0.2);
  }

  .numbered-step.completed .numbered-circle {
    background: $positive;
    border-color: $positive;
    color: white;
  }

  .numbered-step.skipped .numbered-circle {
    background: var(--bg-tertiary);
    opacity: 0.5;
  }

  .numbered-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .numbered-step.active .numbered-label {
    color: $primary;
    font-weight: 700;
  }

  .numbered-step.completed .numbered-label {
    color: var(--text-primary);
  }

  .numbered-step.skipped .numbered-label {
    color: var(--text-light);
    text-decoration: line-through;
    opacity: 0.6;
  }
}

// Responsive
@include mobile {
  .variant-line {
    .step-label {
      font-size: var(--font-size-xs);
      max-width: 80px;
    }

    .step-circle {
      width: 32px;
      height: 32px;
      font-size: var(--font-size-sm);

      .step-icon {
        font-size: 14px;
      }
    }

    .step-connector {
      top: 16px;
      left: 32px;
      right: calc(-100% + 32px);
      height: 2px;
    }

    .optional-badge {
      display: none;
    }
  }

  .variant-numbered {
    .numbered-container {
      gap: var(--spacing-sm);
    }

    .numbered-circle {
      width: 28px;
      height: 28px;
      font-size: var(--font-size-sm);
    }

    .numbered-label {
      display: none;
    }
  }
}
</style>
