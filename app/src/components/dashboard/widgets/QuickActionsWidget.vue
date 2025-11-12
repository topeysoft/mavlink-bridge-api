<template>
  <q-card class="widget quick-actions-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Quick Actions</div>
      <q-space />
      <q-btn
        v-if="editMode"
        flat
        round
        dense
        icon="close"
        size="sm"
        @click="$emit('remove', widgetId)"
      />
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="widget-content">
      <div class="actions-grid">
        <!-- Arm/Disarm -->
        <q-btn
          :color="telemetryStore.armed ? 'negative' : 'positive'"
          :icon="telemetryStore.armed ? 'lock' : 'lock_open'"
          :label="telemetryStore.armed ? 'Disarm' : 'Arm'"
          @click="toggleArm"
          :loading="armLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Mode Selection -->
        <q-btn-dropdown
          color="primary"
          icon="flight"
          :label="`Mode: ${telemetryStore.flightMode}`"
          unelevated
          class="action-btn"
        >
          <q-list>
            <q-item
              v-for="mode in flightModes"
              :key="mode.value"
              clickable
              v-close-popup
              @click="setMode(mode.value)"
            >
              <q-item-section avatar>
                <q-icon :name="mode.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ mode.label }}</q-item-label>
                <q-item-label caption>{{ mode.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        
        <!-- RTL -->
        <q-btn
          color="warning"
          icon="home"
          label="Return Home"
          @click="returnToLaunch"
          :loading="rtlLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Land -->
        <q-btn
          color="accent"
          icon="flight_land"
          label="Land"
          @click="land"
          :loading="landLoading"
          unelevated
          class="action-btn"
        />
        
        <!-- Pause -->
        <q-btn
          color="grey-7"
          icon="pause"
          label="Pause"
          @click="pause"
          unelevated
          class="action-btn"
        />
        
        <!-- Resume -->
        <q-btn
          color="secondary"
          icon="play_arrow"
          label="Resume"
          @click="resume"
          unelevated
          class="action-btn"
        />
      </div>
      
      <!-- Status Messages -->
      <q-banner
        v-if="statusMessage"
        :class="`bg-${statusType} text-white q-mt-md`"
        rounded
        dense
      >
        {{ statusMessage }}
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import { useQuasar } from 'quasar';
import { useTelemetryStore } from '@/stores/telemetry';
import { useActivityStore } from '@/stores/activity';
import { apiClient } from '@/services/api/client';

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const $q = useQuasar();
const editMode = inject('dashboardEditMode', false);
const telemetryStore = useTelemetryStore();
const activityStore = useActivityStore();

// Loading states
const armLoading = ref(false);
const rtlLoading = ref(false);
const landLoading = ref(false);

// Status message
const statusMessage = ref('');
const statusType = ref('info');

// Flight modes
const flightModes = [
  { value: 0, label: 'Stabilize', icon: 'balance', description: 'Manual control with auto-leveling' },
  { value: 3, label: 'Auto', icon: 'play_circle', description: 'Follow mission waypoints' },
  { value: 4, label: 'Guided', icon: 'navigation', description: 'Computer controlled mode' },
  { value: 5, label: 'Loiter', icon: 'loop', description: 'Hold position' },
  { value: 6, label: 'RTL', icon: 'home', description: 'Return to launch' },
  { value: 9, label: 'Land', icon: 'flight_land', description: 'Automatic landing' },
  { value: 19, label: 'Manual', icon: 'sports_esports', description: 'Full manual control' }
];

// Actions
async function toggleArm() {
  armLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    if (telemetryStore.armed) {
      await client.mavlink.disarm();
      showStatus('Vehicle disarmed', 'positive');
      activityStore.logCommand('Vehicle disarmed');
    } else {
      // Confirm arming
      $q.dialog({
        title: 'Confirm Arming',
        message: 'Are you sure you want to arm the vehicle?',
        cancel: true,
        persistent: true
      }).onOk(async () => {
        try {
          await client.mavlink.arm();
          showStatus('Vehicle armed - Be careful!', 'warning');
          activityStore.logCommand('Vehicle armed');
        } catch (error) {
          showStatus(`Arm failed: ${(error as Error).message}`, 'negative');
          activityStore.logError(`Arm command failed: ${(error as Error).message}`);
        }
      });
    }
  } catch (error) {
    showStatus(`Command failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`Arm/disarm command failed: ${(error as Error).message}`);
  } finally {
    armLoading.value = false;
  }
}

async function setMode(mode: number) {
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    await client.mavlink.setMode(mode);
    const modeName = flightModes.find(m => m.value === mode)?.label;
    showStatus(`Mode changed to ${modeName}`, 'positive');
    activityStore.logCommand(`Flight mode changed to ${modeName}`);
  } catch (error) {
    showStatus(`Mode change failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`Mode change failed: ${(error as Error).message}`);
  }
}

async function returnToLaunch() {
  rtlLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    await client.mavlink.returnToLaunch();
    showStatus('Returning to launch position', 'positive');
    activityStore.logCommand('Return to launch initiated');
  } catch (error) {
    showStatus(`RTL failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`RTL failed: ${(error as Error).message}`);
  } finally {
    rtlLoading.value = false;
  }
}

async function land() {
  landLoading.value = true;
  
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    await client.mavlink.land();
    showStatus('Landing initiated', 'positive');
    activityStore.logCommand('Landing sequence initiated');
  } catch (error) {
    showStatus(`Land failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`Land command failed: ${(error as Error).message}`);
  } finally {
    landLoading.value = false;
  }
}

async function pause() {
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    await client.mavlink.commandLong({
      command: 252, // MAV_CMD_OVERRIDE_GOTO
      param1: 1,    // Pause
      param2: 0     // Hold position
    });
    showStatus('Mission paused', 'info');
    activityStore.logCommand('Mission paused');
  } catch (error) {
    showStatus(`Pause failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`Pause command failed: ${(error as Error).message}`);
  }
}

async function resume() {
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    await client.mavlink.commandLong({
      command: 252, // MAV_CMD_OVERRIDE_GOTO
      param1: 0,    // Resume
      param2: 0
    });
    showStatus('Mission resumed', 'positive');
    activityStore.logCommand('Mission resumed');
  } catch (error) {
    showStatus(`Resume failed: ${(error as Error).message}`, 'negative');
    activityStore.logError(`Resume command failed: ${(error as Error).message}`);
  }
}

function showStatus(message: string, type: string) {
  statusMessage.value = message;
  statusType.value = type;
  
  setTimeout(() => {
    statusMessage.value = '';
  }, 5000);
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.quick-actions-widget {
  .widget-content {
    padding: 16px;
  }
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.action-btn {
  height: 48px;
  font-size: 0.875rem;
  
  :deep(.q-btn__content) {
    flex-direction: column;
    gap: 4px;
    
    .q-icon {
      font-size: 20px;
    }
  }
}
</style>