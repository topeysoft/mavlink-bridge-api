<template>
  <StandaloneLayout title="YardRover Setup">
    <div class="setup-container">
      <div class="setup-card">
        <!-- Header -->
        <div class="setup-header">
          <div class="logo">
            <div class="logo-icon">🚜</div>
            <h1>Welcome to YardRover</h1>
          </div>
          <p class="subtitle"
            >Let's get your autonomous yard machine configured</p
          >
        </div>

        <!-- Welcome Screen -->
        <div v-if="currentStep === 'welcome'" class="setup-welcome">
          <!-- <div class="welcome-icon">🎉</div>
          <h2>Welcome to YardRover!</h2>
          <p class="welcome-description">
            Your autonomous yard utility machine is ready for initial configuration.
          </p> -->

          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🤖</div>
              <h3>Autonomous Operation</h3>
              <p>Plan missions and let YardRover execute them automatically</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🗺️</div>
              <h3>Zone Management</h3>
              <p>Define work zones and safety boundaries for precise control</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <h3>Real-Time Monitoring</h3>
              <p>Track telemetry, GPS, battery, and system health live</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <h3>Secure Access</h3>
              <p>API key authentication with role-based permissions</p>
            </div>
          </div>

          <div class="welcome-actions">
            <button class="btn-primary" @click="startSetup">
              Get Started
            </button>
          </div>
        </div>

        <!-- Setup Form -->
        <div v-else-if="currentStep === 'configure'" class="setup-form">
          <div class="progress-indicator">
            <div class="step completed">
              <div class="step-number">✓</div>
              <div class="step-label">Welcome</div>
            </div>
            <div class="step-connector"></div>
            <div class="step active">
              <div class="step-number">2</div>
              <div class="step-label">Configure</div>
            </div>
            <div class="step-connector"></div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-label">Credentials</div>
            </div>
          </div>

          <h2>Device Configuration</h2>
          <p class="form-description">
            Let's configure your YardRover and create your admin credentials.
          </p>

          <form @submit.prevent="handleSetup">
            <div class="form-group">
              <label for="deviceName">Device Name</label>
              <input
                id="deviceName"
                v-model="deviceName"
                type="text"
                placeholder="My YardRover"
                :disabled="isSubmitting"
                maxlength="128"
                required
              />
              <small class="form-hint">
                Give your YardRover a friendly name (e.g., "Garden Rover",
                "Backyard Helper")
              </small>
            </div>

            <div class="form-group">
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
              {{ setupError }}
            </div>

            <div class="form-actions">
              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmitting || !deviceName.trim()"
              >
                <span v-if="!isSubmitting">Complete Setup</span>
                <span v-else class="loading">
                  <span class="spinner"></span>
                  Setting up...
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Success State -->
        <div v-else-if="currentStep === 'success'" class="setup-success">
          <div class="progress-indicator">
            <div class="step completed">
              <div class="step-number">✓</div>
              <div class="step-label">Welcome</div>
            </div>
            <div class="step-connector completed"></div>
            <div class="step completed">
              <div class="step-number">✓</div>
              <div class="step-label">Configure</div>
            </div>
            <div class="step-connector completed"></div>
            <div class="step completed">
              <div class="step-number">✓</div>
              <div class="step-label">Credentials</div>
            </div>
          </div>

          <div class="success-icon">✅</div>
          <h2>Setup Complete!</h2>
          <p class="success-message">
            Your YardRover is now configured and ready to use.
          </p>

          <div class="api-key-display">
            <div class="api-key-header">
              <span class="warning-icon">🔑</span>
              <strong>Your Admin API Key</strong>
            </div>
            <div class="api-key-value">
              <code>{{ generatedApiKey }}</code>
            </div>

            <div class="api-key-actions">
              <button
                class="btn-action btn-copy"
                @click="copyApiKey"
                :class="{ copied }"
              >
                <span class="action-icon">{{ copied ? '✓' : '📋' }}</span>
                <span class="action-text">{{
                  copied ? 'Copied!' : 'Copy'
                }}</span>
              </button>
              <button class="btn-action btn-download" @click="downloadApiKey">
                <span class="action-icon">💾</span>
                <span class="action-text">Download</span>
              </button>
            </div>

            <div class="api-key-warning">
              <strong>⚠️ Important:</strong> Save this API key now! It will not
              be shown again. You'll need it to log in and manage your
              YardRover.
            </div>
          </div>

          <div class="next-steps">
            <h3>Next Steps</h3>
            <ol>
              <li>Copy your API key and save it in a secure location</li>
              <li
                >Click "Continue to Login" to sign in with your new API key</li
              >
              <li>Start configuring and controlling your YardRover!</li>
            </ol>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="goToLogin"
              >Continue to Login</button
            >
          </div>
        </div>
      </div>
    </div>
  </StandaloneLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useConnectionStore } from '../stores/connection';
