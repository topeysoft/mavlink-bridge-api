<template>
  <footer class="app-footer">
    <div class="app-footer__content">
      <!-- Left section - Copyright -->
      <div class="app-footer__left">
        <div class="app-footer__copyright">
          © {{ currentYear }} YardRover. All rights reserved.
        </div>
      </div>

      <!-- Center section - Status indicators (optional) -->
      <div class="app-footer__center">
        <div v-if="showSystemStatus" class="app-footer__status">
          <q-chip
            :color="systemStatusColor"
            text-color="white"
            size="xs"
            dense
            class="app-footer__status-chip"
          >
            <q-icon :name="systemStatusIcon" left size="12px" />
            {{ systemStatusText }}
          </q-chip>
        </div>
      </div>

      <!-- Right section - Links and version -->
      <div class="app-footer__right">
        <div class="app-footer__links">
          <a href="#" class="app-footer__link" @click.prevent="openPrivacyPolicy">
            Privacy Policy
          </a>
          <span class="app-footer__separator">•</span>
          <a href="#" class="app-footer__link" @click.prevent="openTermsOfService">
            Terms of Service
          </a>
          <span class="app-footer__separator">•</span>
          <a href="#" class="app-footer__link" @click.prevent="openSupport"> Support </a>
        </div>
        <div class="app-footer__version">v{{ appVersion }}</div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useSettingsStore } from '@/stores/settings'

// Composables
const router = useRouter()
const websocket = useWebSocketStore()
const settings = useSettingsStore()

// Computed properties
const currentYear = computed(() => new Date().getFullYear())
const appVersion = computed(() => '1.0.0') // TODO: Get from package.json or environment

// Show system status based on settings
const showSystemStatus = computed(() => settings.ui?.showFooterStatus ?? true)

const systemStatusColor = computed(() => {
  if (!websocket.isConnected) return 'negative'
  return 'positive'
})

const systemStatusIcon = computed(() => {
  if (!websocket.isConnected) return 'cloud_off'
  return 'cloud_done'
})

const systemStatusText = computed(() => {
  if (!websocket.isConnected) return 'Offline'
  return 'Online'
})

// Methods
const openPrivacyPolicy = () => {
  router.push({ name: 'privacy-policy' })
}

const openTermsOfService = () => {
  router.push({ name: 'terms-of-service' })
}

const openSupport = () => {
  router.push({ name: 'support' })
}
</script>

<style lang="scss" scoped>
.app-footer {
  background-color: var(--q-dark);
  color: rgba(255, 255, 255, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 48px;
  display: flex;
  align-items: center;

  .body--light & {
    background-color: #f5f5f5;
    color: rgba(0, 0, 0, 0.6);
    border-top-color: rgba(0, 0, 0, 0.1);
  }
}

.app-footer__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 16px;
  min-height: 48px;
}

.app-footer__left {
  flex: 1;
}

.app-footer__copyright {
  font-size: 0.75rem;
  font-weight: 400;
}

.app-footer__center {
  flex: 0 0 auto;
  margin: 0 16px;
}

.app-footer__status {
  display: flex;
  align-items: center;
}

.app-footer__status-chip {
  font-size: 0.65rem;
  height: 20px;
}

.app-footer__right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.app-footer__links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.app-footer__link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: var(--q-primary);
  }
}

.app-footer__separator {
  color: rgba(255, 255, 255, 0.4);

  .body--light & {
    color: rgba(0, 0, 0, 0.3);
  }
}

.app-footer__version {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);

  .body--light & {
    color: rgba(0, 0, 0, 0.4);
  }
}

// Responsive adjustments
@media (max-width: 767px) {
  .app-footer__content {
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    text-align: center;
  }

  .app-footer__left,
  .app-footer__center,
  .app-footer__right {
    flex: none;
  }

  .app-footer__right {
    align-items: center;
  }

  .app-footer__links {
    justify-content: center;
  }
}

@media (max-width: 479px) {
  .app-footer__links {
    flex-direction: column;
    gap: 4px;
  }

  .app-footer__separator {
    display: none;
  }
}

// Focus styles
.app-footer__link:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
