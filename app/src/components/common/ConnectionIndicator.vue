<template>
  <div class="connection-indicator">
    <q-btn
      flat
      dense
      round
      :icon="connectionIcon"
      :color="connectionColor"
      @click="showDetails = true"
    >
      <q-tooltip>
        {{ tooltipText }}
      </q-tooltip>
    </q-btn>
    
    <!-- Connection Details Popup -->
    <q-dialog v-model="showDetails">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Connection Details</div>
        </q-card-section>
        
        <q-separator />
        
        <q-card-section>
          <q-list>
            <q-item>
              <q-item-section avatar>
                <q-icon name="router" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Device</q-item-label>
                <q-item-label caption>
                  {{ deviceName }}
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="link" />
              </q-item-section>
              <q-item-section>
                <q-item-label>URL</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.connectionUrl }}
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="wifi" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Signal Strength</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.signalStrength }} dBm
                </q-item-label>
              </q-item-section>
            </q-item>
            
            <q-item v-if="connectionStore.isConnected">
              <q-item-section avatar>
                <q-icon name="speed" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Latency</q-item-label>
                <q-item-label caption>
                  {{ connectionStore.latency }} ms
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        
        <q-separator />
        
        <q-card-actions align="right">
          <q-btn
            v-if="!connectionStore.isConnected"
            flat
            color="primary"
            label="Connect"
            @click="goToConnection"
          />
          <q-btn
            v-else
            flat
            color="negative"
            label="Disconnect"
            @click="disconnect"
          />
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useConnectionStore } from '@/stores/connection';

const router = useRouter();
const connectionStore = useConnectionStore();

const showDetails = ref(false);

const connectionIcon = computed(() => {
  if (connectionStore.isConnecting) return 'pending';
  if (connectionStore.isConnected) {
    switch (connectionStore.connectionQuality) {
      case 'excellent': return 'signal_wifi_4_bar';
      case 'good': return 'signal_wifi_4_bar';
      case 'fair': return 'network_wifi_2_bar';
      case 'poor': return 'network_wifi_1_bar';
      default: return 'signal_wifi_0_bar';
    }
  }
  return 'signal_wifi_off';
});

const connectionColor = computed(() => {
  if (connectionStore.isConnecting) return 'warning';
  if (connectionStore.isConnected) return 'positive';
  return 'grey-6';
});

const deviceName = computed(() => {
  if (connectionStore.currentDevice?.name) {
    return connectionStore.currentDevice.name;
  }
  if (connectionStore.currentDevice?.ip) {
    return connectionStore.currentDevice.ip;
  }
  return 'Not connected';
});

const tooltipText = computed(() => {
  if (connectionStore.isConnecting) return 'Connecting...';
  if (connectionStore.isConnected) {
    return `Connected to ${deviceName.value}`;
  }
  return 'Not connected';
});

function goToConnection() {
  showDetails.value = false;
  router.push('/connection');
}

function disconnect() {
  connectionStore.disconnect();
  showDetails.value = false;
}
</script>

<style lang="scss" scoped>
.connection-indicator {
  display: flex;
  align-items: center;
}
</style>