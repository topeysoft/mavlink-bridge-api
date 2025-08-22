<template>
  <BasePage
    title="Task Management"
    subtitle="Create, schedule, and monitor automated tasks"
  >
    <template #actions>
      <q-btn-group>
        <q-btn
          color="primary"
          icon="add"
          label="New Task"
          @click="showTaskWizard = true"
        />
        <q-btn
          flat
          icon="mdi-history"
          @click="activeTab = 'history'"
        >
          <q-tooltip>View history</q-tooltip>
        </q-btn>
      </q-btn-group>
    </template>

    <q-tabs
      v-model="activeTab"
      dense
      active-color="primary"
      indicator-color="primary"
      align="left"
      class="q-mb-md"
    >
      <q-tab name="queue" label="Task Queue" icon="mdi-format-list-checks" />
      <q-tab name="templates" label="Templates" icon="mdi-file-document" />
      <q-tab name="scheduler" label="Scheduler" icon="mdi-calendar" />
      <q-tab name="history" label="History" icon="mdi-history" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated>
      <q-tab-panel name="queue">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-lg-8">
            <TaskQueue
              @add-task="showTaskWizard = true"
              @edit-task="editTask"
            />
          </div>
          <div class="col-12 col-lg-4">
            <TaskMonitor />
          </div>
        </div>
      </q-tab-panel>

      <q-tab-panel name="templates">
        <TaskTemplates @template-selected="useTemplate" />
      </q-tab-panel>

      <q-tab-panel name="scheduler">
        <TaskScheduler />
      </q-tab-panel>

      <q-tab-panel name="history">
        <TaskHistory />
      </q-tab-panel>
    </q-tab-panels>

    <!-- Task Creation Wizard -->
    <TaskCreationWizard
      v-if="showTaskWizard"
      v-model="showTaskWizard"
      :template="selectedTemplate ?? undefined"
      @created="onTaskCreated"
    />
  </BasePage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import type { TaskMetadata } from '../stores/tasks'
import type { TaskTemplate, TaskData } from '../stores/types'
import BasePage from '../components/layout/BasePage.vue'
import TaskQueue from '../components/tasks/TaskQueue.vue'
import TaskTemplates from '../components/tasks/TaskTemplates.vue'
import TaskScheduler from '../components/tasks/TaskScheduler.vue'
import TaskHistory from '../components/tasks/TaskHistory.vue'
import TaskMonitor from '../components/tasks/TaskMonitor.vue'
import TaskCreationWizard from '../components/tasks/TaskCreationWizard.vue'

const $q = useQuasar()

const activeTab = ref('queue')
const showTaskWizard = ref(false)
const selectedTemplate = ref<TaskData | undefined>(undefined)

function useTemplate(template: TaskTemplate) {
  selectedTemplate.value = {
    name: template.name,
    description: template.description,
    type: template.type || 'custom',
    parameters: template.parameters || {}
  }
  showTaskWizard.value = true
}

function editTask(task: TaskMetadata) {
  selectedTemplate.value = {
    name: task.name,
    description: task.description || '',
    type: 'custom',
    parameters: {}
  }
  showTaskWizard.value = true
}

function onTaskCreated() {
  showTaskWizard.value = false
  selectedTemplate.value = undefined
  
  $q.notify({
    type: 'positive',
    message: 'Task created successfully',
    position: 'top'
  })
}
</script>