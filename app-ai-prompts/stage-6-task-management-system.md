# Stage 6: Task Management System

## Objective
Create a comprehensive task management system with templates, scheduling, queue management, and automation. Enable users to create, organize, execute, and monitor multiple tasks efficiently.

## Prerequisites
- Completed Stages 1-5
- Mission planning tools implemented
- Pattern generation working
- API integration established

## Features to Implement

### 1. Task Creation Wizard
- Step-by-step task creation
- Function-specific templates
- Area selection from map
- Parameter configuration
- Schedule setting
- Priority assignment

### 2. Task Templates
- Pre-defined templates for common tasks
- Customizable parameters
- Template sharing/import
- Pattern library integration
- Seasonal templates
- Custom template creation

### 3. Task Queue Management
- Visual queue interface
- Drag-and-drop reordering
- Priority-based sorting
- Batch operations
- Execution scheduling
- Dependencies between tasks

### 4. Task Scheduling
- Calendar integration
- Recurring tasks
- Weather-based scheduling
- Time-based triggers
- Condition-based execution
- Maintenance reminders

### 5. Task Monitoring
- Real-time execution status
- Progress tracking
- Performance metrics
- Error handling
- Automatic retry logic
- Completion notifications

## Component Structure

```
src/components/tasks/
├── TaskWizard.vue              # Step-by-step creation
├── TaskTemplates.vue           # Template selection
├── TaskQueue.vue               # Queue management
├── TaskScheduler.vue           # Calendar scheduling
├── TaskEditor.vue              # Task editing
├── TaskExecutor.vue            # Execution interface
├── TaskMonitor.vue             # Status monitoring
├── templates/
│   ├── MowingTemplate.vue      # Mowing task template
│   ├── SnowTemplate.vue        # Snow clearing template
│   ├── LeafTemplate.vue        # Leaf collection template
│   ├── TowingTemplate.vue      # Towing task template
│   └── PatrolTemplate.vue      # Patrol route template
├── scheduler/
│   ├── CalendarView.vue        # Calendar interface
│   ├── RecurringTasks.vue      # Recurring task setup
│   ├── WeatherTriggers.vue     # Weather conditions
│   └── MaintenanceScheduler.vue # Maintenance tasks
└── monitoring/
    ├── TaskProgress.vue        # Progress display
    ├── TaskMetrics.vue         # Performance metrics
    └── TaskHistory.vue         # Execution history

src/pages/
└── TasksPage.vue               # Main tasks page

src/stores/
├── tasks.ts                    # Task management
├── templates.ts                # Task templates
└── scheduler.ts                # Scheduling system
```

## Implementation

### Tasks Page (pages/TasksPage.vue)

