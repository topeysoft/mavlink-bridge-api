<template>
  <StandaloneLayout title="YardRover">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">
            <div class="logo-icon">🚜</div>
            <h1>YardRover</h1>
          </div>
          <p class="subtitle">Autonomous Yard Utility Machine</p>
        </div>

        <div class="login-form">
          <!-- Setup Required Notice -->
          <div v-if="needsSetup" class="setup-notice">
            <div class="notice-icon">🔧</div>
            <h3>Setup Required</h3>
            <p>
              This device needs initial setup. You'll be redirected to the setup page
              automatically, or click the button below.
            </p>
            <button class="btn-setup" @click="goToSetup">
              Go to Setup
            </button>
          </div>

          <!-- Login Form -->
          <div v-else>
            <h2>Sign In</h2>
            <p class="form-description">
              Enter your API key to access your YardRover device.
            </p>

            <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="apiKey">API Key</label>
              <div class="input-with-toggle">
                <input
                  id="apiKey"
                  v-model="apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="yr_..."
                  :disabled="isLoggingIn"
                  autocomplete="current-password"
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

          <div class="login-footer">
            <p class="help-text">
              <strong>First time setup?</strong>
              Your admin API key was displayed when you first started YardRover.
              Check the console logs or access the setup page if this is your first boot.
            </p>
            <p class="help-text">
              <strong>Lost your API key?</strong>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useConnectionStore } from '../stores/connection'
import StandaloneLayout from '@/layouts/StandaloneLayout.vue'

const router = useRouter()
const authStore = useAuthStore()
const connectionStore = useConnectionStore()

// State
const apiKey = ref('')
const isLoggingIn = ref(false)
const loginError = ref<string | null>(null)
const needsSetup = ref(false)
const showApiKey = ref(false)

// Actions
async function handleLogin() {
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

    // Attempt login
    await authStore.login(authClient, apiKey.value)

    // Redirect to dashboard on success
    router.push('/')
  } catch (error: any) {
    console.error('Login failed:', error)

    // Provide actionable error messages
    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      loginError.value = 'Invalid API key. Please check that your key is correct and try again. If you\'ve lost your API key, you\'ll need physical access to the device to reset it.'
    } else if (error?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
      loginError.value = 'Access denied. This API key may not have sufficient permissions to log in.'
    } else if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      loginError.value = 'Connection error. Please check that you\'re connected to the device and try again.'
    } else {
      loginError.value = error instanceof Error
        ? error.message
        : 'Login failed. Please check your API key and connection, then try again.'
    }
  } finally {
    isLoggingIn.value = false
  }
}

// Check if already authenticated or needs setup
onMounted(async () => {
  if (authStore.isAuthenticated) {
    router.push('/')
    return
  }

  // Check if device needs setup
  if (connectionStore.client) {
    try {
      const authClient = (connectionStore.client as any).authClient
      if (authClient) {
        const setupStatus = await authClient.getSetupStatus()
        if (setupStatus.in_setup_mode) {
          needsSetup.value = true
          // Auto redirect after 2 seconds
          setTimeout(() => {
            router.push({ name: 'setup' })
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Failed to check setup status:', error)
    }
  }
})

function goToSetup() {
  router.push({ name: 'setup' })
}
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

.setup-notice {
  text-align: center;
  padding: 1rem;

  .notice-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: pulse 2s ease-in-out infinite;
  }

  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: $dark;
    margin: 0 0 1rem;
  }

  p {
    color: $grey-6;
    margin: 0 0 1.5rem;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .btn-setup {
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

    &:hover {
      background: color.adjust($primary, $lightness: -10%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba($primary, 0.3);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
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
