<script setup lang="ts">
import { computed } from 'vue'
import type { UserType } from '@/stores/onboarding'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'continue': []
}>()

const isConsumerMode = computed(() => props.userType === 'consumer')
</script>

<template>
  <div class="completion-step">
    <div class="step-container">
      <div class="completion-content">
        <div class="celebration-icon">🎉</div>
        
        <h2>{{ isConsumerMode ? 'You\'re All Set!' : 'Setup Complete!' }}</h2>
        
        <p class="completion-message">
          {{ isConsumerMode
            ? 'Your YardRover is ready to go! Let\'s create your first job.'
            : 'Your device is fully configured and ready for operation.'
          }}
        </p>

        <div class="features-summary">
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span class="feature-text">{{ isConsumerMode ? 'Connected to your YardRover' : 'Device connected' }}</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span class="feature-text">{{ isConsumerMode ? 'Security key created' : 'Authentication configured' }}</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span class="feature-text">{{ isConsumerMode ? 'Device named and configured' : 'Device configuration complete' }}</span>
          </div>
        </div>

        <div v-if="isConsumerMode" class="quick-tips">
          <h3>Quick Tips to Get Started:</h3>
          <ul>
            <li><strong>Create Your First Job:</strong> Use the "Start a Job" card on your dashboard</li>
            <li><strong>Set Up Areas:</strong> Define where your YardRover should work</li>
            <li><strong>Emergency Stop:</strong> The stop button is always available in the top bar</li>
          </ul>
        </div>

        <button class="btn btn-primary btn-large" @click="emit('continue')">
          {{ isConsumerMode ? 'Go to Dashboard' : 'Enter Dashboard' }}
        </button>

        <div class="help-note">
          <span class="note-icon">💡</span>
          <span>{{ isConsumerMode 
            ? 'Need help? Check the help icon (?) in the top right corner anytime'
            : 'Access documentation and settings from the sidebar menu'
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.completion-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-container {
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.completion-content {
  text-align: center;
}

.celebration-icon {
  font-size: 120px;
  line-height: 1;
  margin-bottom: var(--spacing-xl);
  animation: celebrate 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes celebrate {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

h2 {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: $positive;
  margin: 0 0 var(--spacing-md);
}

.completion-message {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 var(--spacing-2xl);
}

.features-summary {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.feature-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
  text-align: left;

  .feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: $positive;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }

  .feature-text {
    font-size: var(--font-size-base);
    color: var(--text-primary);
    font-weight: 500;
  }
}

.quick-tips {
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
  text-align: left;

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
      margin-bottom: var(--spacing-sm);
      padding-left: var(--spacing-md);
      position: relative;

      &::before {
        content: '•';
        position: absolute;
        left: 0;
        color: $primary;
        font-weight: 700;
      }

      strong {
        color: var(--text-primary);
        font-weight: 600;
      }
    }
  }
}

.btn-large {
  width: 100%;
  padding: var(--spacing-lg);
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-lg);
}

.help-note {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);

  .note-icon {
    font-size: 20px;
  }
}

// Responsive
@media (max-width: 768px) {
  .completion-step {
    padding: var(--spacing-lg);
  }

  .celebration-icon {
    font-size: 96px;
  }

  h2 {
    font-size: var(--font-size-2xl);
  }

  .completion-message {
    font-size: var(--font-size-base);
  }
}
</style>
