<template>
  <div class="global-dialogs">
    <!-- Emergency Stop Dialog -->
    <q-dialog
      v-model="showEmergencyDialog"
      persistent
      no-backdrop-dismiss
      no-esc-dismiss
      class="emergency-dialog"
    >
      <q-card class="emergency-dialog__card">
        <q-card-section class="emergency-dialog__header">
          <div class="row items-center">
            <q-icon name="warning" size="32px" color="negative" class="q-mr-md" />
            <div>
              <div class="text-h6 text-negative">Emergency Stop Activated</div>
              <div class="text-body2 text-grey-7">All machines have been stopped for safety</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">
            An emergency stop has been triggered. Please check all machines and yard conditions
            before resuming operations.
          </div>

          <div v-if="emergencyReason" class="q-mt-md">
            <div class="text-weight-medium">Reason:</div>
            <div class="text-body2">{{ emergencyReason }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Acknowledge" color="primary" @click="acknowledgeEmergency" />
          <q-btn unelevated label="Reset System" color="negative" @click="resetEmergencyStop" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Connection Lost Dialog -->
    <q-dialog
      v-model="showConnectionDialog"
      persistent
      no-backdrop-dismiss
      class="connection-dialog"
    >
      <q-card class="connection-dialog__card">
        <q-card-section class="connection-dialog__header">
          <div class="row items-center">
            <q-icon name="wifi_off" size="28px" color="warning" class="q-mr-md" />
            <div>
              <div class="text-h6 text-warning">Connection Lost</div>
              <div class="text-body2 text-grey-7">Attempting to reconnect...</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">
            The connection to the YardRover system has been lost. The system will automatically
            attempt to reconnect.
          </div>

          <div class="q-mt-md">
            <q-linear-progress :value="reconnectProgress" color="warning" class="q-mb-sm" />
            <div class="text-caption text-center">
              Reconnect attempt {{ reconnectAttempt }} of {{ maxReconnectAttempts }}
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Retry Now" color="primary" @click="retryConnection" />
          <q-btn flat label="Work Offline" @click="workOffline" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Update Available Dialog -->
    <q-dialog v-model="showUpdateDialog" class="update-dialog">
      <q-card class="update-dialog__card">
        <q-card-section class="update-dialog__header">
          <div class="row items-center">
            <q-icon name="system_update" size="28px" color="positive" class="q-mr-md" />
            <div>
              <div class="text-h6 text-positive">Update Available</div>
              <div class="text-body2 text-grey-7">A new version is ready to install</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="text-body1 q-mb-md">
            YardRover {{ updateVersion }} is now available. Would you like to update now?
          </div>

          <div v-if="updateNotes" class="update-notes">
            <div class="text-weight-medium q-mb-sm">What's new:</div>
            <div class="text-body2">{{ updateNotes }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Later" @click="dismissUpdate" />
          <q-btn unelevated label="Update Now" color="positive" @click="startUpdate" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Generic Confirmation Dialog -->
    <q-dialog v-model="showConfirmDialog" class="confirm-dialog">
      <q-card class="confirm-dialog__card">
        <q-card-section v-if="confirmData.title" class="confirm-dialog__header">
          <div class="text-h6">{{ confirmData.title }}</div>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">{{ confirmData.message }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="confirmData.cancelText || 'Cancel'" @click="cancelConfirm" />
          <q-btn
            unelevated
            :label="confirmData.confirmText || 'Confirm'"
            :color="confirmData.color || 'primary'"
            @click="confirmAction"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWebSocketStore } from '@/stores/websocket'

// Composables
const ui = useUIStore()
const websocket = useWebSocketStore()

// Local state
const showEmergencyDialog = ref(false)
const showConnectionDialog = ref(false)
const showUpdateDialog = ref(false)
const showConfirmDialog = ref(false)

// Emergency state
const emergencyReason = ref<string>('')

// Connection state
const reconnectProgress = ref(0)
const reconnectAttempt = computed(() => websocket.reconnectAttempts)
const maxReconnectAttempts = computed(() => websocket.maxReconnectAttempts)

// Update state
const updateVersion = ref('')
const updateNotes = ref('')

// Confirmation dialog state
const confirmData = ref<{
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  color?: string
  onConfirm?: () => void
  onCancel?: () => void
}>({
  message: ''
})

// Watch for WebSocket connection status
watch(
  () => websocket.connectionStatus,
  (status, oldStatus) => {
    if (status === 'disconnected' && oldStatus === 'connected') {
      showConnectionDialog.value = true
    } else if (status === 'connected' && oldStatus === 'disconnected') {
      showConnectionDialog.value = false
    }
  }
)

// Watch for reconnection progress
watch(
  () => websocket.reconnectAttempts,
  attempts => {
    if (attempts > 0) {
      reconnectProgress.value = attempts / maxReconnectAttempts.value
    }
  }
)

// Watch for UI dialog states
watch(
  () => ui.dialogs.emergency,
  emergency => {
    if (emergency.show) {
      emergencyReason.value = emergency.reason || ''
      showEmergencyDialog.value = true
    } else {
      showEmergencyDialog.value = false
    }
  },
  { deep: true }
)

watch(
  () => ui.dialogs.update,
  update => {
    if (update.show) {
      updateVersion.value = update.version || ''
      updateNotes.value = update.notes || ''
      showUpdateDialog.value = true
    } else {
      showUpdateDialog.value = false
    }
  },
  { deep: true }
)

watch(
  () => ui.dialogs.confirm,
  confirm => {
    if (confirm.show) {
      confirmData.value = { ...confirm }
      showConfirmDialog.value = true
    } else {
      showConfirmDialog.value = false
    }
  },
  { deep: true }
)

// Methods
const acknowledgeEmergency = () => {
  ui.hideEmergencyDialog()
}

const resetEmergencyStop = () => {
  // TODO: Implement emergency reset logic
  ui.hideEmergencyDialog()
}

const retryConnection = () => {
  websocket.connect()
}

const workOffline = () => {
  showConnectionDialog.value = false
  // TODO: Implement offline mode
}

const dismissUpdate = () => {
  ui.hideUpdateDialog()
}

const startUpdate = () => {
  // TODO: Implement update logic
  ui.hideUpdateDialog()
}

const confirmAction = () => {
  if (confirmData.value.onConfirm) {
    confirmData.value.onConfirm()
  }
  ui.hideConfirmDialog()
}

const cancelConfirm = () => {
  if (confirmData.value.onCancel) {
    confirmData.value.onCancel()
  }
  ui.hideConfirmDialog()
}
</script>

<style lang="scss" scoped>
.global-dialogs {
  // Container for all global dialogs
}

// Emergency Dialog Styles
.emergency-dialog__card {
  min-width: 400px;
  max-width: 500px;
}

.emergency-dialog__header {
  background-color: rgba(var(--q-negative-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--q-negative-rgb), 0.2);
}

// Connection Dialog Styles
.connection-dialog__card {
  min-width: 350px;
  max-width: 450px;
}

.connection-dialog__header {
  background-color: rgba(var(--q-warning-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--q-warning-rgb), 0.2);
}

// Update Dialog Styles
.update-dialog__card {
  min-width: 400px;
  max-width: 500px;
}

.update-dialog__header {
  background-color: rgba(var(--q-positive-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--q-positive-rgb), 0.2);
}

.update-notes {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid var(--q-positive);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

// Confirm Dialog Styles
.confirm-dialog__card {
  min-width: 300px;
  max-width: 400px;
}

.confirm-dialog__header {
  padding-bottom: 8px;
}

// Responsive adjustments
@media (max-width: 599px) {
  .emergency-dialog__card,
  .connection-dialog__card,
  .update-dialog__card,
  .confirm-dialog__card {
    min-width: unset;
    width: 90vw;
    max-width: 90vw;
  }
}

// Animation adjustments
:deep(.q-dialog__inner) {
  padding: 16px;
}
</style>