```vue
<template>
  <q-page class="tasks-page">
    <!-- Page Header -->
    <div class="page-header q-pa-md">
      <div class="row items-center">
        <div class="col">
          <h1 class="text-h4 text-primary q-mb-xs">Task Management</h1>
          <p class="text-body2 text-grey-7">
            Create, schedule, and monitor your YardRover tasks
          </p>
        </div>
        
        <div class="header-actions">
          <q-btn
            color="primary"
            icon="add"
            label="New Task"
            @click="showTaskWizard = true"
            unelevated
          />
          <q-btn
            outline
            color="primary"
            icon="event"
            label="Schedule"
            @click="currentTab = 'scheduler'"
          />
        </div>
      </div>
    </div>
    
    <!-- Main Content -->
    <div class="tasks-content">
      <q-tabs
        v-model="currentTab"
        class="text-primary"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab name="queue" label="Queue" icon="list" />
        <q-tab name="active" label="Active" icon="play_circle" />
        <q-tab name="completed" label="Completed" icon="check_circle" />
        <q-tab name="templates" label="Templates" icon="bookmark" />
        <q-tab name="scheduler" label="Schedule" icon="event" />
      </q-tabs>
      
      <q-separator />
      
      <q-tab-panels v-model="currentTab" animated>
        <!-- Task Queue -->
        <q-tab-panel name="queue" class="q-pa-none">
          <TaskQueue
            :tasks="queuedTasks"
            @execute="executeTask"
            @edit="editTask"
            @delete="deleteTask"
            @reorder="reorderTasks"
          />
        </q-tab-panel>
        
        <!-- Active Tasks -->
        <q-tab-panel name="active" class="q-pa-none">
          <TaskMonitor
            :tasks="activeTasks"
            @pause="pauseTask"
            @resume="resumeTask"
            @cancel="cancelTask"
          />
        </q-tab-panel>
        
        <!-- Completed Tasks -->
        <q-tab-panel name="completed" class="q-pa-none">
          <TaskHistory
            :tasks="completedTasks"
            @view-details="viewTaskDetails"
            @create-similar="createSimilarTask"
            @export="exportTasks"
          />
        </q-tab-panel>
        
        <!-- Templates -->
        <q-tab-panel name="templates" class="q-pa-none">
          <TaskTemplates
            :templates="templatesStore.templates"
            @create-from-template="createFromTemplate"
            @edit-template="editTemplate"
            @delete-template="deleteTemplate"
          />
        </q-tab-panel>
        
        <!-- Scheduler -->
        <q-tab-panel name="scheduler" class="q-pa-none">
          <TaskScheduler
            :scheduled-tasks="scheduledTasks"
            @schedule-task="scheduleTask"
            @edit-schedule="editSchedule"
            @delete-schedule="deleteSchedule"
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>
    
    <!-- Task Creation Wizard -->
    <q-dialog v-model="showTaskWizard" maximized>
      <TaskWizard
        @created="handleTaskCreated"
        @cancelled="showTaskWizard = false"
      />
    </q-dialog>
    
    <!-- Task Editor -->
    <q-dialog v-model="showTaskEditor" maximized>
      <TaskEditor
        :task="editingTask"
        @saved="handleTaskSaved"
        @cancelled="showTaskEditor = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useTasksStore } from '@/stores/tasks';
import { useTemplatesStore } from '@/stores/templates';
import { useSchedulerStore } from '@/stores/scheduler';

// Component imports
import TaskWizard from '@/components/tasks/TaskWizard.vue';
import TaskQueue from '@/components/tasks/TaskQueue.vue';
import TaskMonitor from '@/components/tasks/TaskMonitor.vue';
import TaskHistory from '@/components/tasks/TaskHistory.vue';
import TaskTemplates from '@/components/tasks/TaskTemplates.vue';
import TaskScheduler from '@/components/tasks/TaskScheduler.vue';
import TaskEditor from '@/components/tasks/TaskEditor.vue';

const $q = useQuasar();
const tasksStore = useTasksStore();
const templatesStore = useTemplatesStore();
const schedulerStore = useSchedulerStore();

// State
const currentTab = ref('queue');
const showTaskWizard = ref(false);
const showTaskEditor = ref(false);
const editingTask = ref(null);

// Computed
const queuedTasks = computed(() => 
  tasksStore.tasks.filter(t => ['created', 'ready'].includes(t.metadata.status))
);

const activeTasks = computed(() => 
  tasksStore.tasks.filter(t => ['executing', 'paused'].includes(t.metadata.status))
);

const completedTasks = computed(() => 
  tasksStore.tasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.metadata.status))
);

const scheduledTasks = computed(() => 
  schedulerStore.scheduledTasks
);

// Task management
async function executeTask(taskId: string) {
  try {
    await tasksStore.executeTask(taskId);
    
    $q.notify({
      type: 'positive',
      message: 'Task execution started'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to start task: ${error.message}`
    });
  }
}

function editTask(task: any) {
  editingTask.value = task;
  showTaskEditor.value = true;
}

async function deleteTask(taskId: string) {
  $q.dialog({
    title: 'Delete Task',
    message: 'Are you sure you want to delete this task?',
    cancel: true
  }).onOk(async () => {
    try {
      await tasksStore.deleteTask(taskId);
      
      $q.notify({
        type: 'positive',
        message: 'Task deleted'
      });
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: `Failed to delete task: ${error.message}`
      });
    }
  });
}

function reorderTasks(newOrder: string[]) {
  tasksStore.reorderTasks(newOrder);
}

// Task execution control
async function pauseTask(taskId: string) {
  try {
    await tasksStore.pauseTask(taskId);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to pause task: ${error.message}`
    });
  }
}

async function resumeTask(taskId: string) {
  try {
    await tasksStore.resumeTask(taskId);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to resume task: ${error.message}`
    });
  }
}

