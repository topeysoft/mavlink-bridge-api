<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import { useFeaturesStore } from '@/stores/features'
import { useDialog } from '@/composables/useDialog'

const authStore = useAuthStore()
const connectionStore = useConnectionStore()
const featuresStore = useFeaturesStore()
const dialog = useDialog()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

// Password Change
const showPasswordChange = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const isChangingPassword = ref(false)
const passwordError = ref<string | null>(null)

const passwordValid = computed(() => newPassword.value.length >= 8)
const passwordsMatch = computed(() => newPassword.value === confirmNewPassword.value)

// PIN Management
const showPinManagement = ref(false)
const pin = ref('')
const confirmPin = ref('')
const pinPassword = ref('')
const showPinPassword = ref(false)
const isManagingPin = ref(false)
const pinError = ref<string | null>(null)
const currentPinStatus = ref<'none' | 'set' | 'unknown'>('unknown')

const pinValid = computed(() => pin.value.length >= 4 && pin.value.length <= 6 && /^\d+$/.test(pin.value))
const pinsMatch = computed(() => pin.value === confirmPin.value)

async function handlePasswordChange() {
  if (!oldPassword.value || !newPassword.value || !confirmNewPassword.value) return

  if (!passwordValid.value) {
    passwordError.value = 'New password must be at least 8 characters'
    return
  }

  if (!passwordsMatch.value) {
    passwordError.value = 'Passwords do not match'
    return
  }

  isChangingPassword.value = true
  passwordError.value = null

  try {
    const authClient = (connectionStore.client as any)?.authClient
    if (!authClient) {
      throw new Error('Not connected to device')
    }

    await authClient.changePassword(oldPassword.value, newPassword.value)

    await dialog.alert(
      isConsumerMode.value
        ? 'Password updated! Use your new password next time you log in.'
        : 'Password changed successfully. Use your new password for future logins.',
      isConsumerMode.value ? 'Password Updated' : 'Success',
      { variant: 'success' }
    )

    // Reset form
    oldPassword.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    showPasswordChange.value = false

  } catch (error: any) {
    console.error('Password change failed:', error)
    passwordError.value = error?.message || 'Failed to change password. Please check your current password and try again.'
  } finally {
    isChangingPassword.value = false
  }
}

async function handleSetPin() {
  if (!pin.value || !confirmPin.value || !pinPassword.value) return

  if (!pinValid.value) {
    pinError.value = 'PIN must be 4-6 digits'
    return
  }

  if (!pinsMatch.value) {
    pinError.value = 'PINs do not match'
    return
  }

  isManagingPin.value = true
  pinError.value = null

  try {
    const authClient = (connectionStore.client as any)?.authClient
    if (!authClient) {
      throw new Error('Not connected to device')
    }

    await authClient.setPin(pin.value, pinPassword.value)

    await dialog.alert(
      isConsumerMode.value
        ? 'PIN set! You can now use your PIN for quick login.'
        : 'PIN configured successfully. You can now use PIN for authentication.',
      isConsumerMode.value ? 'PIN Created' : 'Success',
      { variant: 'success' }
    )

    // Reset form
    pin.value = ''
    confirmPin.value = ''
    pinPassword.value = ''
    showPinManagement.value = false
    currentPinStatus.value = 'set'

  } catch (error: any) {
    console.error('PIN setup failed:', error)
    pinError.value = error?.message || 'Failed to set PIN. Please check your password and try again.'
  } finally {
    isManagingPin.value = false
  }
}

async function handleRemovePin() {
  const confirmed = await dialog.confirm(
    isConsumerMode.value
      ? 'Remove your PIN? You\'ll need to use your password to log in instead.'
      : 'Remove PIN authentication? You will need to use password for login.',
    isConsumerMode.value ? 'Remove PIN?' : 'Confirm Removal',
    { variant: 'warning' }
  )

  if (!confirmed) return

  if (!pinPassword.value) {
    pinError.value = 'Password required to remove PIN'
    return
  }

  isManagingPin.value = true
  pinError.value = null

  try {
    const authClient = (connectionStore.client as any)?.authClient
    if (!authClient) {
      throw new Error('Not connected to device')
    }

    await authClient.removePin(pinPassword.value)

    await dialog.alert(
      isConsumerMode.value
        ? 'PIN removed. You\'ll use your password to log in from now on.'
        : 'PIN removed successfully. Use password for authentication.',
      isConsumerMode.value ? 'PIN Removed' : 'Success',
      { variant: 'success' }
    )

    // Reset form
    pin.value = ''
    confirmPin.value = ''
    pinPassword.value = ''
    showPinManagement.value = false
    currentPinStatus.value = 'none'

  } catch (error: any) {
    console.error('PIN removal failed:', error)
    pinError.value = error?.message || 'Failed to remove PIN. Please check your password and try again.'
  } finally {
    isManagingPin.value = false
  }
}
</script>

