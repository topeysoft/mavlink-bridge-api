<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Task Monitor</div>
      
      <div v-if="currentTask" class="task-monitor">
        <!-- Task Header -->
        <div class="task-header q-mb-md">
          <div class="row items-center">
            <div class="col">
              <div class="text-h6">{{ currentTask.name }}</div>
              <div class="text-caption text-grey-7">
                {{ (currentTask as any).type }} • Started {{ formatTime(currentTask.startTime) }}
              </div>
            </div>
            <div class="col-auto">
              <q-btn-group>
                <q-btn
                  :color="currentTask.status === 'paused' ? 'positive' : 'warning'"
                  :icon="currentTask.status === 'paused' ? 'play_arrow' : 'pause'"
                  :label="currentTask.status === 'paused' ? 'Resume' : 'Pause'"
                  @click="togglePause"
                />
                <q-btn
                  color="negative"
                  icon="stop"
                  label="Stop"
                  @click="stopTask"
                />
              </q-btn-group>
            </div>
          </div>
        </div>

        <!-- Progress Section -->
        <div class="progress-section q-mb-md">
          <div class="row items-center q-mb-sm">
            <div class="col">
              <div class="text-subtitle2">Overall Progress</div>
            </div>
            <div class="col-auto">
              <div class="text-subtitle2">{{ Math.round(executionStatus?.progress || 0) }}%</div>
            </div>
          </div>
          
          <q-linear-progress
            :value="(executionStatus?.progress || 0) / 100"
            color="primary"
            size="12px"
            rounded
            class="q-mb-sm"
          />
          
          <div class="row text-caption text-grey-7">
            <div class="col">
              Step {{ executionStatus?.currentStep || 0 }} of {{ executionStatus?.totalSteps || 0 }}
            </div>
            <div class="col-auto">
              {{ formatDuration(currentTask.duration || 0) }} elapsed
            </div>
          </div>
        </div>

        <!-- Current Step -->
        <div class="current-step q-mb-md">
          <q-card flat bordered>
            <q-card-section>
              <div class="row items-center">
                <div class="col">
                  <div class="text-subtitle2">Current Step</div>
                  <div class="text-body2">{{ executionStatus?.message || 'Processing...' }}</div>
                </div>
                <div class="col-auto">
                  <q-spinner-hourglass
                    v-if="currentTask.status === 'running'"
                    color="primary"
                    size="24px"
                  />
                  <q-icon
                    v-else-if="currentTask.status === 'paused'"
                    name="pause"
                    color="warning"
                    size="24px"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Task Parameters -->
        <div class="task-parameters q-mb-md">
          <q-expansion-item
            label="Task Parameters"
            icon="mdi-cog"
            dense
          >
            <q-card flat>
              <q-card-section>
                <div class="row q-col-gutter-md">
                  <div class="col-6">
                    <div class="text-caption text-grey-7">Area</div>
                    <div>{{ currentTask.area?.width }}m × {{ currentTask.area?.height }}m</div>
                  </div>
                  <div class="col-6">
                    <div class="text-caption text-grey-7">Speed</div>
                    <div>{{ currentTask.parameters?.speed }}m/s</div>
                  </div>
                  <div class="col-6">
                    <div class="text-caption text-grey-7">Pattern</div>
                    <div>{{ currentTask.parameters?.pattern }}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-caption text-grey-7">Battery Threshold</div>
                    <div>{{ currentTask.parameters?.batteryThreshold }}%</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>
        </div>

        <!-- Real-time Stats -->
        <div class="realtime-stats">
          <div class="row q-col-gutter-md">
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ currentTask.batteryLevel || 0 }}%</div>
                <div class="stat-label">Battery</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ currentTask.currentSpeed || 0 }}</div>
                <div class="stat-label">Speed (m/s)</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ currentTask.areaCompleted || 0 }}</div>
                <div class="stat-label">Area (m²)</div>
              </div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="stat-card">
                <div class="stat-value">{{ formatTime(currentTask.timeRemaining || 0) }}</div>
                <div class="stat-label">Time Left</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Active Task -->
      <div v-else class="no-task text-center q-py-xl">
        <q-icon name="mdi-sleep" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">No active task</div>
        <div class="text-caption text-grey-7">Start a task to monitor its progress</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTaskStore } from '../../stores/tasks'

const $q = useQuasar()
const taskStore = useTaskStore()

const currentTask = computed(() => {
  // Mock current task with additional monitoring data
  const baseTask = taskStore.currentTask
  if (!baseTask) return null
  
  return {
    ...baseTask,
    startTime: Date.now() - 900000, // 15 minutes ago
    duration: 900, // 15 minutes in seconds
    batteryLevel: 85,
    currentSpeed: 1.2,
    areaCompleted: 250,
    timeRemaining: 300, // 5 minutes
    area: { width: 20, height: 25 },
    parameters: {
      speed: 1.5,
      pattern: 'parallel',
      batteryThreshold: 20
    }
  }
})

const executionStatus = computed(() => taskStore.executionStatus?.data)

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`
  }
  return `${minutes}m ago`
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function togglePause() {
  if (!currentTask.value) return
  
  try {
    if (currentTask.value.status === 'paused') {
      taskStore.resumeTask(currentTask.value.id)
    } else {
      taskStore.pauseTask(currentTask.value.id)
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to toggle task',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function stopTask() {
  if (!currentTask.value) return
  
  $q.dialog({
    title: 'Stop Task',
    message: 'Are you sure you want to stop the current task?',
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(() => {
    try {
      taskStore.stopTask(currentTask.value!.id)
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: 'Failed to stop task',
        caption: error instanceof Error ? error.message : String(error),
        position: 'top'
      })
    }
  })
}
</script>

<style lang="scss" scoped>
.task-monitor {
  .task-header {
    border-bottom: 1px solid $grey-3;
    padding-bottom: 16px;
    
    .body--dark & {
      border-color: $grey-8;
    }
  }
}

.progress-section {
  background: $blue-1;
  padding: 16px;
  border-radius: 8px;
  
  .body--dark & {
    background: $blue-10;
  }
}

.stat-card {
  text-align: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid $grey-3;
  
  .body--dark & {
    background: $grey-8;
    border-color: $grey-7;
  }
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: $primary;
}

.stat-label {
  font-size: 11px;
  color: $grey-7;
  margin-top: 4px;
}
</style>