async function cancelTask(taskId: string) {
  $q.dialog({
    title: 'Cancel Task',
    message: 'Are you sure you want to cancel this task?',
    cancel: true
  }).onOk(async () => {
    try {
      await tasksStore.cancelTask(taskId);
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: `Failed to cancel task: ${error.message}`
      });
    }
  });
}

// Template management
function createFromTemplate(template: any) {
  showTaskWizard.value = true;
  // Pre-populate wizard with template data
}

// Event handlers
function handleTaskCreated(task: any) {
  showTaskWizard.value = false;
  currentTab.value = 'queue';
  
  $q.notify({
    type: 'positive',
    message: `Task "${task.name}" created`
  });
}

function handleTaskSaved(task: any) {
  showTaskEditor.value = false;
  editingTask.value = null;
  
  $q.notify({
    type: 'positive',
    message: `Task "${task.name}" updated`
  });
}

onMounted(() => {
  // Load initial data
  tasksStore.loadTasks();
  templatesStore.loadTemplates();
  schedulerStore.loadSchedules();
});
</script>

<style lang="scss" scoped>
.tasks-page {
  background-color: $background;
}

.page-header {
  background: white;
  border-bottom: 1px solid $grey-4;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.tasks-content {
  height: calc(100vh - 120px);
  
  :deep(.q-panel) {
    height: calc(100vh - 180px);
    overflow: hidden;
  }
}
</style>
```

### Task Wizard Component (components/tasks/TaskWizard.vue)

```vue
<template>
  <q-card class="task-wizard">
    <q-linear-progress 
      :value="progress" 
      color="primary" 
      size="4px"
    />
    
    <q-card-section>
      <div class="text-h5">Create New Task</div>
      <div class="text-body2 text-grey-7">
        Step {{ currentStep }} of {{ totalSteps }}: {{ stepTitle }}
      </div>
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="wizard-content">
      <q-stepper
        v-model="currentStep"
        vertical
        animated
        color="primary"
        class="full-height"
      >
        <!-- Step 1: Task Type -->
        <q-step
          :name="1"
          title="Select Task Type"
          icon="category"
          :done="currentStep > 1"
        >
          <div class="step-content">
            <p class="text-body1 q-mb-md">
              What type of task would you like to create?
            </p>
            
            <div class="task-type-grid">
              <div
                v-for="type in taskTypes"
                :key="type.value"
                class="task-type-card"
                :class="{ active: taskData.type === type.value }"
                @click="selectTaskType(type.value)"
              >
                <q-icon :name="type.icon" size="48px" :color="type.color" />
                <div class="task-type-title">{{ type.label }}</div>
                <div class="task-type-description">{{ type.description }}</div>
              </div>
            </div>
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="primary" 
              label="Continue"
              @click="nextStep"
              :disable="!taskData.type"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Cancel"
              @click="$emit('cancelled')"
            />
          </q-stepper-navigation>
        </q-step>
        
        <!-- Step 2: Template Selection -->
        <q-step
          :name="2"
          title="Choose Template"
          icon="bookmark"
          :done="currentStep > 2"
        >
          <div class="step-content">
            <p class="text-body1 q-mb-md">
              Start with a template or create from scratch
            </p>
            
            <q-list>
              <q-item
                clickable
                @click="selectTemplate(null)"
                :active="!selectedTemplate"
              >
                <q-item-section avatar>
                  <q-icon name="build" color="grey-6" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Custom Task</q-item-label>
                  <q-item-label caption>Start from scratch</q-item-label>
                </q-item-section>
              </q-item>
              
              <q-item
                v-for="template in filteredTemplates"
                :key="template.id"
                clickable
                @click="selectTemplate(template)"
                :active="selectedTemplate?.id === template.id"
              >
                <q-item-section avatar>
                  <q-icon :name="template.icon" :color="template.color" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ template.name }}</q-item-label>
                  <q-item-label caption>{{ template.description }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip
                    dense
                    color="grey-3"
                    text-color="grey-8"
                    size="sm"
                  >
                    {{ template.estimatedDuration }}min
                  </q-chip>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="primary" 
              label="Continue"
              @click="nextStep"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Back"
              @click="previousStep"
            />
          </q-stepper-navigation>
        </q-step>
        
        <!-- Step 3: Area Selection -->
        <q-step
          :name="3"
          title="Define Work Area"
          icon="map"
          :done="currentStep > 3"
        >
          <div class="step-content">
            <p class="text-body1 q-mb-md">
              Select the area where this task will be performed
            </p>
            
            <!-- Mini Map for Area Selection -->
            <div class="area-selection-map">
              <MapContainer
                :height="300"
                :center="mapCenter"
                :zoom="18"
                :tool="'boundary'"
                @boundary-updated="updateTaskArea"
              />
            </div>
            
            <!-- Area Statistics -->
            <q-card v-if="taskData.area" class="q-mt-md">
              <q-card-section>
                <div class="text-subtitle1 q-mb-sm">Area Information</div>
                <div class="area-stats">
                  <div class="stat-item">
                    <q-icon name="straighten" />
                    <span>{{ taskData.area.size }} m²</span>
                  </div>
                  <div class="stat-item">
                    <q-icon name="landscape" />
                    <span>{{ taskData.area.perimeter }} m perimeter</span>
                  </div>
                  <div class="stat-item">
                    <q-icon name="timer" />
                    <span>~{{ estimatedTime }} minutes</span>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="primary" 
              label="Continue"
              @click="nextStep"
              :disable="!taskData.area"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Back"
              @click="previousStep"
            />
          </q-stepper-navigation>
        </q-step>
        
        <!-- Step 4: Parameters -->
        <q-step
          :name="4"
          title="Configure Parameters"
          icon="tune"
          :done="currentStep > 4"
        >
          <div class="step-content">
            <component
              :is="parameterComponent"
              v-model="taskData.parameters"
              :template="selectedTemplate"
            />
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="primary" 
              label="Continue"
              @click="nextStep"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Back"
              @click="previousStep"
            />
          </q-stepper-navigation>
        </q-step>
        
        <!-- Step 5: Schedule -->
        <q-step
          :name="5"
          title="Set Schedule"
          icon="event"
          :done="currentStep > 5"
        >
          <div class="step-content">
            <q-input
              v-model="taskData.name"
              label="Task Name"
              outlined
              class="q-mb-md"
            />
            
            <q-input
              v-model="taskData.description"
              type="textarea"
              label="Description (optional)"
              outlined
              rows="3"
              class="q-mb-md"
            />
            
            <q-select
              v-model="taskData.priority"
              :options="priorityOptions"
              label="Priority"
              outlined
              class="q-mb-md"
            />
            
            <q-select
              v-model="scheduleType"
              :options="scheduleOptions"
              label="Schedule Type"
              outlined
              class="q-mb-md"
            />
            
            <!-- Schedule-specific options -->
            <div v-if="scheduleType === 'immediate'" class="schedule-options">
              <q-banner class="bg-info text-white">
                <template v-slot:avatar>
                  <q-icon name="info" />
                </template>
                Task will be added to queue for immediate execution
              </q-banner>
            </div>
            
            <div v-else-if="scheduleType === 'datetime'" class="schedule-options">
              <q-input
                v-model="taskData.scheduledTime"
                type="datetime-local"
                label="Scheduled Time"
                outlined
              />
            </div>
            
            <div v-else-if="scheduleType === 'recurring'" class="schedule-options">
              <RecurringTaskSetup v-model="taskData.recurring" />
            </div>
            
            <div v-else-if="scheduleType === 'weather'" class="schedule-options">
              <WeatherTriggerSetup v-model="taskData.weatherTrigger" />
            </div>
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="primary" 
              label="Continue"
              @click="nextStep"
              :disable="!taskData.name"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Back"
              @click="previousStep"
            />
          </q-stepper-navigation>
        </q-step>
        
        <!-- Step 6: Review -->
        <q-step
          :name="6"
          title="Review & Create"
          icon="check"
        >
          <div class="step-content">
            <TaskSummary :task="taskData" />
          </div>
          
          <q-stepper-navigation>
            <q-btn 
              color="positive" 
              label="Create Task"
              @click="createTask"
              :loading="isCreating"
              unelevated
            />
            <q-btn 
              flat 
              color="grey-7" 
              label="Back"
              @click="previousStep"
            />
          </q-stepper-navigation>
        </q-step>
      </q-stepper>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
// Wizard implementation with reactive step management
const currentStep = ref(1);
const totalSteps = 6;
const isCreating = ref(false);

const taskData = ref({
  type: null,
  name: '',
  description: '',
  priority: 'normal',
  parameters: {},
  area: null,
  scheduledTime: null,
  recurring: null,
  weatherTrigger: null
});

const selectedTemplate = ref(null);
const scheduleType = ref('immediate');

// Step management
const stepTitle = computed(() => {
  const titles = [
    '',
    'Select Task Type',
    'Choose Template',
    'Define Work Area',
    'Configure Parameters',
    'Set Schedule',
    'Review & Create'
  ];
  return titles[currentStep.value] || '';
});

const progress = computed(() => (currentStep.value - 1) / (totalSteps - 1));

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function previousStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

// Task creation
async function createTask() {
  isCreating.value = true;
  
  try {
    const task = await tasksStore.createTask(taskData.value);
    
    // Handle scheduling
    if (scheduleType.value !== 'immediate') {
      await schedulerStore.scheduleTask(task.id, {
        type: scheduleType.value,
        ...taskData.value
      });
    }
    
    emit('created', task);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to create task: ${error.message}`
    });
  } finally {
    isCreating.value = false;
  }
}
</script>
```

## Task Templates System

### Template Structure
```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  category: 'seasonal' | 'maintenance' | 'custom';
  parameters: {
    defaults: Record<string, any>;
    required: string[];
    optional: string[];
    constraints: Record<string, any>;
  };
  patternConfig: {
    type: string;
    spacing: number;
    overlap: number;
    options: Record<string, any>;
  };
  estimatedDuration: number;
  batteryUsage: number;
  weatherRequirements: {
    maxWindSpeed: number;
    maxPrecipitation: number;
    minTemperature: number;
    maxTemperature: number;
  };
  equipmentRequirements: string[];
  safetyNotes: string[];
  previewImage?: string;
}
```

### Built-in Templates

#### Weekly Lawn Mowing
```typescript
{
  id: 'weekly-mow',
  name: 'Weekly Lawn Mowing',
  type: TaskType.MOWING,
  parameters: {
    bladeHeight: 2.5,
    pattern: 'stripe',
    speed: 2.0,
    mulching: true,
    edgeMode: true
  },
  patternConfig: {
    type: 'stripe',
    spacing: 0.6, // 60cm overlap
    angle: 0
  },
  weatherRequirements: {
    maxWindSpeed: 15,
    maxPrecipitation: 0,
    minTemperature: 5,
    maxTemperature: 35
  }
}
```

#### Snow Driveway Clearing
```typescript
{
  id: 'driveway-snow',
  name: 'Driveway Snow Clearing',
  type: TaskType.SNOW_REMOVAL,
  parameters: {
    bladeAngle: 15,
    bladeHeight: 2,
    dispenserEnabled: true,
    dispenserRate: 25
  },
  patternConfig: {
    type: 'straight',
    passes: 2
  },
  weatherRequirements: {
    maxWindSpeed: 25,
    minTemperature: -20
  }
}
```

## Task Scheduling Features

### Recurring Tasks
- Daily, weekly, monthly, seasonal patterns
- Custom intervals
- Weather dependency
- Automatic rescheduling
- Conflict resolution

### Weather-Based Triggers
- Temperature thresholds
- Precipitation conditions
- Wind speed limits
- UV index considerations
- Seasonal adjustments

### Maintenance Scheduling
- Battery maintenance
- Blade sharpening
- Filter cleaning
- Sensor calibration
- Software updates

## Queue Management

### Priority System
- Critical (safety/emergency)
- High (time-sensitive)
- Normal (regular tasks)
- Low (when convenient)

### Dependencies
- Sequential task chains
- Prerequisite completion
- Resource conflicts
- Weather dependencies

### Batch Operations
- Group similar tasks
- Optimize execution order
- Minimize setup changes
- Reduce travel time

## Testing Requirements
- Test task creation wizard
- Verify template functionality
- Test scheduling logic
- Validate queue management
- Test task execution
- Verify data persistence

## Next Steps
After completing this stage, proceed to Stage 7: Settings & Configuration to implement system configuration interfaces.