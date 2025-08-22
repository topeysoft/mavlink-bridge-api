<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">MAVLink Command Console</div>

      <!-- Quick Commands -->
      <div class="q-mb-md">
        <div class="text-subtitle2 q-mb-sm">Quick Commands</div>
        <div class="row q-gutter-sm">
          <q-btn
            v-for="cmd in quickCommands"
            :key="cmd.id"
            :label="cmd.label"
            :color="cmd.color"
            size="sm"
            @click="executeQuickCommand(cmd)"
          />
        </div>
      </div>

      <q-separator class="q-my-md" />

      <!-- Custom Command -->
      <div class="text-subtitle2 q-mb-sm">Custom Command</div>
      <q-form @submit="sendCustomCommand">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="customCommand.id"
              :options="commandOptions"
              label="Command"
              emit-value
              map-options
              dense
            />
          </div>
          <div class="col-6 col-sm-2" v-for="i in 7" :key="`param${i}`">
            <q-input
              v-model.number="customCommand.params[i-1]"
              :label="`Param ${i}`"
              type="number"
              dense
              step="any"
            />
          </div>
        </div>
        <div class="q-mt-md">
          <q-btn
            type="submit"
            label="Send Command"
            color="primary"
            :loading="sendingCommand"
          />
        </div>
      </q-form>

      <q-separator class="q-my-md" />

      <!-- Command History -->
      <div class="text-subtitle2 q-mb-sm">Command History</div>
      <q-scroll-area style="height: 200px" class="command-history">
        <div
          v-for="(cmd, index) in commandHistory"
          :key="index"
          class="command-entry"
        >
          <div class="row items-center">
            <div class="col">
              <div class="text-caption text-grey-7">
                {{ formatTimestamp(cmd.timestamp) }}
              </div>
              <div class="text-body2">
                {{ cmd.name }} ({{ cmd.id }})
              </div>
              <div class="text-caption" v-if="cmd.params.some(p => p !== 0)">
                Params: {{ cmd.params.filter(p => p !== 0).join(', ') }}
              </div>
            </div>
            <div class="col-auto">
              <q-chip
                :color="cmd.success ? 'positive' : 'negative'"
                text-color="white"
                size="sm"
              >
                {{ cmd.success ? 'Success' : 'Failed' }}
              </q-chip>
            </div>
          </div>
        </div>
      </q-scroll-area>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkStore } from '../../stores/mavlink'

interface QuickCommand {
  id: string
  label: string
  command: number
  params: number[]
  color?: string
  confirm?: boolean
}

const $q = useQuasar()
const mavlinkStore = useMAVLinkStore()

const sendingCommand = ref(false)
const customCommand = ref({
  id: 0,
  params: [0, 0, 0, 0, 0, 0, 0]
})

const commandHistory = computed(() => mavlinkStore.commandHistory)

const quickCommands: QuickCommand[] = [
  {
    id: 'takeoff',
    label: 'Takeoff (2m)',
    command: 22, // MAV_CMD_NAV_TAKEOFF
    params: [0, 0, 0, 0, 0, 0, 2],
    color: 'primary',
    confirm: true
  },
  {
    id: 'land',
    label: 'Land',
    command: 21, // MAV_CMD_NAV_LAND
    params: [0, 0, 0, 0, 0, 0, 0],
    color: 'warning',
    confirm: true
  },
  {
    id: 'rtl',
    label: 'Return to Launch',
    command: 20, // MAV_CMD_NAV_RETURN_TO_LAUNCH
    params: [0, 0, 0, 0, 0, 0, 0],
    color: 'orange',
    confirm: true
  },
  {
    id: 'pause',
    label: 'Pause Mission',
    command: 252, // MAV_CMD_OVERRIDE_GOTO
    params: [1, 0, 0, 0, 0, 0, 0],
    color: 'grey'
  },
  {
    id: 'resume',
    label: 'Resume Mission',
    command: 252, // MAV_CMD_OVERRIDE_GOTO
    params: [0, 0, 0, 0, 0, 0, 0],
    color: 'positive'
  }
]

const commandOptions = [
  { label: 'Takeoff', value: 22 },
  { label: 'Land', value: 21 },
  { label: 'Return to Launch', value: 20 },
  { label: 'Waypoint', value: 16 },
  { label: 'Loiter Unlimited', value: 17 },
  { label: 'Loiter Time', value: 19 },
  { label: 'Set Mode', value: 176 },
  { label: 'Set Home', value: 179 },
  { label: 'Reboot', value: 246 }
]

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

async function executeQuickCommand(cmd: QuickCommand) {
  if (cmd.confirm) {
    $q.dialog({
      title: 'Confirm Command',
      message: `Execute ${cmd.label} command?`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      void (async () => {
        await sendCommand(cmd.command, cmd.params, cmd.label)
      })()
    })
  } else {
    await sendCommand(cmd.command, cmd.params, cmd.label)
  }
}

async function sendCustomCommand() {
  const cmdInfo = commandOptions.find(c => c.value === customCommand.value.id)
  await sendCommand(
    customCommand.value.id,
    customCommand.value.params,
    cmdInfo?.label || `Command ${customCommand.value.id}`
  )
}

async function sendCommand(command: number, params: number[], name: string) {
  sendingCommand.value = true
  
  try {
    await mavlinkStore.sendCommand(command, params)
    
    $q.notify({
      type: 'positive',
      message: `Command sent: ${name}`,
      position: 'top'
    })
  } catch (error: unknown) {
    $q.notify({
      type: 'negative',
      message: `Command failed: ${name}`,
      caption: error instanceof Error ? error.message : 'Unknown error',
      position: 'top'
    })
  } finally {
    sendingCommand.value = false
  }
}
</script>

<style lang="scss" scoped>
.command-history {
  background: $grey-2;
  border-radius: 4px;
  
  .body--dark & {
    background: $grey-9;
  }
}

.command-entry {
  padding: 8px;
  border-bottom: 1px solid $grey-4;
  
  .body--dark & {
    border-color: $grey-7;
  }
  
  &:last-child {
    border-bottom: none;
  }
}
</style>