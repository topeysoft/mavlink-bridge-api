<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import { useFeaturesStore } from '@/stores/features'
import type { UserType } from '@/stores/onboarding'
import PinInput from '@/components/common/PinInput.vue'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
}>()

const authStore = useAuthStore()
const connectionStore = useConnectionStore()
const featuresStore = useFeaturesStore()

const needsSetup = ref(false)
const isCheckingSetup = ref(true)
const loginMethod = ref<'password' | 'pin' | 'apikey'>('password')
const username = ref('')
const password = ref('')
const pin = ref('')
const apiKey = ref('')
const showPassword = ref(false)
const showApiKey = ref(false)
const isLoggingIn = ref(false)
const loginError = ref<string | null>(null)

const isConsumerMode = computed(() => props.userType === 'consumer')
const isDeveloperMode = computed(() => featuresStore.userMode === 'developer')

onMounted(async () => {
  // Set default login method based on user mode
  loginMethod.value = isConsumerMode.value ? 'pin' : 'password'
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

    // If setup is needed, skip this step and go directly to ConfigurationStep
    // where the actual account creation happens
    if (needsSetup.value) {
      console.log('[AuthenticationStep] Setup required - skipping to configuration')
      emit('complete')
    }

  } catch (error) {
    console.error('Failed to check setup status:', error)
    loginError.value = 'Failed to check device status. Please check your connection.'
  } finally {
    isCheckingSetup.value = false
  }
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value.trim()) return

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

    await authClient.loginWithPassword(username.value, password.value)
    await authStore.initializeFromClient(authClient)

    // Connect WebSocket for real-time updates
    if (connectionStore.client) {
      try {
        await connectionStore.client.connectWebSocket()
        console.log('[AuthenticationStep] WebSocket connected after login')
      } catch (wsError) {
        console.warn('[AuthenticationStep] WebSocket connection failed:', wsError)
      }
    }

    emit('complete')

  } catch (error: any) {
    console.error('Password login failed:', error)
    handleLoginError(error)
  } finally {
    isLoggingIn.value = false
  }
}

async function handlePinLogin() {
  if (!pin.value.trim() || pin.value.length < 4) return

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

    await authClient.loginWithPin(pin.value)
    await authStore.initializeFromClient(authClient)

    // Connect WebSocket for real-time updates
    if (connectionStore.client) {
      try {
        await connectionStore.client.connectWebSocket()
        console.log('[AuthenticationStep] WebSocket connected after PIN login')
      } catch (wsError) {
        console.warn('[AuthenticationStep] WebSocket connection failed:', wsError)
      }
    }

    emit('complete')

  } catch (error: any) {
    console.error('PIN login failed:', error)

    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      loginError.value = 'Invalid PIN. Please check your PIN and try again.'
    } else {
      handleLoginError(error)
    }
  } finally {
    isLoggingIn.value = false
  }
}

async function handleApiKeyLogin() {
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
    console.error('API key login failed:', error)

    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      loginError.value = isConsumerMode.value
        ? 'That API key doesn\'t look right. Please check it and try again.'
        : 'Invalid API key. Please verify your key and try again.'
    } else {
      handleLoginError(error)
    }
  } finally {
    isLoggingIn.value = false
  }
}

