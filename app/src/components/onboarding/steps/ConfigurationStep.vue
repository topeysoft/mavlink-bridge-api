<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import type { UserType } from '@/stores/onboarding'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
}>()

const authStore = useAuthStore()
const connectionStore = useConnectionStore()

const deviceName = ref('YardRover')
const adminKeyName = ref('Owner')
const isSubmitting = ref(false)
const setupError = ref<string | null>(null)
const generatedApiKey = ref('')
const currentView = ref<'form' | 'success'>('form')
const copied = ref(false)

const isConsumerMode = computed(() => props.userType === 'consumer')

onMounted(() => {
  // Check if we're actually in setup mode
  if (!authStore.needsSetup && authStore.isAuthenticated) {
    // Already configured, skip this step
    emit('complete')
  }
})

async function handleSetup() {
  if (!deviceName.value.trim()) return

  if (!connectionStore.client) {
    setupError.value = 'No device connected. Please go back and reconnect.'
    return
  }

  isSubmitting.value = true
  setupError.value = null

  try {
    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    const apiKey = await authStore.completeSetup(authClient, {
      device_name: deviceName.value.trim(),
      admin_key_name: adminKeyName.value.trim() || 'Owner',
      admin_key_description: 'Owner admin key created during initial setup',
    })

    generatedApiKey.value = apiKey
    currentView.value = 'success'

  } catch (error: any) {
    console.error('Setup failed:', error)

    if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      setupError.value = isConsumerMode.value
        ? 'Connection problem. Please check your connection and try again.'
        : 'Network error. Please verify connection and retry.'
    } else if (error?.message?.includes('already configured') || error?.message?.includes('not in setup mode')) {
      setupError.value = isConsumerMode.value
        ? 'Your YardRover has already been set up. Please use your existing security key to log in.'
        : 'Device already configured. Use existing API key to authenticate.'
    } else if (error?.status === 400) {
      setupError.value = isConsumerMode.value
        ? 'Please check your device name - it should be between 1 and 128 characters.'
        : 'Invalid input. Name must be 1-128 characters.'
    } else {
      setupError.value = isConsumerMode.value
        ? 'Setup failed. Please try again or contact support if the problem continues.'
        : `Setup failed: ${error.message || 'Unknown error'}`
    }
  } finally {
    isSubmitting.value = false
  }
}

