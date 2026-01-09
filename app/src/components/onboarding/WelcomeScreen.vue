<script setup lang="ts">
import { ref } from 'vue'
import type { UserType } from '@/stores/onboarding'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'select': [userType: UserType]
}>()

const selectedMode = ref<UserType>(null)

function selectMode(mode: UserType) {
  selectedMode.value = mode
}

function continue_() {
  if (selectedMode.value) {
    emit('select', selectedMode.value)
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <div v-if="modelValue" class="welcome-screen">
    <div class="welcome-overlay">
      <div class="welcome-card">
        <!-- Header -->
        <div class="welcome-header">
          <div class="welcome-logo">
            <div class="logo-icon">🚜</div>
            <h1>Welcome to YardRover!</h1>
          </div>
          <p class="welcome-subtitle">
            Your autonomous yard assistant is ready for setup. Let's get started!
          </p>
        </div>

        <!-- Content -->
        <div class="welcome-content">
          <h2>Choose Your Experience</h2>
          <p class="description">
            Select the interface that best matches your comfort level. You can change this anytime in Settings.
          </p>

          <div class="mode-options">
            <!-- Consumer Mode -->
            <button
              class="mode-option"
              :class="{ selected: selectedMode === 'consumer' }"
              @click="selectMode('consumer')"
            >
              <div class="mode-icon">🏡</div>
              <div class="mode-info">
                <h3>Simple Mode</h3>
                <span class="mode-badge recommended">Recommended</span>
                <p>Easy interface designed for homeowners. No technical jargon, just straightforward controls.</p>
                <ul class="mode-features">
                  <li>✓ Large, friendly buttons</li>
                  <li>✓ Step-by-step wizards</li>
                  <li>✓ Plain language (no technical terms)</li>
                  <li>✓ Guided task creation</li>
                </ul>
              </div>
              <div class="mode-check">
                <svg v-if="selectedMode === 'consumer'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            </button>

            <!-- Technical Mode -->
            <button
              class="mode-option"
              :class="{ selected: selectedMode === 'technical' }"
              @click="selectMode('technical')"
            >
              <div class="mode-icon">⚙️</div>
              <div class="mode-info">
                <h3>Advanced Mode</h3>
                <span class="mode-badge">For Power Users</span>
                <p>Full control and detailed monitoring for experienced operators and technical users.</p>
                <ul class="mode-features">
                  <li>✓ Complete system access</li>
                  <li>✓ Real-time telemetry</li>
                  <li>✓ Advanced parameters</li>
                  <li>✓ Detailed diagnostics</li>
                </ul>
              </div>
              <div class="mode-check">
                <svg v-if="selectedMode === 'technical'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            </button>
          </div>

          <div class="welcome-note">
            <div class="note-icon">💡</div>
            <p>
              <strong>First time with YardRover?</strong> We recommend starting with Simple Mode.
              You can always switch to Advanced Mode later from Settings.
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="welcome-actions">
          <button
            class="btn-continue"
            :disabled="!selectedMode"
            @click="continue_"
          >
            Continue with {{ selectedMode === 'consumer' ? 'Simple' : 'Advanced' }} Mode →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;
@use 'sass:color';

.welcome-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.welcome-overlay {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba($primary, 0.95) 0%, rgba($secondary, 0.9) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  animation: fade-in 0.4s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.welcome-card {
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.4);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slide-up 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-header {
  background: linear-gradient(135deg, $primary 0%, color.adjust($primary, $lightness: -10%) 100%);
  color: white;
  padding: var(--spacing-2xl);
  text-align: center;
  border-radius: 24px 24px 0 0;
}

.welcome-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);

  .logo-icon {
    font-size: 80px;
    line-height: 1;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
    animation: bounce 1s ease-in-out;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    margin: 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.welcome-subtitle {
  margin: var(--spacing-md) 0 0;
  font-size: var(--font-size-lg);
  opacity: 0.95;
  font-weight: 400;
  line-height: 1.6;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.welcome-content {
  padding: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-sm);
    text-align: center;
  }

  > .description {
    text-align: center;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    margin: 0 0 var(--spacing-2xl);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border: 3px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba($primary, 0.05) 0%, transparent 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    border-color: rgba($primary, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);

    &::before {
      opacity: 1;
    }
  }

  &.selected {
    border-color: $primary;
    background: var(--bg-primary);
    box-shadow: 0 8px 24px rgba($primary, 0.2);

    &::before {
      opacity: 1;
    }
  }
}

.mode-icon {
  font-size: 48px;
  line-height: 1;
  flex-shrink: 0;
  animation: pop-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes pop-in {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

.mode-info {
  flex: 1;

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-xs);
  }

  > p {
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: 1.6;
    margin: var(--spacing-sm) 0;
  }
}

.mode-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);

  &.recommended {
    background: $positive;
    color: white;
  }
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: var(--spacing-md) 0 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xs);

  li {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.mode-check {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;

  svg {
    width: 20px;
    height: 20px;
    color: white;
  }
}

.mode-option.selected .mode-check {
  background: $primary;
  border-color: $primary;
  transform: scale(1.1);
}

.welcome-note {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);

  .note-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    line-height: 1.6;

    strong {
      font-weight: 700;
      color: var(--text-primary);
    }
  }
}

.welcome-actions {
  padding: var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: center;
}

.btn-continue {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: $primary;
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-lg);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 300px;

  &:hover:not(:disabled) {
    background: color.adjust($primary, $lightness: -10%);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba($primary, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: var(--bg-tertiary);
    color: var(--text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

// Responsive
@include mobile {
  .welcome-card {
    max-height: 100vh;
    border-radius: 0;
  }

  .welcome-header {
    padding: var(--spacing-xl);
    border-radius: 0;

    .logo-icon {
      font-size: 64px;
    }

    h1 {
      font-size: 2rem;
    }
  }

  .welcome-subtitle {
    font-size: var(--font-size-base);
  }

  .welcome-content {
    padding: var(--spacing-xl);

    h2 {
      font-size: var(--font-size-xl);
    }
  }

  .mode-option {
    flex-direction: column;
    padding: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  .mode-icon {
    font-size: 40px;
  }

  .mode-features {
    grid-template-columns: 1fr;
  }

  .mode-check {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
  }

  .btn-continue {
    min-width: 100%;
    font-size: var(--font-size-base);
  }
}

@media (max-width: 480px) {
  .welcome-overlay {
    padding: 0;
  }
}
</style>
