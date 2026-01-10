<template>
  <StandaloneLayout :title="t('brand.name')">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">
            <div class="logo-icon">🚜</div>
            <h1>{{ t('brand.name') }}</h1>
          </div>
          <p class="subtitle">{{ t('brand.tagline') }}</p>
        </div>

        <div class="login-form">
          <!-- Login Form -->
          <div>
            <h2>{{ t('auth.login.title') }}</h2>
            <p class="form-description">
              {{ t('auth.login.subtitle') }}
            </p>

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

            <!-- PIN Login (when PIN method selected) -->
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
              <div v-if="isConsumerMode" class="login-footer" style="border-top: none; padding-top: 0;">
                <p class="help-text" style="text-align: center;">
                  <button type="button" class="text-link" @click="loginMethod = 'password'">
                    Use password instead
                  </button>
                </p>
              </div>
            </div>

            <!-- Username/Password Login (when password method selected) -->
            <form v-if="loginMethod === 'password'" @submit.prevent="handlePasswordLogin">
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
                {{ loginError }}
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  :disabled="isLoggingIn || !username.trim() || !password.trim()"
                >
                  <span v-if="!isLoggingIn">Sign In</span>
                  <span v-else class="loading">
                    <span class="spinner"></span>
                    Signing in...
                  </span>
                </button>
              </div>

              <!-- Switch back to PIN option for consumer mode -->
              <div v-if="isConsumerMode" class="login-footer" style="border-top: none; padding-top: 0;">
                <p class="help-text" style="text-align: center;">
                  <button type="button" class="text-link" @click="loginMethod = 'pin'">
                    Use PIN instead
                  </button>
                </p>
              </div>
            </form>

            <!-- API Key Login (Developer mode only) -->
            <form v-if="loginMethod === 'apikey'" @submit.prevent="handleApiKeyLogin">
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
                {{ loginError }}
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  :disabled="isLoggingIn || !apiKey.trim()"
                >
                  <span v-if="!isLoggingIn">Sign In</span>
                  <span v-else class="loading">
                    <span class="spinner"></span>
                    Signing in...
                  </span>
                </button>
              </div>
            </form>

          <div class="login-footer" v-if="loginMethod === 'apikey'">
            <p class="help-text">
              <strong>API Key Login</strong>
              API keys are for automation and CLI tools. Use username/password or PIN for interactive login.
            </p>
          </div>
          <div class="login-footer" v-else>
            <p class="help-text">
              <strong>First time setup?</strong>
              Your username and password were created during initial setup.
            </p>
            <p class="help-text" v-if="!isConsumerMode">
              <strong>Forgot your password?</strong>
              You'll need physical access to the device to reset it.
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  </StandaloneLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useConnectionStore } from '../stores/connection'
import { useFeaturesStore } from '../stores/features'
import StandaloneLayout from '@/layouts/StandaloneLayout.vue'
import PinInput from '@/components/common/PinInput.vue'

const { t } = useI18n()

const router = useRouter()
const authStore = useAuthStore()
const connectionStore = useConnectionStore()
const featuresStore = useFeaturesStore()

// Computed
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
const isDeveloperMode = computed(() => featuresStore.userMode === 'developer')

// State - default to PIN in consumer mode, password otherwise
const loginMethod = ref<'password' | 'pin' | 'apikey'>(isConsumerMode.value ? 'pin' : 'password')
const username = ref('')
const password = ref('')
const pin = ref('')
const apiKey = ref('')
const isLoggingIn = ref(false)
const loginError = ref<string | null>(null)
const showPassword = ref(false)
const showApiKey = ref(false)

// Actions
async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value.trim()) return

  // Check if we have a connected device
  if (!connectionStore.client) {
    loginError.value = 'No device connected. Please connect to a device first.'
    return
  }

  isLoggingIn.value = true
  loginError.value = null

  try {
    // Get auth client from connection
    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    // Attempt login with password
    await authClient.loginWithPassword(username.value, password.value)

    // Sync auth state from client (also fetches current user)
    await authStore.initializeFromClient(authClient)

    // Connect WebSocket for real-time updates now that we're authenticated
    if (connectionStore.client) {
      try {
        await connectionStore.client.connectWebSocket()
        console.log('[Login] WebSocket connected after successful login')
      } catch (wsError) {
        console.warn('[Login] WebSocket connection failed:', wsError)
        // Don't block login flow if WebSocket fails
      }
    }

    // Redirect to dashboard on success (use replace to avoid back button issues)
    router.replace('/')
  } catch (error: any) {
    console.error('Login failed:', error)
    handleLoginError(error)
  } finally {
    isLoggingIn.value = false
  }
}