async function copyApiKey() {
  try {
    await navigator.clipboard.writeText(generatedApiKey.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy API key:', error)
  }
}

function downloadApiKey() {
  const content = `YardRover ${isConsumerMode.value ? 'Security' : 'API'} Key
===================

Device: ${deviceName.value}
Owner: ${adminKeyName.value}
Generated: ${new Date().toISOString()}

${isConsumerMode.value ? 'Security' : 'API'} Key:
${generatedApiKey.value}

⚠️ IMPORTANT: Keep this key secure!
This key provides full administrative access to your YardRover device.
${isConsumerMode.value ? 'You\'ll need this key every time you connect to your YardRover.' : 'Do not share it with anyone you don\'t trust.'}

To use this key:
1. Keep this file in a safe place
2. Use this key when logging in to your YardRover
3. ${isConsumerMode.value ? 'If you lose it, you\'ll need to reset your device' : 'Physical device access required for reset if lost'}
`

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yardrover-${isConsumerMode.value ? 'security' : 'api'}-key-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function continueToNext() {
  emit('complete')
}
</script>

<template>
  <div class="configuration-step">
    <div class="step-container">
      <!-- Setup Form -->
      <div v-if="currentView === 'form'" class="form-view">
        <!-- Header -->
        <div class="step-header">
          <div class="header-icon">⚙️</div>
          <h2>{{ isConsumerMode ? 'Name Your YardRover' : 'Device Configuration' }}</h2>
          <p class="step-description">
            {{ isConsumerMode
              ? 'Give your YardRover a friendly name and we\'ll create your security key'
              : 'Configure your device and create your admin API key'
            }}
          </p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSetup" class="config-form">
          <div class="form-group">
            <label for="deviceName">{{ isConsumerMode ? 'Device Name' : 'Device Name' }}</label>
            <input
              id="deviceName"
              v-model="deviceName"
              type="text"
              :placeholder="isConsumerMode ? 'My YardRover' : 'YardRover'"
              :disabled="isSubmitting"
              maxlength="128"
              required
            />
            <small class="form-hint">
              {{ isConsumerMode
                ? 'Choose something easy to remember, like "Garden Buddy" or "Backyard Helper"'
                : 'A descriptive name for your device (e.g., "Garden Rover", "Backyard Unit")'
              }}
            </small>
          </div>

          <div v-if="!isConsumerMode" class="form-group">
            <label for="adminKeyName">Admin Key Name</label>
            <input
              id="adminKeyName"
              v-model="adminKeyName"
              type="text"
              placeholder="Owner"
              :disabled="isSubmitting"
              maxlength="128"
            />
            <small class="form-hint">
              A label for your admin API key (e.g., "Owner", "Primary Admin")
            </small>
          </div>

          <div v-if="setupError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ setupError }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-large"
            :disabled="isSubmitting || !deviceName.trim()"
          >
            <span v-if="!isSubmitting">{{ isConsumerMode ? 'Create Security Key' : 'Complete Setup' }}</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              {{ isConsumerMode ? 'Setting up...' : 'Configuring...' }}
            </span>
          </button>
        </form>

        <div v-if="isConsumerMode" class="info-note">
          <div class="note-icon">💡</div>
          <p>
            We'll create a unique security key for your device. You'll use this key every time you connect to your YardRover, so make sure to save it!
          </p>
        </div>
      </div>

      <!-- Success View -->
      <div v-else-if="currentView === 'success'" class="success-view">
        <div class="success-header">
          <div class="success-icon">✅</div>
          <h2>{{ isConsumerMode ? 'All Set Up!' : 'Setup Complete!' }}</h2>
          <p class="success-message">
            {{ isConsumerMode
              ? `Your YardRover "${deviceName}" is now configured!`
              : 'Your device has been successfully configured.'
            }}
          </p>
        </div>

        <div class="api-key-section">
          <div class="api-key-header">
            <span class="key-icon">🔑</span>
            <strong>{{ isConsumerMode ? 'Your Security Key' : 'Your Admin API Key' }}</strong>
          </div>

          <div class="api-key-display">
            <code>{{ generatedApiKey }}</code>
          </div>

          <div class="api-key-actions">
            <button
              class="btn btn-primary"
              :class="{ copied }"
              @click="copyApiKey"
            >
              <span class="btn-icon">{{ copied ? '✓' : '📋' }}</span>
              <span>{{ copied ? 'Copied!' : 'Copy Key' }}</span>
            </button>
            <button class="btn btn-outline" @click="downloadApiKey">
              <span class="btn-icon">💾</span>
              <span>Download</span>
            </button>
          </div>

          <div class="api-key-warning">
            <strong>⚠️ Important:</strong>
            {{ isConsumerMode
              ? 'Save this key now! You\'ll need it to access your YardRover. If you lose it, you\'ll have to reset your device.'
              : 'This key will not be shown again. Store it securely - you\'ll need it for authentication. Physical device access required for reset if lost.'
            }}
          </div>
        </div>

        <div class="next-steps">
          <h3>{{ isConsumerMode ? 'What to Do Next' : 'Next Steps' }}</h3>
          <ol>
            <li>{{ isConsumerMode ? '✓ Copy or download your security key' : '✓ Save your API key in a secure location' }}</li>
            <li>{{ isConsumerMode ? 'Continue to optional setup (recommended)' : 'Complete optional configuration steps' }}</li>
            <li>{{ isConsumerMode ? 'Start using your YardRover!' : 'Begin using the system' }}</li>
          </ol>
        </div>

        <button class="btn btn-primary btn-large" @click="continueToNext">
          {{ isConsumerMode ? 'Continue' : 'Proceed to Next Step' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.configuration-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.step-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

// Form View
.form-view {
  display: flex;
  flex-direction: column;
}

.step-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  .header-icon {
    font-size: 64px;
    margin-bottom: var(--spacing-md);
  }

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
    line-height: 1.6;
  }
}

.config-form {
  width: 100%;
}

.form-group {
  margin-bottom: var(--spacing-xl);

  label {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-base);
  }

  input {
    width: 100%;
    padding: var(--spacing-md);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: 0 0 0 3px rgba($primary, 0.1);
    }

    &:disabled {
      background: var(--bg-secondary);
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  .form-hint {
    display: block;
    margin-top: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.4;
  }
}

.info-note {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-xl);

  .note-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    line-height: 1.6;
  }
}

// Success View
.success-view {
  display: flex;
  flex-direction: column;
}

.success-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  .success-icon {
    font-size: 80px;
    line-height: 1;
    animation: celebrate 0.6s ease-out;
  }

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: $positive;
    margin: var(--spacing-lg) 0 var(--spacing-sm);
  }

  .success-message {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
  }
}

@keyframes celebrate {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.api-key-section {
  background: rgba(251, 191, 36, 0.1);
  border: 2px solid rgba(251, 191, 36, 0.4);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.api-key-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-base);
  color: var(--text-primary);

  .key-icon {
    font-size: 24px;
  }

  strong {
    font-weight: 700;
  }
}

.api-key-display {
  background: var(--bg-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 2px solid var(--border-color);
  margin-bottom: var(--spacing-md);
  overflow-x: auto;

  code {
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    word-break: break-all;
    line-height: 1.6;
  }
}

.api-key-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);

  .btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);

    .btn-icon {
      font-size: 18px;
    }
  }

  .btn.copied {
    background: $positive;
    border-color: $positive;
  }
}

.api-key-warning {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: #92400e;

  strong {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 700;
  }
}

.next-steps {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);

  h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  ol {
    margin: 0;
    padding-left: var(--spacing-xl);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.8;

    li {
      margin-bottom: var(--spacing-xs);
    }
  }
}

// Common Elements
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: #991b1b;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
}

.btn-large {
  width: 100%;
  padding: var(--spacing-lg);
  font-size: var(--font-size-base);
}

.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Responsive
@include mobile {
  .configuration-step {
    padding: var(--spacing-lg);
  }

  .api-key-actions {
    flex-direction: column;

    .btn {
      width: 100%;
    }
  }

  .step-header .header-icon {
    font-size: 48px;
  }

  .success-header .success-icon {
    font-size: 64px;
  }
}
</style>
