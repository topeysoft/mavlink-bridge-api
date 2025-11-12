<template>
  <q-card class="connection-status" :class="`status--${connectionStore.connectionStatus}`">
    <q-card-section>
      <div class="row items-center q-gutter-md">
        <!-- Status Icon -->
        <div class="status-icon">
          <q-spinner-rings
            v-if="connectionStore.isConnecting"
            color="primary"
            size="48px"
          />
          <q-icon
            v-else
            :name="statusIcon"
            :color="statusColor"
            size="48px"
          />
        </div>
        
        <!-- Status Info -->
        <div class="col">
          <div class="text-h6">{{ statusTitle }}</div>
          <div class="text-body2 text-grey-7">{{ statusMessage }}</div>
          
          <!-- Connection Details -->
          <div v-if="connectionStore.isConnected" class="q-mt-sm">
            <q-chip
              dense
              color="grey-3"
              text-color="grey-8"
              icon="wifi"
              size="sm"
            >
              {{ connectionStore.signalStrength }} dBm
            </q-chip>
            <q-chip
              dense
              color="grey-3"
              text-color="grey-8"
              icon="speed"
              size="sm"
              class="q-ml-sm"
            >
              {{ connectionStore.latency }} ms
            </q-chip>
          </div>
        </div>
        
        <!-- Connection Quality -->
        <div v-if="connectionStore.isConnected" class="text-center">
          <q-circular-progress
            :value="signalQuality"
            size="60px"
            :thickness="0.2"
            :color="qualityColor"
            track-color="grey-3"
            show-value
          />
          <div class="text-caption text-grey-7 q-mt-xs">Signal Quality</div>
        </div>
      </div>
      
      <!-- Error Message -->
      <q-banner
        v-if="connectionStore.errorMessage"
        class="bg-negative text-white q-mt-md"
        rounded
        dense
      >
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        {{ connectionStore.errorMessage }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnectionStore } from '@/stores/connection';

const connectionStore = useConnectionStore();

const statusIcon = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': return 'check_circle';
    case 'connecting': return 'pending';
    case 'error': return 'error';
    default: return 'link_off';
  }
});

const statusColor = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': return 'positive';
    case 'connecting': return 'primary';
    case 'error': return 'negative';
    default: return 'grey-6';
  }
});

const statusTitle = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': 
      return `Connected to ${connectionStore.currentDevice?.name || 'YardRover'}`;
    case 'connecting': 
      return 'Connecting...';
    case 'error': 
      return 'Connection Error';
    default: 
      return 'Not Connected';
  }
});

const statusMessage = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected': 
      return `Connected via ${connectionStore.connectionUrl}`;
    case 'connecting': 
      return 'Establishing connection to device...';
    case 'error': 
      return 'Failed to connect to device';
    default: 
      return 'Connect to a YardRover device to get started';
  }
});

const signalQuality = computed(() => {
  const rssi = connectionStore.signalStrength;
  if (rssi >= -50) return 100;
  if (rssi >= -60) return 80;
  if (rssi >= -70) return 60;
  if (rssi >= -80) return 40;
  return 20;
});

const qualityColor = computed(() => {
  const quality = signalQuality.value;
  if (quality >= 80) return 'positive';
  if (quality >= 60) return 'warning';
  return 'negative';
});
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.connection-status {
  &.status--connected {
    border-left: 4px solid $positive;
  }
  
  &.status--connecting {
    border-left: 4px solid $primary;
  }
  
  &.status--error {
    border-left: 4px solid $negative;
  }
  
  &.status--disconnected {
    border-left: 4px solid $grey-6;
  }
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: rgba($primary, 0.1);
}
</style>