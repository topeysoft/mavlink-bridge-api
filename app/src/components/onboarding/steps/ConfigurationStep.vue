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
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const pin = ref('')
const confirmPin = ref('')
const showPassword = ref(false)
const enablePin = ref(false)
const adminKeyName = ref('Admin API Key')
const isSubmitting = ref(false)
const setupError = ref<string | null>(null)
const generatedApiKey = ref('')
const generatedUsername = ref('')
const currentView = ref<'form' | 'success'>('form')
const copied = ref(false)

const isConsumerMode = computed(() => props.userType === 'consumer')

const passwordsMatch = computed(() => password.value === confirmPassword.value)
const pinsMatch = computed(() => !enablePin.value || pin.value === confirmPin.value)
const passwordValid = computed(() => password.value.length >= 8)
const pinValid = computed(() => !enablePin.value || (pin.value.length >= 4 && pin.value.length <= 6 && /^\d+$/.test(pin.value)))

onMounted(() => {
  // Check if we're actually in setup mode
  if (!authStore.needsSetup && authStore.isAuthenticated) {
    // Already configured, skip this step
    emit('complete')
  }
})

async function handleSetup() {
  if (!deviceName.value.trim() || !username.value.trim() || !password.value.trim()) return

  // Validate inputs
  if (!passwordValid.value) {
    setupError.value = 'Password must be at least 8 characters long'
    return
  }

  if (!passwordsMatch.value) {
    setupError.value = 'Passwords do not match'
    return
  }

  if (enablePin.value) {
    if (!pinValid.value) {
      setupError.value = 'PIN must be 4-6 digits'
      return
    }

    if (!pinsMatch.value) {
      setupError.value = 'PINs do not match'
      return
    }
  }

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

    // Call the new setup API with username/password/PIN
    const response = await authClient.completeSetup({
      device_name: deviceName.value.trim(),
      username: username.value.trim(),
      password: password.value,
      display_name: username.value.trim(),
      pin: enablePin.value ? pin.value : undefined,
      admin_key_name: adminKeyName.value.trim(),
      admin_key_description: 'Admin API key for automation and CLI tools',
    })

    generatedApiKey.value = response.api_key
    generatedUsername.value = response.username
    currentView.value = 'success'

  } catch (error: any) {
    console.error('Setup failed:', error)

    if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      setupError.value = isConsumerMode.value
        ? 'Connection problem. Please check your connection and try again.'
        : 'Network error. Please verify connection and retry.'
    } else if (error?.message?.includes('already configured') || error?.message?.includes('not in setup mode')) {
      setupError.value = isConsumerMode.value
        ? 'Your YardRover has already been set up. Please use your existing credentials to log in.'
        : 'Device already configured. Use existing credentials to authenticate.'
    } else if (error?.status === 400) {
      setupError.value = error?.message || 'Invalid input. Please check your information and try again.'
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

          <div class="form-divider"></div>

          <div class="form-group">
            <label for="username">{{ isConsumerMode ? 'Create Username' : 'Admin Username' }}</label>
            <input
              id="username"
              v-model="username"
              type="text"
              :placeholder="isConsumerMode ? 'Your username' : 'admin'"
              :disabled="isSubmitting"
              maxlength="64"
              autocomplete="username"
              required
            />
            <small class="form-hint">
              {{ isConsumerMode
                ? 'This is what you\'ll use to log in'
                : 'Username for admin account'
              }}
            </small>
          </div>

          <div class="form-group">
            <label for="password">{{ isConsumerMode ? 'Create Password' : 'Admin Password' }}</label>
            <div class="input-with-toggle">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="At least 8 characters"
                :disabled="isSubmitting"
                autocomplete="new-password"
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
            <small class="form-hint" :class="{ 'hint-error': password.length > 0 && !passwordValid }">
              {{ passwordValid || password.length === 0 ? 'Minimum 8 characters' : '⚠️ Password too short' }}
            </small>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Re-enter password"
              :disabled="isSubmitting"
              autocomplete="new-password"
              required
            />
            <small class="form-hint" :class="{ 'hint-error': confirmPassword.length > 0 && !passwordsMatch }">
              {{ passwordsMatch || confirmPassword.length === 0 ? 'Must match password above' : '⚠️ Passwords do not match' }}
            </small>
          </div>

          <div v-if="isConsumerMode" class="form-group checkbox-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="enablePin"
                :disabled="isSubmitting"
              />
              <span>Enable PIN Login (Optional)</span>
            </label>
            <small class="form-hint">
              Add a quick 4-6 digit PIN for faster login
            </small>
          </div>

          <template v-if="enablePin">
            <div class="form-group">
              <label for="pin">Create PIN</label>
              <input
                id="pin"
                v-model="pin"
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="4-6 digits"
                :disabled="isSubmitting"
                maxlength="6"
                autocomplete="off"
              />
              <small class="form-hint" :class="{ 'hint-error': pin.length > 0 && !pinValid }">
                {{ pinValid || pin.length === 0 ? '4-6 digit numbers only' : '⚠️ PIN must be 4-6 digits' }}
              </small>
            </div>

            <div class="form-group">
              <label for="confirmPin">Confirm PIN</label>
              <input
                id="confirmPin"
                v-model="confirmPin"
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="Re-enter PIN"
                :disabled="isSubmitting"
                maxlength="6"
                autocomplete="off"
              />
              <small class="form-hint" :class="{ 'hint-error': confirmPin.length > 0 && !pinsMatch }">
                {{ pinsMatch || confirmPin.length === 0 ? 'Must match PIN above' : '⚠️ PINs do not match' }}
              </small>
            </div>
          </template>

          <div v-if="setupError" class="error-message">
            <span class="error-icon">⚠️</span>
            <span>{{ setupError }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-large"
            :disabled="isSubmitting || !deviceName.trim() || !username.trim() || !password.trim() || !confirmPassword.trim() || !passwordValid || !passwordsMatch || (enablePin && (!pinValid || !pinsMatch))"
          >
            <span v-if="!isSubmitting">{{ isConsumerMode ? 'Create Account' : 'Complete Setup' }}</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              {{ isConsumerMode ? 'Setting up...' : 'Configuring...' }}
            </span>
          </button>
        </form>

        <div v-if="isConsumerMode" class="info-note">
          <div class="note-icon">💡</div>
          <p>
            You'll use your username and {{ enablePin ? 'PIN' : 'password' }} to log in to your YardRover. We'll also generate an API key for advanced features.
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

        <div class="credentials-section">
          <div class="cred-box">
            <div class="cred-header">
              <span class="cred-icon">👤</span>
              <strong>{{ isConsumerMode ? 'Your Login' : 'Admin Credentials' }}</strong>
            </div>
            <div class="cred-info">
              <div class="cred-row">
                <span class="cred-label">Username:</span>
                <span class="cred-value">{{ generatedUsername }}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Password:</span>
                <span class="cred-value">(as you entered)</span>
              </div>
              <div v-if="enablePin" class="cred-row">
                <span class="cred-label">PIN:</span>
                <span class="cred-value">(as you entered)</span>
              </div>
            </div>
            <p class="cred-note">
              {{ isConsumerMode
                ? 'Use these to log in to your YardRover'
                : 'Use these credentials for admin access'
              }}
            </p>
          </div>

          <div class="api-key-section">
            <div class="api-key-header">
              <span class="key-icon">🔑</span>
              <strong>{{ isConsumerMode ? 'API Key (for advanced features)' : 'Admin API Key' }}</strong>
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
                ? 'Save this API key if you plan to use automation or CLI tools. You won\'t need it for normal login.'
                : 'This API key will not be shown again. Store it securely for automation, CLI tools, and API access.'
              }}
            </div>
          </div>
        </div>

        <div class="next-steps">
          <h3>{{ isConsumerMode ? 'What to Do Next' : 'Next Steps' }}</h3>
          <ol>
            <li>{{ isConsumerMode ? '✓ Save the API key (if you need advanced features)' : '✓ Save your API key in a secure location' }}</li>
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

.form-divider {
  height: 1px;
  background: var(--border-color);
  margin: var(--spacing-xl) 0;
}

.input-with-toggle {
  position: relative;
  display: flex;
  align-items: center;

  input {
    width: 100%;
    padding: var(--spacing-md) calc(var(--spacing-md) + 36px) var(--spacing-md) var(--spacing-md);
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

.checkbox-group {
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    font-weight: 600;

    input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }
  }
}

.hint-error {
  color: #dc2626 !important;
  font-weight: 600;
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

.credentials-section {
  margin-bottom: var(--spacing-xl);
}

.cred-box {
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
}

.cred-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-base);
  color: var(--text-primary);

  .cred-icon {
    font-size: 24px;
  }

  strong {
    font-weight: 700;
  }
}

.cred-info {
  background: var(--bg-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 2px solid var(--border-color);
  margin-bottom: var(--spacing-md);
}

.cred-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }

  .cred-label {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .cred-value {
    font-family: 'Courier New', monospace;
    color: var(--text-primary);
    font-weight: 600;
  }
}

.cred-note {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
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
