<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Mission Execution</div>
          <div class="text-caption text-grey-7">
            {{ currentWaypoint }} of {{ totalWaypoints }} waypoints
          </div>
        </div>
        <div class="col-auto">
          <q-chip
            :color="statusColor"
            text-color="white"
            :icon="statusIcon"
          >
            {{ executionStatus }}
          </q-chip>
        </div>
      </div>

      <!-- Progress Bar -->
      <q-linear-progress
        :value="progressPercentage / 100"
        color="primary"
        size="20px"
        rounded
        class="q-mb-md"
      >
        <div class="absolute-full flex flex-center">
          <q-badge color="white" text-color="black" :label="`${progressPercentage}%`" />
        </div>
      </q-linear-progress>

      <!-- Mission Stats -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-6">
          <div class="stat-item">
            <div class="text-caption text-grey-7">Distance Remaining</div>
            <div class="text-h6">{{ remainingDistance.toFixed(0) }}m</div>
          </div>
        </div>
        <div class="col-6">
          <div class="stat-item">
            <div class="text-caption text-grey-7">Estimated Time</div>
            <div class="text-h6">{{ formatTime(estimatedTimeRemaining) }}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="stat-item">
            <div class="text-caption text-grey-7">Current Speed</div>
            <div class="text-h6">{{ currentSpeed.toFixed(1) }}m/s</div>
          </div>
        </div>
        <div class="col-6">
          <div class="stat-item">
            <div class="text-caption text-grey-7">Battery</div>
            <div class="text-h6">{{ batteryLevel }}%</div>
          </div>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="row q-gutter-sm">
        <q-btn
          v-if="!isExecuting"
          label="Start Mission"
          color="positive"
          icon="mdi-play"
          @click="startMission"
          :disable="!canStart"
          class="col"
        />
        <q-btn
          v-if="isExecuting && !isPaused"
          label="Pause"
          color="warning"
          icon="mdi-pause"
          @click="pauseMission"
          class="col"
        />
        <q-btn
          v-if="isExecuting && isPaused"
          label="Resume"
          color="positive"
          icon="mdi-play"
          @click="resumeMission"
          class="col"
        />
        <q-btn
          v-if="isExecuting"
          label="Stop"
          color="negative"
          icon="mdi-stop"
          @click="stopMission"
          class="col"
        />
        <q-btn
          label="RTL"
          color="orange"
          icon="mdi-home"
          @click="returnToLaunch"
          class="col"
        />
      </div>
    </q-card-section>

    <!-- Mission Log -->
    <q-separator />
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Mission Log</div>
      <q-scroll-area style="height: 150px">
        <q-list dense>
          <q-item
            v-for="(entry, index) in missionLog"
            :key="index"
            dense
          >
            <q-item-section avatar style="min-width: 60px">
              <div class="text-caption text-grey-7">
                {{ formatLogTime(entry.timestamp) }}
              </div>
            </q-item-section>
            <q-item-section>
              <div :class="`text-${entry.level}`">
                {{ entry.message }}
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useMissionStore } from '../../stores/mission'

const $q = useQuasar()
const missionStore = useMissionStore()

const missionLog = ref<Array<{
  timestamp: number
  level: 'info' | 'warning' | 'negative'
  message: string
}>>([])

const isExecuting = computed(() => missionStore.executionState.isExecuting)
const isPaused = computed(() => missionStore.executionState.isPaused)
const currentWaypoint = computed(() => missionStore.executionState.currentWaypointIndex + 1)
const totalWaypoints = computed(() => missionStore.executionState.totalWaypoints)
const progressPercentage = computed(() => missionStore.executionState.progressPercentage)
const remainingDistance = computed(() => missionStore.executionState.remainingDistance)
const estimatedTimeRemaining = computed(() => missionStore.executionState.estimatedTimeRemaining)
const currentSpeed = computed(() => missionStore.executionState.currentSpeed)
const batteryLevel = computed(() => missionStore.executionState.batteryLevel)

const executionStatus = computed(() => {
  if (!isExecuting.value) return 'Ready'
  if (isPaused.value) return 'Paused'
  return 'Executing'
})

const statusColor = computed(() => {
  if (!isExecuting.value) return 'grey'
  if (isPaused.value) return 'warning'
  return 'positive'
})

const statusIcon = computed(() => {
  if (!isExecuting.value) return 'mdi-checkbox-marked-circle'
  if (isPaused.value) return 'mdi-pause'
  return 'mdi-play'
})

const canStart = computed(() => {
  return missionStore.canStart
})

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function addLogEntry(message: string, level: 'info' | 'warning' | 'negative' = 'info') {
  missionLog.value.unshift({
    timestamp: Date.now(),
    level,
    message
  })
  
  // Keep only last 50 entries
  if (missionLog.value.length > 50) {
    missionLog.value = missionLog.value.slice(0, 50)
  }
}

function startMission() {
  $q.dialog({
    title: 'Start Mission',
    message: 'Start executing the planned mission?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    void missionStore.startExecution().then(() => {
      addLogEntry('Mission started', 'info')
    }).catch((error: Error) => {
      addLogEntry(`Failed to start mission: ${error.message}`, 'negative')
      $q.notify({
        type: 'negative',
        message: 'Failed to start mission',
        caption: error.message,
        position: 'top'
      })
    })
  })
}

async function pauseMission() {
  try {
    await missionStore.pauseExecution()
    addLogEntry('Mission paused', 'warning')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    addLogEntry(`Failed to pause mission: ${errorMsg}`, 'negative')
  }
}

async function resumeMission() {
  try {
    await missionStore.resumeExecution()
    addLogEntry('Mission resumed', 'info')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    addLogEntry(`Failed to resume mission: ${errorMsg}`, 'negative')
  }
}

function stopMission() {
  $q.dialog({
    title: 'Stop Mission',
    message: 'Stop the current mission execution?',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    void missionStore.stopExecution().then(() => {
      addLogEntry('Mission stopped', 'warning')
    }).catch((error: Error) => {
      addLogEntry(`Failed to stop mission: ${error.message}`, 'negative')
    })
  })
}

function returnToLaunch() {
  $q.dialog({
    title: 'Return to Launch',
    message: 'Command vehicle to return to launch position?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    void missionStore.returnToLaunch().then(() => {
      addLogEntry('RTL commanded', 'info')
    }).catch((error: Error) => {
      addLogEntry(`RTL failed: ${error.message}`, 'negative')
    })
  })
}
</script>

<style lang="scss" scoped>
.stat-item {
  text-align: center;
  padding: 8px;
  background: var(--q-color-grey-1);
  border-radius: 4px;
  
  .body--dark & {
    background: var(--q-color-grey-9);
  }
}
</style>