import StandaloneLayout from '@/layouts/StandaloneLayout.vue';

const router = useRouter();
const authStore = useAuthStore();
const connectionStore = useConnectionStore();

// State
const currentStep = ref<'welcome' | 'configure' | 'success'>('welcome');
const deviceName = ref('YardRover');
const adminKeyName = ref('Owner');
const isSubmitting = ref(false);
const setupError = ref<string | null>(null);
const setupComplete = ref(false);
const generatedApiKey = ref('');
const copied = ref(false);

// Actions
function startSetup() {
  currentStep.value = 'configure';
}

async function handleSetup() {
  if (!deviceName.value.trim()) return;

  // Check if we have a connected device
  if (!connectionStore.client) {
    setupError.value = 'No device connected. Please connect to a device first.';
    return;
  }

  isSubmitting.value = true;
  setupError.value = null;

  try {
    // Get auth client from connection
    const authClient = (connectionStore.client as any).authClient;
    if (!authClient) {
      throw new Error('Auth client not available');
    }

    // Complete setup
    const apiKey = await authStore.completeSetup(authClient, {
      device_name: deviceName.value.trim(),
      admin_key_name: adminKeyName.value.trim() || 'Owner',
      admin_key_description: 'Owner admin key created during initial setup',
    });

    // Show success
    generatedApiKey.value = apiKey;
    setupComplete.value = true;
    currentStep.value = 'success';
  } catch (error: any) {
    console.error('Setup failed:', error);

    // Provide actionable error messages
    if (
      error?.message?.includes('Network') ||
      error?.message?.includes('fetch')
    ) {
      setupError.value =
        'Connection error. Please check your connection to the device and try again.';
    } else if (
      error?.message?.includes('already configured') ||
      error?.message?.includes('not in setup mode')
    ) {
      setupError.value =
        "This device has already been configured. If you need to reconfigure it, you'll need to reset it first using physical access to the device.";
    } else if (error?.status === 400) {
      setupError.value =
        'Invalid input. Please check that your device name and admin key name are valid (1-128 characters).';
    } else {
      setupError.value =
        error instanceof Error
          ? `Setup failed: ${error.message}. Please try again or check the device logs for more information.`
          : 'Setup failed. Please try again or check the device logs for more information.';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function copyApiKey() {
  try {
    await navigator.clipboard.writeText(generatedApiKey.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy API key:', error);
  }
}

function downloadApiKey() {
  const content = `YardRover API Key
===================

Device: ${deviceName.value}
Admin: ${adminKeyName.value}
Generated: ${new Date().toISOString()}

API Key:
${generatedApiKey.value}

⚠️ IMPORTANT: Keep this key secure!
This key provides full administrative access to your YardRover device.
Do not share it with anyone you don't trust.

To use this key:
1. Navigate to the YardRover login page
2. Enter this API key in the login form
3. You will be authenticated and can access the dashboard

For help: https://github.com/your-repo/yardrover
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yardrover-api-key-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function goToLogin() {
  router.push('/login');
}

// Check if setup is already complete
onMounted(async () => {
  if (!connectionStore.client) return;

  const authClient = (connectionStore.client as any).authClient;
  if (!authClient) return;

  try {
    await authStore.checkSetupStatus(authClient);
    if (!authStore.needsSetup) {
      // Setup already complete, redirect to login
      router.push('/login');
    }
  } catch (error) {
    console.error('Failed to check setup status:', error);
  }
});
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;
@use 'sass:color';

.setup-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.setup-card {
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.setup-header {
  background: linear-gradient(
    135deg,
    $primary 0%,
    color.adjust($primary, $lightness: -10%) 100%
  );
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
    font-size: 2.25rem;
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

.setup-welcome,
.setup-form,
.setup-success {
  padding: 2rem;

  h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .form-description,
  .success-message,
  .welcome-description {
    color: var(--text-secondary);
    margin: 0 0 2rem;
    font-size: 0.95rem;
    line-height: 1.6;
  }
}

.setup-welcome {
  text-align: center;

  .welcome-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: bounce 1s ease-in-out;
  }

  .welcome-description {
    font-size: 1.05rem;
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
  text-align: left;

  .feature-item {
    background: var(--bg-secondary);
    padding: 1.25rem;
    border-radius: 12px;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-tertiary);
      transform: translateY(-2px);
    }

    .feature-icon {
      font-size: 2rem;
      margin-bottom: 0.75rem;
    }

    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.5rem;
    }

    p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.5;
    }
  }
}

.welcome-actions {
  margin-top: 2rem;

  .btn-primary {
    padding: 1rem 2.5rem;
    font-size: 1.05rem;
  }
}

.progress-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 2rem;

  .step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.4;
    transition: all 0.3s;

    &.active {
      opacity: 1;
    }

    &.completed {
      opacity: 1;

      .step-number {
        background: $positive;
      }
    }

    .step-number {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: $primary;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.3s;
    }

    .step-label {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.9rem;
    }
  }

  .step-connector {
    width: 40px;
    height: 2px;
    background: var(--border-color);
    margin: 0 0.5rem;
    position: relative;
    top: -8px;

    &.completed {
      background: $positive;
    }
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.form-group {
  margin-bottom: 1.5rem;

  label {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }

  input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    font-size: 1rem;
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
    }
  }

  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
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
  margin-top: 2rem;

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

.setup-success {
  text-align: center;

  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  h2 {
    color: $positive;
  }
}

.api-key-display {
  background: #fffbf0;
  border: 2px solid #ffe066;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;

  .api-key-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 1rem;
    color: $dark;

    .warning-icon {
      font-size: 1.5rem;
    }
  }

  .api-key-value {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    margin-bottom: 1rem;

    code {
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      color: var(--text-primary);
      word-break: break-all;
      display: block;
      line-height: 1.5;
    }
  }

  .api-key-actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;

    .btn-action {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border: 2px solid transparent;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      .action-icon {
        font-size: 1.25rem;
      }

      .action-text {
        font-size: 0.95rem;
      }

      &.btn-copy {
        background: $primary;
        color: white;

        &:hover {
          background: color.adjust($primary, $lightness: -10%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba($primary, 0.3);
        }

        &.copied {
          background: $positive;
        }
      }

      &.btn-download {
        background: var(--bg-primary);
        color: $primary;
        border-color: $primary;

        &:hover {
          background: $primary;
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba($primary, 0.2);
        }
      }
    }
  }

  .api-key-warning {
    font-size: 0.9rem;
    line-height: 1.6;
    color: #856404;

    strong {
      display: block;
      margin-bottom: 0.25rem;
    }
  }
}

.next-steps {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;

  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem;
  }

  ol {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.8;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Responsive
@media (max-width: 640px) {
  .setup-header {
    padding: 2rem 1.5rem;

    .logo {
      .logo-icon {
        font-size: 3rem;
      }

      h1 {
        font-size: 1.75rem;
      }
    }
  }

  .setup-welcome,
  .setup-form,
  .setup-success {
    padding: 1.5rem;

    h2 {
      font-size: 1.5rem;
    }
  }

  .features-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .progress-indicator {
    .step-label {
      display: none;
    }

    .step-connector {
      width: 20px;
      margin: 0 0.25rem;
    }
  }

  .api-key-display {
    .api-key-actions {
      flex-direction: column;

      .btn-action {
        width: 100%;
      }
    }
  }
}
</style>
