<script setup lang="ts">
import { useConnectionStore } from '@/stores/connection'
import DeviceDiscoveryCard from './DeviceDiscoveryCard.vue'
import SavedDevicesList from './SavedDevicesList.vue'

const connectionStore = useConnectionStore()
</script>

<template>
  <div class="connection-container">
    <div class="connection-card">
      <!-- Header -->
      <div class="connection-header">
        <div class="logo">
          <div class="logo-icon">🔌</div>
          <h1>Connect to Your Device</h1>
        </div>
        <p class="subtitle">
          Discover and connect to your YardRover to get started
        </p>
      </div>

      <div class="connection-content">
        <!-- Device Discovery -->
        <DeviceDiscoveryCard />

        <!-- Saved Devices -->
        <SavedDevicesList v-if="connectionStore.savedDevices.length > 0" />

        <!-- Help Section -->
        <div class="help-section">
          <h3>Need Help?</h3>
          <ul>
            <li>Make sure your YardRover device is powered on</li>
            <li>Ensure you're connected to the same network as your device</li>
            <li>Check that the device's WiFi or Ethernet is properly configured</li>
            <li>If using manual connection, verify the IP address or hostname</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
@use '@/assets/styles/mixins' as *;
@use 'sass:color';

.connection-container {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.connection-card {
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  width: 100%;
}

.connection-header {
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

.connection-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: 2rem;
}

.help-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;

  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      padding: var(--spacing-sm) 0;
      color: var(--text-secondary);
      font-size: 0.95rem;
      line-height: 1.6;
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-sm);

      &:before {
        content: '•';
        color: var(--primary-green);
        font-weight: bold;
        font-size: var(--font-size-lg);
      }
    }
  }
}

@include mobile {
  .connection-header {
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

  .connection-content {
    padding: 1.5rem;
  }
}
</style>
