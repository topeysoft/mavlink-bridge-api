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

const needsSetup = ref(false)
const isCheckingSetup = ref(true)
const apiKey = ref('')
const showApiKey = ref(false)
const isLoggingIn = ref(false)
const loginError = ref<string | null>(null)

const isConsumerMode = computed(() => props.userType === 'consumer')

onMounted(async () => {
  await checkSetupStatus()
})

async function checkSetupStatus() {
  isCheckingSetup.value = true

  try {
    if (!connectionStore.client) {
      throw new Error('No client connected')
    }

    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    const status = await authClient.getSetupStatus()
    needsSetup.value = status.in_setup_mode

  } catch (error) {
    console.error('Failed to check setup status:', error)
    loginError.value = 'Failed to check device status. Please check your connection.'
  } finally {
    isCheckingSetup.value = false
  }
}

async function handleLogin() {
  if (!apiKey.value.trim()) return

  if (!connectionStore.client) {
    loginError.value = 'No device connected. Please go back and reconnect.'
    return
  }

  isLoggingIn.value = true
  loginError.value = null

  try {
    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    await authStore.login(authClient, apiKey.value)
    emit('complete')

  } catch (error: any) {
    console.error('Login failed:', error)

    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      loginError.value = isConsumerMode.value
        ? 'That API key doesn\'t look right. Please check it and try again.'
        : 'Invalid API key. Please verify your key and try again.'
    } else if (error?.status === 403) {
      loginError.value = 'Access denied. This API key may not have sufficient permissions.'
    } else if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      loginError.value = 'Connection error. Please check your connection and try again.'
    } else {
      loginError.value = error instanceof Error
        ? error.message
        : 'Login failed. Please try again.'
    }
  } finally {
    isLoggingIn.value = false
  }
}
</script>

<template>
  <div class="authentication-step">
    <div class="step-container">
      <!-- Header -->
      <div class="step-header">
        <h2>{{ isConsumerMode ? 'Secure Your YardRover' : 'Authentication Required' }}</h2>
        <p class="step-description">
          {{ isConsumerMode
            ? 'Enter your security key to protect your device'
            : 'Enter your API key to authenticate'
          }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isCheckingSetup" class="state-content checking">
        <div class="loading-spinner">
          <svg viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="31.4 31.4">
              <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <h3>{{ isConsumerMode ? 'Checking device status...' : 'Checking authentication status...' }}</h3>
      </div>

      <!-- Setup Required Notice -->
      <div v-else-if="needsSetup" class="state-content setup-required">
        <div class="setup-icon">🔧</div>
        <h3>{{ isConsumerMode ? 'Initial Setup Required' : 'Device Setup Needed' }}</h3>
        <p>{{ isConsumerMode
          ? 'Your YardRover needs initial setup before you can use it. We\'ll help you create a security key in the next step.'
          : 'This device is in setup mode and requires initial configuration. The setup wizard will guide you through creating an admin API key.'
        }}</p>

        <div class="info-box">
          <div class="info-icon">💡</div>
          <div class="info-content">
            <strong>What's a {{ isConsumerMode ? 'security key' : 'API key' }}?</strong>
            <p>{{ isConsumerMode
              ? 'It\'s like a password that keeps your YardRover safe. You\'ll create one in the next step and use it to log in.'
              : 'An API key provides secure access to your device. You\'ll create an admin key during setup and use it for authentication.'
            }}</p>
          </div>
        </div>

        <button class="btn btn-primary btn-large" @click="emit('complete')">
          {{ isConsumerMode ? 'Continue to Setup' : 'Proceed to Setup' }}
        </button>
      </div>

      <!-- Login Form -->
      <div v-else class="state-content login-form">
        <div class="login-icon">🔐</div>

        <form @submit.prevent="handleLogin" class="form">
          <div class="form-group">
            <label for="apiKey">{{ isConsumerMode ? 'Security Key' : 'API Key' }}</label>
            <div class="input-with-toggle">
              <input
                id="apiKey"
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                :placeholder="isConsumerMode ? 'Enter your security key' : 'yr_...'"
                :disabled="isLoggingIn"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="toggle-visibility"
                @click="showApiKey = !showApiKey"
                :title="showApiKey ? 'Hide key' : 'Show key'"
              >
                <svg v-if="showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
            <small class="form-hint">
              {{ isConsumerMode
                ? 'This was provided when you first set up your YardRover'
                : 'Your API key starts with "yr_" and is case-sensitive'
              }}
            </small>
          </div>

          <div v-if="loginError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ loginError }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-large"
            :disabled="isLoggingIn || !apiKey.trim()"
          >
            <span v-if="!isLoggingIn">{{ isConsumerMode ? 'Continue' : 'Authenticate' }}</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              {{ isConsumerMode ? 'Checking...' : 'Authenticating...' }}
            </span>
          </button>
        </form>

        <div class="help-section">
          <p class="help-text">
            <strong>{{ isConsumerMode ? 'Can\'t find your key?' : 'Lost your API key?' }}</strong>
            {{ isConsumerMode
              ? 'Check the documentation that came with your YardRover, or contact support if you need help.'
              : 'You\'ll need physical access to the device to reset it. Check the documentation for reset instructions.'
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.authentication-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.step-container {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.state-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
  width: 100%;

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: var(--spacing-lg) 0 var(--spacing-sm);
  }

  > p {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0 0 var(--spacing-xl);
    line-height: 1.6;
  }
}

// Loading State
.loading-spinner {
  svg {
    width: 60px;
    height: 60px;
    color: $primary;
  }
}

// Icons
.setup-icon,
.login-icon {
  font-size: 64px;
  line-height: 1;
}

// Info Box
.info-box {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  text-align: left;
  margin-bottom: var(--spacing-xl);
  width: 100%;

  .info-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .info-content {
    flex: 1;

    strong {
      display: block;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }

    p {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.5;
    }
  }
}

// Form
.form {
  width: 100%;
}

.form-group {
  margin-bottom: var(--spacing-lg);
  text-align: left;

  label {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-base);
  }
}

.input-with-toggle {
  position: relative;
  display: flex;
  align-items: center;

  input {
    width: 100%;
    padding: var(--spacing-md) calc(var(--spacing-md) + 36px) var(--spacing-md) var(--spacing-md);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-family: 'Courier New', monospace;
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

    &::placeholder {
      color: var(--text-light);
    }
  }

  .toggle-visibility {
    position: absolute;
    right: var(--spacing-md);
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: var(--spacing-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover {
      color: $primary;
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.form-hint {
  display: block;
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

// Error Message
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
  text-align: left;

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }
}

// Buttons
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

// Help Section
.help-section {
  width: 100%;
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--border-color);

  .help-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
    text-align: center;

    strong {
      display: block;
      color: var(--text-primary);
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
    }
  }
}

// Responsive
@include mobile {
  .authentication-step {
    padding: var(--spacing-lg);
  }

  .state-content {
    max-width: 100%;
  }

  .info-box {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>