<template>
  <div class="security-settings">
    <div class="settings-section">
      <h3>{{ isConsumerMode ? '🔐 Security Settings' : 'Security' }}</h3>
      <p class="section-description">
        {{ isConsumerMode
          ? 'Manage your password and PIN for logging in'
          : 'Manage authentication credentials and security settings'
        }}
      </p>

      <!-- Change Password Card -->
      <div class="setting-card">
        <div class="setting-header">
          <div class="setting-info">
            <h4>{{ isConsumerMode ? 'Change Password' : 'Update Password' }}</h4>
            <p>{{ isConsumerMode ? 'Update your login password' : 'Change your account password' }}</p>
          </div>
          <button
            class="btn btn-outline btn-sm"
            @click="showPasswordChange = !showPasswordChange"
          >
            {{ showPasswordChange ? 'Cancel' : 'Change' }}
          </button>
        </div>

        <div v-if="showPasswordChange" class="setting-content">
          <form @submit.prevent="handlePasswordChange" class="security-form">
            <div class="form-group">
              <label for="oldPassword">{{ isConsumerMode ? 'Current Password' : 'Old Password' }}</label>
              <div class="input-with-toggle">
                <input
                  id="oldPassword"
                  v-model="oldPassword"
                  :type="showOldPassword ? 'text' : 'password'"
                  placeholder="Enter current password"
                  :disabled="isChangingPassword"
                  required
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  @click="showOldPassword = !showOldPassword"
                >
                  {{ showOldPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="newPassword">{{ isConsumerMode ? 'New Password' : 'New Password' }}</label>
              <div class="input-with-toggle">
                <input
                  id="newPassword"
                  v-model="newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  placeholder="At least 8 characters"
                  :disabled="isChangingPassword"
                  required
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  @click="showNewPassword = !showNewPassword"
                >
                  {{ showNewPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <small class="form-hint" :class="{ 'hint-error': newPassword.length > 0 && !passwordValid }">
                {{ passwordValid || newPassword.length === 0 ? 'Minimum 8 characters' : '⚠️ Too short' }}
              </small>
            </div>

            <div class="form-group">
              <label for="confirmNewPassword">{{ isConsumerMode ? 'Confirm New Password' : 'Confirm Password' }}</label>
              <input
                id="confirmNewPassword"
                v-model="confirmNewPassword"
                :type="showNewPassword ? 'text' : 'password'"
                placeholder="Re-enter new password"
                :disabled="isChangingPassword"
                required
              />
              <small class="form-hint" :class="{ 'hint-error': confirmNewPassword.length > 0 && !passwordsMatch }">
                {{ passwordsMatch || confirmNewPassword.length === 0 ? 'Must match above' : '⚠️ Does not match' }}
              </small>
            </div>

            <div v-if="passwordError" class="error-message">
              <span>⚠️ {{ passwordError }}</span>
            </div>

            <div class="form-actions">
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isChangingPassword || !oldPassword || !newPassword || !confirmNewPassword || !passwordValid || !passwordsMatch"
              >
                <span v-if="!isChangingPassword">{{ isConsumerMode ? 'Update Password' : 'Change Password' }}</span>
                <span v-else>Updating...</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- PIN Management Card (Consumer Mode) -->
      <div v-if="isConsumerMode" class="setting-card">
        <div class="setting-header">
          <div class="setting-info">
            <h4>PIN Login</h4>
            <p>{{ currentPinStatus === 'set' ? 'Quick login with 4-6 digit PIN' : 'Set up quick PIN login' }}</p>
          </div>
          <button
            class="btn btn-outline btn-sm"
            @click="showPinManagement = !showPinManagement"
          >
            {{ showPinManagement ? 'Cancel' : currentPinStatus === 'set' ? 'Manage' : 'Set Up' }}
          </button>
        </div>

        <div v-if="showPinManagement" class="setting-content">
          <form @submit.prevent="handleSetPin" class="security-form">
            <div class="form-group">
              <label for="pin">{{ currentPinStatus === 'set' ? 'New PIN' : 'Create PIN' }}</label>
              <input
                id="pin"
                v-model="pin"
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="4-6 digits"
                :disabled="isManagingPin"
                maxlength="6"
                required
              />
              <small class="form-hint" :class="{ 'hint-error': pin.length > 0 && !pinValid }">
                {{ pinValid || pin.length === 0 ? '4-6 digit numbers' : '⚠️ Invalid PIN' }}
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
                :disabled="isManagingPin"
                maxlength="6"
                required
              />
              <small class="form-hint" :class="{ 'hint-error': confirmPin.length > 0 && !pinsMatch }">
                {{ pinsMatch || confirmPin.length === 0 ? 'Must match above' : '⚠️ Does not match' }}
              </small>
            </div>

            <div class="form-group">
              <label for="pinPassword">Your Password</label>
              <div class="input-with-toggle">
                <input
                  id="pinPassword"
                  v-model="pinPassword"
                  :type="showPinPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  :disabled="isManagingPin"
                  required
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  @click="showPinPassword = !showPinPassword"
                >
                  {{ showPinPassword ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <small class="form-hint">Required to verify it's you</small>
            </div>

            <div v-if="pinError" class="error-message">
              <span>⚠️ {{ pinError }}</span>
            </div>

            <div class="form-actions">
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isManagingPin || !pin || !confirmPin || !pinPassword || !pinValid || !pinsMatch"
              >
                <span v-if="!isManagingPin">{{ currentPinStatus === 'set' ? 'Update PIN' : 'Set PIN' }}</span>
                <span v-else>Saving...</span>
              </button>

              <button
                v-if="currentPinStatus === 'set'"
                type="button"
                class="btn btn-outline btn-danger"
                :disabled="isManagingPin"
                @click="handleRemovePin"
              >
                Remove PIN
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="security-note">
        <span class="note-icon">💡</span>
        <div class="note-content">
          <strong>{{ isConsumerMode ? 'Security Tip' : 'Important' }}</strong>
          <p>
            {{ isConsumerMode
              ? 'Keep your password safe and choose a PIN that\'s easy to remember but hard to guess.'
              : 'Use strong passwords and keep your credentials secure. If you lose access, physical device reset is required.'
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.security-settings {
  max-width: 800px;
}

.settings-section {
  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: $dark;
    margin: 0 0 0.5rem;
  }

  .section-description {
    color: $grey-6;
    margin: 0 0 1.5rem;
    font-size: 0.95rem;
  }
}

.setting-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  .setting-info {
    flex: 1;

    h4 {
      font-size: 1.1rem;
      font-weight: 600;
      color: $dark;
      margin: 0 0 0.25rem;
    }

    p {
      font-size: 0.9rem;
      color: $grey-6;
      margin: 0;
    }
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
}

.setting-content {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.security-form {
  .form-group {
    margin-bottom: 1.25rem;

    label {
      display: block;
      font-weight: 600;
      color: $dark;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
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
    }

    .form-hint {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: $grey-6;

      &.hint-error {
        color: #dc2626;
        font-weight: 600;
      }
    }
  }

  .input-with-toggle {
    position: relative;
    display: flex;
    align-items: center;

    input {
      padding-right: 3rem;
    }

    .toggle-visibility {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }
  }

  .error-message {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    color: #c00;
    font-size: 0.9rem;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;

    .btn {
      flex: 1;
    }

    .btn-danger {
      color: #dc2626;
      border-color: #dc2626;

      &:hover:not(:disabled) {
        background: #dc2626;
        color: white;
      }
    }
  }
}

.security-note {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  margin-top: 1.5rem;

  .note-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .note-content {
    flex: 1;

    strong {
      display: block;
      font-weight: 600;
      color: $dark;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      font-size: 0.9rem;
      color: $grey-6;
      line-height: 1.5;
    }
  }
}

@media (max-width: 640px) {
  .setting-header {
    flex-direction: column;
    align-items: flex-start;

    .btn-sm {
      align-self: stretch;
    }
  }

  .security-form .form-actions {
    flex-direction: column;
  }
}
</style>
