<template>
  <q-page class="active-tasks-page q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Currently Running Tasks -->
      <div class="col-12 col-md-6">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="play_circle" class="q-mr-sm" />
              Currently Running
            </div>
            
            <q-list separator>
              <q-item v-for="task in runningTasks" :key="task.id">
                <q-item-section avatar>
                  <q-circular-progress
                    show-value
                    :value="task.progress"
                    size="50px"
                    :thickness="0.2"
                    color="primary"
                    track-color="grey-3"
                  >
                    {{ task.progress }}%
                  </q-circular-progress>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ task.name }}</q-item-label>
                  <q-item-label caption>
                    Started: {{ formatTime(task.startTime) }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="text-center">
                    <q-btn flat round icon="pause" @click="pauseTask(task.id)" />
                    <q-btn flat round icon="stop" color="negative" @click="stopTask(task.id)" />
                  </div>
                </q-item-section>
              </q-item>
              
              <q-item v-if="runningTasks.length === 0">
                <q-item-section class="text-center text-grey">
                  No tasks currently running
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- Queued Tasks -->
      <div class="col-12 col-md-6">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="schedule" class="q-mr-sm" />
              Queued Tasks
            </div>
            
            <q-list separator>
              <q-item v-for="(task, index) in queuedTasks" :key="task.id">
                <q-item-section avatar>
                  <q-chip color="primary" text-color="white">
                    {{ index + 1 }}
                  </q-chip>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ task.name }}</q-item-label>
                  <q-item-label caption>
                    Priority: {{ task.priority }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="text-center">
                    <q-btn flat round icon="play_arrow" color="positive" @click="startTask(task.id)" />
                    <q-btn flat round icon="delete" color="negative" @click="removeTask(task.id)" />
                  </div>
                </q-item-section>
              </q-item>
              
              <q-item v-if="queuedTasks.length === 0">
                <q-item-section class="text-center text-grey">
                  No tasks in queue
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- Task Control Panel -->
      <div class="col-12">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="settings_applications" class="q-mr-sm" />
              Task Control
            </div>
            
            <div class="row q-gutter-md">
              <q-btn
                color="positive"
                icon="add"
                label="Create Task"
                @click="showTaskCreator = true"
              />
              <q-btn
                color="primary"
                icon="play_arrow"
                label="Start All"
                :disable="queuedTasks.length === 0"
                @click="startAllTasks"
              />
              <q-btn
                color="warning"
                icon="pause"
                label="Pause All"
                :disable="runningTasks.length === 0"
                @click="pauseAllTasks"
              />
              <q-btn
                color="negative"
                icon="stop"
                label="Stop All"
                :disable="runningTasks.length === 0"
                @click="stopAllTasks"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Task Creator Dialog -->
    <q-dialog v-model="showTaskCreator">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Create New Task</div>
        </q-card-section>
        
        <q-card-section>
          <q-input v-model="newTask.name" label="Task Name" outlined />
          <q-select
            v-model="newTask.type"
            :options="taskTypes"
            label="Task Type"
            outlined
            class="q-mt-md"
          />
          <q-select
            v-model="newTask.priority"
            :options="['Low', 'Normal', 'High']"
            label="Priority"
            outlined
            class="q-mt-md"
          />
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat label="Create" color="primary" @click="createTask" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { date } from 'quasar';

interface Task {
  id: string;
  name: string;
  type: string;
  priority: string;
  progress: number;
  startTime?: Date;
  status: 'running' | 'queued' | 'paused';
}

// State
const showTaskCreator = ref(false);
const runningTasks = ref<Task[]>([
  { 
    id: '1', 
    name: 'Mow Front Yard', 
    type: 'mowing',
    priority: 'Normal',
    progress: 65, 
    startTime: new Date(),
    status: 'running'
  }
]);
const queuedTasks = ref<Task[]>([
  { 
    id: '2', 
    name: 'Edge Walkway', 
    type: 'edging',
    priority: 'Normal',
    progress: 0,
    status: 'queued'
  },
  { 
    id: '3', 
    name: 'Trim Bushes', 
    type: 'trimming',
    priority: 'Low',
    progress: 0,
    status: 'queued'
  }
]);

const newTask = ref({
  name: '',
  type: 'mowing',
  priority: 'Normal'
});

const taskTypes = ['mowing', 'edging', 'trimming', 'mulching', 'watering'];

// Methods
function formatTime(time: Date) {
  return date.formatDate(time, 'h:mm A');
}

function createTask() {
  const task: Task = {
    id: Date.now().toString(),
    name: newTask.value.name,
    type: newTask.value.type,
    priority: newTask.value.priority,
    progress: 0,
    status: 'queued'
  };
  queuedTasks.value.push(task);
  showTaskCreator.value = false;
  newTask.value = { name: '', type: 'mowing', priority: 'Normal' };
}

function startTask(id: string) {
  const taskIndex = queuedTasks.value.findIndex(t => t.id === id);
  if (taskIndex >= 0) {
    const task = queuedTasks.value.splice(taskIndex, 1)[0];
    task.status = 'running';
    task.startTime = new Date();
    runningTasks.value.push(task);
  }
}

function pauseTask(id: string) {
  console.log('Pausing task:', id);
}

function stopTask(id: string) {
  const taskIndex = runningTasks.value.findIndex(t => t.id === id);
  if (taskIndex >= 0) {
    runningTasks.value.splice(taskIndex, 1);
  }
}

function removeTask(id: string) {
  const taskIndex = queuedTasks.value.findIndex(t => t.id === id);
  if (taskIndex >= 0) {
    queuedTasks.value.splice(taskIndex, 1);
  }
}

function startAllTasks() {
  while (queuedTasks.value.length > 0) {
    startTask(queuedTasks.value[0].id);
  }
}

function pauseAllTasks() {
  console.log('Pausing all tasks');
}

function stopAllTasks() {
  runningTasks.value = [];
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.active-tasks-page {
  min-height: calc(100vh - 100px);
}
</style>