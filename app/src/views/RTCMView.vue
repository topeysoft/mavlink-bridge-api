<template>
  <div class="rtcm-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-content">
        <h1>{{ featuresStore.userMode === 'consumer' ? 'GPS Boost' : 'RTK Positioning' }}</h1>
        <p class="subtitle">
          {{ featuresStore.userMode === 'consumer'
            ? 'Get pinpoint accuracy for your YardRover'
            : 'Real-Time Kinematic GPS corrections for centimeter-level accuracy'
          }}
        </p>
      </div>

      <!-- Mode Toggle (for power-user and developer only) -->
      <div v-if="featuresStore.userMode !== 'consumer'" class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: mode === 'simple' }"
          @click="mode = 'simple'"
        >
          <span class="mode-icon">🎯</span>
          Simple
        </button>
        <button
          class="mode-btn"
          :class="{ active: mode === 'advanced' }"
          @click="mode = 'advanced'"
        >
          <span class="mode-icon">⚙️</span>
          Advanced
        </button>
      </div>
    </div>

    <!-- Connection Warning -->
    <div v-if="!connectionStore.isConnected" class="alert alert-warning">
      <span class="alert-icon">⚠️</span>
      <div>
        <strong>Not Connected</strong>
        <p>Please connect to your YardRover device first.</p>
      </div>
      <router-link to="/connection" class="btn btn-primary btn-sm">
        Go to Connection
      </router-link>
    </div>

    <!-- Error Display -->
    <div v-if="rtcmStore.hasError" class="alert alert-danger">
      <span class="alert-icon">❌</span>
      <div>
        <strong>Error</strong>
        <p>{{ rtcmStore.lastError }}</p>
      </div>
      <button class="btn btn-sm btn-ghost" @click="rtcmStore.clearError">
        Dismiss
      </button>
    </div>

    <!-- Content -->
    <div class="view-content">
      <!-- Consumer Mode: Wizard Only -->
      <RTCMWizard v-if="featuresStore.userMode === 'consumer'" />

      <!-- Power User / Developer: Simple/Advanced Toggle -->
      <KeepAlive v-else>
        <SimpleRTCMSetup v-if="mode === 'simple'" />
        <AdvancedRTCMPanel v-else />
      </KeepAlive>
    </div>

    <!-- Info Footer (for power-user and developer only) -->
    <div v-if="featuresStore.userMode !== 'consumer'" class="info-footer">
      <div class="info-section">
        <h4>About RTK</h4>
        <p>
          RTK (Real-Time Kinematic) positioning uses correction data from a nearby reference
          station to achieve centimeter-level GPS accuracy. This is essential for precision
          navigation tasks like automated mowing patterns.
        </p>
      </div>

      <div class="info-section">
        <h4>How it Works</h4>
        <ol>
          <li>Connect to an NTRIP caster or RTCM correction source</li>
          <li>Receive real-time correction data</li>
          <li>YardRover applies corrections to GPS signals</li>
          <li>Achieve 1-2cm positioning accuracy (RTK Fix)</li>
        </ol>
      </div>

      <div class="info-section">
        <h4>Requirements</h4>
        <ul>
          <li>Internet connection (for NTRIP)</li>
          <li>RTK-capable GPS receiver on YardRover</li>
          <li>Base station within 10-30km (for best accuracy)</li>
          <li>Clear sky view for GPS signals</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRTCMStore } from '@/stores/rtcm'
import { useConnectionStore } from '@/stores/connection'
import { useFeaturesStore } from '@/stores/features'
import RTCMWizard from '@/components/rtcm/RTCMWizard.vue'
import SimpleRTCMSetup from '@/components/rtcm/SimpleRTCMSetup.vue'
import AdvancedRTCMPanel from '@/components/rtcm/AdvancedRTCMPanel.vue'

const rtcmStore = useRTCMStore()
const connectionStore = useConnectionStore()
const featuresStore = useFeaturesStore()

// Mode selection - could be persisted to localStorage
const mode = ref<'simple' | 'advanced'>('simple')

// Load user's preferred mode from settings if available
const savedMode = localStorage.getItem('yardrover_rtcm_mode')
if (savedMode === 'advanced' || savedMode === 'simple') {
  mode.value = savedMode
}

// Save mode preference when it changes
function saveMode() {
  localStorage.setItem('yardrover_rtcm_mode', mode.value)
}

// Watch for mode changes
const unwatchMode = watch(() => mode.value, saveMode)

onMounted(async () => {
  // Refresh RTCM status when view is mounted
  if (connectionStore.isConnected) {
    await rtcmStore.refreshStatus()
  }
})

onUnmounted(() => {
  // Cleanup
  unwatchMode()
})

// Import watch from vue
import { watch } from 'vue'
</script>

<style scoped lang="scss">
.rtcm-view {
  min-height: 100vh;
  padding: 2rem;
  background-color: var(--bg-primary);
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-color);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

.header-content {
  h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 700;
  }

  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }
}

.mode-toggle {
  display: flex;
  gap: 0.5rem;
  background-color: var(--bg-secondary);
  padding: 0.375rem;
  border-radius: 8px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(44, 95, 45, 0.1);
    color: var(--primary-green);
  }

  &.active {
    background-color: var(--primary-green);
    color: white;
  }
}

.mode-icon {
  font-size: 1.25rem;
}

.alert {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  background-color: #fff3cd;
  border-left: 4px solid var(--status-warning);

  &.alert-danger {
    background-color: #f8d7da;
    border-left-color: var(--status-danger);
  }
}

.alert-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.alert {
  div {
    flex: 1;

    strong {
      display: block;
      margin-bottom: 0.25rem;
      color: var(--text-primary);
    }

    p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
  }
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background-color: var(--primary-green);
  color: white;

  &:hover:not(:disabled) {
    background-color: var(--primary-green-dark);
  }
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-ghost {
  background: none;
  border: 1px solid transparent;
  color: var(--text-secondary);

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-color);
  }
}

.view-content {
  margin-bottom: 3rem;
}

.info-footer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  margin-top: 3rem;
}

.info-section {
  h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.125rem;
  }

  p, ol, ul {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.6;
  }

  ol, ul {
    padding-left: 1.5rem;

    li {
      margin-bottom: 0.5rem;
    }
  }

  ol {
    list-style-type: decimal;
  }

  ul {
    list-style-type: disc;
  }
}

/* Smooth transitions for mode switching */
.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