async function handlePinLogin() {
  if (!pin.value.trim() || pin.value.length < 4) return

  // Check if we have a connected device
  if (!connectionStore.client) {
    loginError.value = 'No device connected. Please connect to a device first.'
    return
  }

  isLoggingIn.value = true
  loginError.value = null

  try {
    // Get auth client from connection
    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    // Attempt login with PIN
    await authClient.loginWithPin(pin.value)

    // Sync auth state from client (also fetches current user)
    await authStore.initializeFromClient(authClient)

    // Connect WebSocket for real-time updates now that we're authenticated
    if (connectionStore.client) {
      try {
        await connectionStore.client.connectWebSocket()
        console.log('[Login] WebSocket connected after successful PIN login')
      } catch (wsError) {
        console.warn('[Login] WebSocket connection failed:', wsError)
        // Don't block login flow if WebSocket fails
      }
    }

    // Redirect to dashboard on success (use replace to avoid back button issues)
    router.replace('/')
  } catch (error: any) {
    console.error('PIN login failed:', error)

    // PIN-specific error messages
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

  // Check if we have a connected device
  if (!connectionStore.client) {
    loginError.value = 'No device connected. Please connect to a device first.'
    return
  }

  isLoggingIn.value = true
  loginError.value = null

  try {
    // Get auth client from connection
    const authClient = (connectionStore.client as any).authClient
    if (!authClient) {
      throw new Error('Auth client not available')
    }

    // Attempt login with API key
    await authStore.login(authClient, apiKey.value)

    // Redirect to dashboard on success (use replace to avoid back button issues)
    router.replace('/')
  } catch (error: any) {
    console.error('API key login failed:', error)

    // API key-specific error messages
    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      loginError.value = 'Invalid API key. Please check that your key is correct and try again.'
    } else {
      handleLoginError(error)
    }
  } finally {
    isLoggingIn.value = false
  }
}

function handleLoginError(error: any) {
  // Provide actionable error messages
  if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
    loginError.value = 'Invalid credentials. Please check your username and password and try again.'
  } else if (error?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
    loginError.value = 'Access denied. Your account may not have sufficient permissions to log in.'
  } else if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
    loginError.value = 'Connection error. Please check that you\'re connected to the device and try again.'
  } else {
    loginError.value = error instanceof Error
      ? error.message
      : 'Login failed. Please check your credentials and connection, then try again.'
  }
}

// Check if already authenticated (setup check handled by router guard)
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
    return
  }

  // Check if redirected due to session expiry
  const route = router.currentRoute.value
  if (route.query.reason === 'session_expired') {
    loginError.value = 'Your session has expired. Please log in again.'
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use 'sass:color';

.login-container {
  width: 100%;
  max-width: 480px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.login-header {
  background: linear-gradient(135deg, $primary 0%, color.adjust($primary, $lightness: -10%) 100%);
  color: white;
  padding: 3rem 2rem;
  text-align: center;
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  .logo-icon {
    font-size: 4rem;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

.subtitle {
  margin: 1rem 0 0;
  font-size: 1rem;
  opacity: 0.9;
  font-weight: 300;
}

.login-form {
  padding: 2rem;

  h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: $dark;
    margin: 0 0 0.5rem;
  }

  .form-description {
    color: $grey-6;
    margin: 0 0 2rem;
    font-size: 0.95rem;
  }
}

.login-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.25rem;
  background: #f5f5f5;
  border-radius: 8px;

  .tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 500;
    color: $grey-6;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba($primary, 0.1);
      color: $primary;
    }

    &.active {
      background: white;
      color: $primary;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
}

.pin-login-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group-pin {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;

  .pin-label {
    font-weight: 600;
    color: $dark;
    font-size: 1rem;
    text-align: center;
  }
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  color: $primary;
  font-size: 0.95rem;
  font-weight: 500;

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba($primary, 0.3);
    border-top-color: $primary;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

.form-group {
  margin-bottom: 1.5rem;

  label {
    display: block;
    font-weight: 600;
    color: $dark;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }

  .input-with-toggle {
    position: relative;
    display: flex;
    align-items: center;

    input {
      width: 100%;
      padding: 0.875rem 3rem 0.875rem 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      font-family: 'Courier New', monospace;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: $primary;
        box-shadow: 0 0 0 3px rgba($primary, 0.1);
      }

      &:disabled {
        background: #f5f5f5;
        cursor: not-allowed;
      }

      &::placeholder {
        color: #999;
      }
    }

    .toggle-visibility {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      color: $grey-6;
      cursor: pointer;
      padding: 0.25rem;
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

  input:not(.input-with-toggle input) {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    font-family: 'Courier New', monospace;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: 0 0 0 3px rgba($primary, 0.1);
    }

    &:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    &::placeholder {
      color: #999;
    }
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: $grey-6;
  }
}

.error-message {
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #c00;
  font-size: 0.95rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  .error-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
  }
}

.form-actions {
  margin-bottom: 1.5rem;

  .btn-primary {
    width: 100%;
    padding: 1rem;
    background: $primary;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: color.adjust($primary, $lightness: -10%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba($primary, 0.3);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
  }
}

.login-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 1.5rem;

  .help-text {
    font-size: 0.875rem;
    color: $grey-6;
    margin: 0 0 1rem;
    line-height: 1.6;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: $dark;
      font-weight: 600;
    }
  }

  .text-link {
    background: none;
    border: none;
    color: $primary;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    text-decoration: underline;
    transition: all 0.2s;

    &:hover {
      color: color.adjust($primary, $lightness: -10%);
    }

    &:active {
      transform: translateY(1px);
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Responsive
@media (max-width: 640px) {
  .login-header {
    padding: 2rem 1.5rem;

    .logo {
      .logo-icon {
        font-size: 3rem;
      }

      h1 {
        font-size: 2rem;
      }
    }
  }

  .login-form {
    padding: 1.5rem;

    h2 {
      font-size: 1.5rem;
    }
  }
}
</style>
