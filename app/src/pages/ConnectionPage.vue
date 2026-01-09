<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useConnectionOrchestrator } from '@/stores/connectionOrchestrator'
import { useFeaturesStore } from '@/stores/features'
import { useOnboardingStore } from '@/stores/onboarding'
import StandaloneLayout from '@/layouts/StandaloneLayout.vue'
import UnifiedConnectionFlow from '@/components/connection/UnifiedConnectionFlow.vue'

const router = useRouter()
const route = useRoute()
const connectionStore = useConnectionStore()
const orchestrator = useConnectionOrchestrator()
const featuresStore = useFeaturesStore()
const onboardingStore = useOnboardingStore()

const userMode = computed(() => featuresStore.userMode === 'consumer' ? 'consumer' : 'technical')

// Get the previous connection attempt result
const lastResult = computed(() => orchestrator.lastConnectionResult)

// Determine if we have a previous connection that failed
const previousConnection = computed(() => {
  if (lastResult.value && !lastResult.value.success) {
    // Find the most recent device in saved devices
    const lastDevice = connectionStore.savedDevices[0]
    if (lastDevice) {
      return lastDevice
    }
  }
  return null
})

function handleConnected(device: { name: string | null; url: string | null }) {
  console.log('[ConnectionPage] Connected to device:', device)

  // Check if there's a redirect URL
  const redirectPath = route.query.redirect as string | undefined

  if (redirectPath) {
    router.push(redirectPath)
  } else if (!onboardingStore.isOnboardingComplete) {
    router.push('/onboarding')
  } else {
    router.push('/dashboard')
  }
}

// Check if already connected on mount
onMounted(() => {
  if (connectionStore.isConnected) {
    console.log('[ConnectionPage] Already connected, redirecting...')
    const redirectPath = route.query.redirect as string | undefined
    if (redirectPath) {
      router.push(redirectPath)
    } else {
      router.push('/dashboard')
    }
  }
})
</script>

<template>
  <StandaloneLayout title="YardRover">
    <div class="connection-page">
      <!-- Context Message (if reconnect failed) -->
      <div v-if="previousConnection" class="context-banner">
        <div class="banner-icon">ℹ️</div>
        <div class="banner-content">
          <strong>Connection Issue</strong>
          <p>We couldn't automatically reconnect to <strong>{{ previousConnection.name }}</strong>. Let's try connecting again.</p>
        </div>
      </div>

      <!-- Unified Connection Flow -->
      <UnifiedConnectionFlow
        mode="standalone"
        :user-mode="userMode"
        :previous-connection="previousConnection"
        :show-header="true"
        :auto-start="false"
        @connected="handleConnected"
      />

      <!-- Help Section -->
      <div class="help-section">
        <h3>{{ userMode === 'consumer' ? 'Need Help?' : 'Connection Help' }}</h3>
        <div class="help-items">
          <div class="help-item">
            <span class="help-icon">💡</span>
            <div class="help-text">
              <strong>{{ userMode === 'consumer' ? 'Device Not Showing Up?' : 'Discovery Issues?' }}</strong>
              <p>{{ userMode === 'consumer'
                ? 'Make sure your YardRover is powered on and you\'re on the same WiFi network.'
                : 'Verify device is powered on, on same network, and mDNS/Bonjour is enabled.'
              }}</p>
            </div>
          </div>
          <div class="help-item">
            <span class="help-icon">🔌</span>
            <div class="help-text">
              <strong>{{ userMode === 'consumer' ? 'Connection Problems?' : 'Connection Failures?' }}</strong>
              <p>{{ userMode === 'consumer'
                ? 'Try moving closer to your YardRover or restarting your WiFi router.'
                : 'Check firewall settings, IP address conflicts, or network configuration.'
              }}</p>
            </div>
          </div>
          <div class="help-item">
            <span class="help-icon">📡</span>
            <div class="help-text">
              <strong>{{ userMode === 'consumer' ? 'First Time Setup?' : 'Initial Configuration?' }}</strong>
              <p>{{ userMode === 'consumer'
                ? 'Look for a WiFi network called "YardRover-XXXX" and connect to it first.'
                : 'Connect to device AP mode (YardRover-XXXX) for initial network configuration.'
              }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </StandaloneLayout>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;

.connection-page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--spacing-xl);
  width: 100%;

  @include mobile {
    padding: var(--spacing-md);
  }
}

// Context Banner
.context-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-2xl);

  .banner-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .banner-content {
    flex: 1;

    strong {
      display: block;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
      font-size: var(--font-size-base);
    }

    p {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;

      strong {
        display: inline;
        color: var(--text-primary);
      }
    }
  }

  @include mobile {
    flex-direction: column;
    text-align: center;
    align-items: center;
  }
}

// Help Section
.help-section {
  margin-top: var(--spacing-3xl);
  padding: var(--spacing-2xl);
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);

  h3 {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-xl);
    text-align: center;
  }
}

.help-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.help-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .help-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .help-text {
    flex: 1;

    strong {
      display: block;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
      font-size: var(--font-size-sm);
    }

    p {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
    }
  }

  @include mobile {
    flex-direction: column;
    text-align: center;
    align-items: center;
  }
}

@include mobile {
  .help-items {
    grid-template-columns: 1fr;
  }
}
</style>
