<template>
  <q-card class="device-card" :class="{ 'device-card--connected': isConnected }">
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon 
          name="router" 
          size="32px" 
          :color="isConnected ? 'positive' : 'primary'"
        />
        <div class="col">
          <div class="text-h6">{{ device.name || 'YardRover' }}</div>
          <div class="text-caption text-grey-7">{{ device.ip }}</div>
        </div>
        <q-chip
          v-if="device.version"
          dense
          color="grey-3"
          text-color="grey-8"
          size="sm"
        >
          v{{ device.version }}
        </q-chip>
      </div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="q-pt-sm">
      <div class="device-info">
        <div class="info-item">
          <q-icon name="memory" size="xs" color="grey-6" />
          <span>{{ device.chipModel || 'ESP32' }}</span>
        </div>
        <div v-if="device.hostname" class="info-item">
          <q-icon name="badge" size="xs" color="grey-6" />
          <span>{{ device.hostname }}</span>
        </div>
        <div v-if="device.macAddress" class="info-item">
          <q-icon name="fingerprint" size="xs" color="grey-6" />
          <span>{{ formatMacAddress(device.macAddress) }}</span>
        </div>
      </div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-actions>
      <q-btn
        v-if="!isConnected"
        flat
        color="primary"
        icon="link"
        label="Connect"
        @click="$emit('connect', device)"
        class="full-width"
      />
      <q-btn
        v-else
        flat
        color="positive"
        icon="check_circle"
        label="Connected"
        disable
        class="full-width"
      />
      
      <q-space />
      
      <q-btn
        v-if="!isSaved"
        flat
        round
        dense
        icon="bookmark_border"
        color="grey-7"
        @click="$emit('save', device)"
      >
        <q-tooltip>Save device</q-tooltip>
      </q-btn>
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { useConnectionStore } from '@/stores/connection';
import { useDevicesStore } from '@/stores/devices';

const props = defineProps<{
  device: MAVLinkBridgeDevice;
}>();

const emit = defineEmits<{
  connect: [device: MAVLinkBridgeDevice];
  save: [device: MAVLinkBridgeDevice];
}>();

const connectionStore = useConnectionStore();
const devicesStore = useDevicesStore();

const isConnected = computed(() => 
  connectionStore.isConnected && 
  connectionStore.currentDevice?.ip === props.device.ip
);

const isSaved = computed(() => 
  devicesStore.savedDevices.some(d => d.ip === props.device.ip)
);

function formatMacAddress(mac: string): string {
  return mac.replace(/(.{2})(?=.)/g, '$1:').toUpperCase();
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.device-card {
  transition: all 0.3s ease;
  height: 100%;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &--connected {
    border: 2px solid $positive;
  }
}

.device-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.875rem;
  color: $text-secondary;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .q-icon {
    opacity: 0.7;
  }
}
</style>