function handleLoginError(error: any) {
  if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
    loginError.value = 'Invalid credentials. Please check your username and password and try again.'
  } else if (error?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
    loginError.value = 'Access denied. Your account may not have sufficient permissions.'
  } else if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
    loginError.value = 'Connection error. Please check your connection and try again.'
  } else {
    loginError.value = error instanceof Error
      ? error.message
      : 'Login failed. Please try again.'
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

        <!-- Login Method Tabs (Power User & Developer modes) -->
        <div v-if="!isConsumerMode" class="login-tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: loginMethod === 'password' }"
            @click="loginMethod = 'password'"
          >
            Password
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: loginMethod === 'pin' }"
            @click="loginMethod = 'pin'"
          >
            PIN
          </button>
          <button
            v-if="isDeveloperMode"
            type="button"
            class="tab"
            :class="{ active: loginMethod === 'apikey' }"
            @click="loginMethod = 'apikey'"
          >
            API Key
          </button>
        </div>

        <!-- PIN Login -->
        <div v-if="loginMethod === 'pin'" class="pin-login-section">
          <div class="form-group-pin">
            <label class="pin-label">Enter your 6-digit PIN</label>
            <PinInput
              v-model="pin"
              :length="6"
              :disabled="isLoggingIn"
              :auto-submit="true"
              :error="!!loginError"
              @complete="handlePinLogin"
            />
          </div>

          <div v-if="loginError" class="error-message">
            <span class="error-icon">⚠️</span>
            {{ loginError }}
          </div>

          <div v-if="isLoggingIn" class="loading-indicator">
            <span class="spinner"></span>
            <span>Signing in...</span>
          </div>

          <!-- Switch to password option for consumer mode -->
          <div v-if="isConsumerMode" class="switch-method">
            <button type="button" class="text-link" @click="loginMethod = 'password'">
              Use password instead
            </button>
          </div>
        </div>

        <!-- Username/Password Login -->
        <form v-if="loginMethod === 'password'" @submit.prevent="handlePasswordLogin" class="form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="Enter username"
              :disabled="isLoggingIn"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="input-with-toggle">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                :disabled="isLoggingIn"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="toggle-visibility"
                @click="showPassword = !showPassword"
                :title="showPassword ? 'Hide password' : 'Show password'"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>

          <div v-if="loginError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ loginError }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-large"
            :disabled="isLoggingIn || !username.trim() || !password.trim()"
          >
            <span v-if="!isLoggingIn">{{ isConsumerMode ? 'Sign In' : 'Authenticate' }}</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              Signing in...
            </span>
          </button>

          <!-- Switch to PIN option for consumer mode -->
          <div v-if="isConsumerMode" class="switch-method">
            <button type="button" class="text-link" @click="loginMethod = 'pin'">
              Use PIN instead
            </button>
          </div>
        </form>

        <!-- API Key Login (Developer mode only) -->
        <form v-if="loginMethod === 'apikey'" @submit.prevent="handleApiKeyLogin" class="form">
          <div class="form-group">
            <label for="apiKey">API Key</label>
            <div class="input-with-toggle">
              <input
                id="apiKey"
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="yr_..."
                :disabled="isLoggingIn"
                autocomplete="off"
                required
              />
              <button
                type="button"
                class="toggle-visibility"
                @click="showApiKey = !showApiKey"
                :title="showApiKey ? 'Hide API key' : 'Show API key'"
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
              Your API key starts with "yr_" and is case-sensitive
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
            <span v-if="!isLoggingIn">Sign In</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              Signing in...
            </span>
          </button>
        </form>

        <div class="help-section">
          <p class="help-text" v-if="loginMethod === 'apikey'">
            <strong>API Key Login</strong>
            API keys are for automation and CLI tools. Use username/password or PIN for interactive login.
          </p>
          <p class="help-text" v-else>
            <strong>First time logging in?</strong>
            Use the credentials you created during setup.
          </p>
          <p class="help-text" v-if="loginMethod !== 'apikey'">
            <strong>Forgot your {{ loginMethod === 'pin' ? 'PIN' : 'password' }}?</strong>
            You'll need physical access to the device to reset it.
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

// Login Tabs
.login-tabs {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-xs);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  width: 100%;

  .tab {
    flex: 1;
    padding: var(--spacing-md);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba($primary, 0.1);
      color: $primary;
    }

    &.active {
      background: var(--bg-primary);
      color: $primary;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
}

// PIN Login Section
.pin-login-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
}

.form-group-pin {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  align-items: center;

  .pin-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: var(--font-size-base);
    text-align: center;
  }
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  color: $primary;
  font-size: var(--font-size-sm);
  font-weight: 600;

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba($primary, 0.3);
    border-top-color: $primary;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

.switch-method {
  text-align: center;
  margin-top: var(--spacing-sm);

  .text-link {
    background: none;
    border: none;
    color: $primary;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: var(--font-size-sm);
    text-decoration: underline;
    transition: all 0.2s;

    &:hover {
      color: darken($primary, 10%);
    }

    &:active {
      transform: translateY(1px);
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

  input:not(.input-with-toggle input) {
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

    &::placeholder {
      color: var(--text-light);
    }
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
