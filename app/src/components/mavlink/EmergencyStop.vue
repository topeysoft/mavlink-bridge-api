<template>
  <q-card class="emergency-stop-card">
    <q-card-section class="text-center">
      <div class="text-h6 text-negative q-mb-md">
        EMERGENCY STOP
      </div>
      
      <q-btn
        round
        color="negative"
        size="80px"
        @click="triggerEmergencyStop"
        :loading="stopping"
        class="emergency-button"
      >
        <q-icon name="mdi-hand-front-right" size="40px" />
      </q-btn>
      
      <div class="text-caption text-grey-7 q-mt-md">
        Press to immediately stop all motors
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkStore } from '../../stores/mavlink'

const $q = useQuasar()
const mavlinkStore = useMAVLinkStore()

const stopping = ref(false)

function triggerEmergencyStop() {
  $q.dialog({
    title: 'EMERGENCY STOP',
    message: 'This will immediately stop all motors. Continue?',
    cancel: true,
    persistent: true,
    color: 'negative',
    ok: {
      label: 'STOP MOTORS',
      color: 'negative',
      unelevated: true
    }
  }).onOk(() => {
    void (async () => {
      stopping.value = true
    
    try {
      await mavlinkStore.emergencyStop()
      
      $q.notify({
        type: 'warning',
        message: 'EMERGENCY STOP ACTIVATED',
        caption: 'All motors have been stopped',
        position: 'center',
        timeout: 0,
        actions: [
          { label: 'OK', color: 'white' }
        ]
      })
    } catch (error: unknown) {
      $q.notify({
        type: 'negative',
        message: 'Emergency stop failed!',
        caption: error instanceof Error ? error.message : 'Unknown error',
        position: 'center'
      })
    } finally {
      stopping.value = false
    }
    })()
  })
}
</script>

<style lang="scss" scoped>
.emergency-stop-card {
  border: 2px solid $negative;
}

.emergency-button {
  box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(255, 0, 0, 0.4);
  }
  
  &:active {
    transform: scale(0.95);
  }
}
</style>