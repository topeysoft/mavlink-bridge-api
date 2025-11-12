<template>
  <q-dialog
    v-model="showDialog"
    persistent
    maximized
    class="emergency-stop-dialog"
  >
    <q-card class="emergency-stop-card">
      <q-card-section class="emergency-header">
        <div class="emergency-content">
          <q-icon name="emergency" size="80px" color="white" class="emergency-icon" />
          <h1 class="emergency-title">EMERGENCY STOP</h1>
          <p class="emergency-subtitle">All operations will be immediately halted</p>
        </div>
      </q-card-section>
      
      <q-card-section class="emergency-actions">
        <div class="actions-container">
          <!-- Emergency Stop Button -->
          <q-btn
            size="xl"
            color="negative"
            icon="stop"
            label="EMERGENCY STOP"
            @click="executeEmergencyStop"
            :loading="stopping"
            class="emergency-button"
            no-caps
          />
          
          <!-- Cancel Button -->
          <q-btn
            size="lg"
            outline
            color="white"
            label="Cancel"
            @click="cancel"
            :disable="stopping"
            class="cancel-button"
            no-caps
          />
        </div>
        
        <!-- Warning Messages -->
        <div class="warning-messages">
          <div class="warning-item">
            <q-icon name="warning" color="amber" />
            <span>This will immediately stop all motors and autonomous operations</span>
          </div>
          <div class="warning-item">
            <q-icon name="info" color="light-blue" />
            <span>The vehicle may drop if currently in flight</span>
          </div>
          <div class="warning-item">
            <q-icon name="priority_high" color="orange" />
            <span>Manual recovery may be required after emergency stop</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useTelemetryStore } from '@/stores/telemetry';
import { useActivityStore } from '@/stores/activity';
import { apiClient } from '@/services/api/client';

const props = defineProps<{
  modelValue?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const $q = useQuasar();
const telemetryStore = useTelemetryStore();
const activityStore = useActivityStore();

const stopping = ref(false);

const showDialog = computed({
  get: () => props.modelValue || false,
  set: (value: boolean) => {
    emit('update:modelValue', value);
    if (!value) emit('close');
  }
});

async function executeEmergencyStop() {
  stopping.value = true;
  
  try {
    const client = apiClient.getClient();
    if (!client) {
      throw new Error('No connection to device');
    }
    
    // Send multiple emergency commands
    await Promise.all([
      // Emergency disarm
      client.mavlink.disarm(),
      
      // Emergency mode change
      client.mavlink.setMode(19), // Manual mode
      
      // Kill switch
      client.mavlink.commandLong({
        command: 400, // MAV_CMD_COMPONENT_ARM_DISARM
        param1: 0,    // Disarm
        param2: 21196 // Emergency disarm magic number
      }),
      
      // Override RC
      client.mavlink.commandLong({
        command: 70, // MAV_CMD_OVERRIDE_GOTO
        param1: 1,   // Override
        param2: 0    // Stop
      })
    ]);
    
    // Log emergency stop
    activityStore.addEvent({
      type: 'system',
      message: 'EMERGENCY STOP ACTIVATED - All operations halted',
      severity: 'critical'
    });
    
    // Show success notification
    $q.notify({
      type: 'negative',
      message: 'EMERGENCY STOP ACTIVATED',
      position: 'top',
      timeout: 10000,
      actions: [
        { label: 'OK', color: 'white' }
      ]
    });
    
    // Close dialog
    showDialog.value = false;
    
  } catch (error) {
    console.error('Emergency stop failed:', error);
    
    activityStore.logError(`Emergency stop failed: ${(error as Error).message}`);
    
    $q.notify({
      type: 'negative',
      message: `Emergency stop failed: ${(error as Error).message}`,
      position: 'top',
      timeout: 0,
      actions: [
        { label: 'Retry', color: 'white', handler: () => executeEmergencyStop() },
        { label: 'Cancel', color: 'white' }
      ]
    });
  } finally {
    stopping.value = false;
  }
}

function cancel() {
  showDialog.value = false;
  
  activityStore.logInfo('Emergency stop cancelled by user');
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.emergency-stop-dialog {
  :deep(.q-dialog__inner) {
    padding: 0;
  }
}

.emergency-stop-card {
  background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
  color: white;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.emergency-header {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%);
}

.emergency-content {
  text-align: center;
  max-width: 500px;
}

.emergency-icon {
  animation: pulse-emergency 1.5s infinite;
  margin-bottom: 24px;
}

.emergency-title {
  font-size: 3rem;
  font-weight: 900;
  margin: 0 0 16px 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  letter-spacing: 2px;
}

.emergency-subtitle {
  font-size: 1.5rem;
  margin: 0;
  opacity: 0.9;
  font-weight: 300;
}

.emergency-actions {
  padding: 48px 24px;
  background: rgba(0,0,0,0.2);
}

.actions-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}

.emergency-button {
  min-width: 300px;
  height: 80px;
  font-size: 1.5rem;
  font-weight: bold;
  animation: pulse-button 2s infinite;
  
  &:hover {
    animation: none;
    transform: scale(1.05);
  }
}

.cancel-button {
  min-width: 200px;
  height: 60px;
  font-size: 1.1rem;
  border-color: white;
  color: white;
  
  &:hover {
    background-color: rgba(255,255,255,0.1);
  }
}

.warning-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.1);
  border-radius: $radius-md;
  font-size: 0.95rem;
}

@keyframes pulse-emergency {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse-button {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(255, 255, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }
}

// Mobile responsive
@media (max-width: 768px) {
  .emergency-title {
    font-size: 2rem;
  }
  
  .emergency-subtitle {
    font-size: 1.2rem;
  }
  
  .emergency-button {
    min-width: 250px;
    height: 70px;
    font-size: 1.3rem;
  }
  
  .cancel-button {
    min-width: 180px;
    height: 50px;
  }
}
</style>