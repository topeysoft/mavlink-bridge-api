<template>
  <q-page class="history-page q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Filters -->
      <div class="col-12">
        <q-card class="nature-card">
          <q-card-section>
            <div class="row q-gutter-md items-center">
              <div class="text-h6 text-primary">
                <q-icon name="history" class="q-mr-sm" />
                Task History
              </div>
              <q-space />
              <q-input
                v-model="dateRange"
                label="Date Range"
                outlined
                dense
                style="width: 200px"
              >
                <template v-slot:prepend>
                  <q-icon name="event" />
                </template>
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="dateRange" range>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-input>
              <q-select
                v-model="filterType"
                :options="taskTypes"
                label="Task Type"
                outlined
                dense
                clearable
                style="width: 150px"
              />
              <q-select
                v-model="filterStatus"
                :options="['Completed', 'Failed', 'Cancelled']"
                label="Status"
                outlined
                dense
                clearable
                style="width: 150px"
              />
              <q-btn color="primary" icon="download" label="Export" @click="exportHistory" />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Statistics -->
      <div class="col-12 col-md-3">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-subtitle2 text-grey">Total Tasks</div>
            <div class="text-h4 text-primary">{{ totalTasks }}</div>
            <q-linear-progress :value="1" color="primary" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-subtitle2 text-grey">Completed</div>
            <div class="text-h4 text-positive">{{ completedTasks }}</div>
            <q-linear-progress :value="completedRate" color="positive" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-subtitle2 text-grey">Success Rate</div>
            <div class="text-h4">{{ successRate }}%</div>
            <q-linear-progress :value="successRate / 100" color="secondary" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-subtitle2 text-grey">Total Time</div>
            <div class="text-h4">{{ totalTime }}</div>
            <q-linear-progress :value="1" color="info" class="q-mt-sm" />
          </q-card-section>
        </q-card>
      </div>

      <!-- History Table -->
      <div class="col-12">
        <q-card class="nature-card">
          <q-card-section>
            <q-table
              :rows="filteredHistory"
              :columns="columns"
              row-key="id"
              :pagination="pagination"
              flat
            >
              <template v-slot:body-cell-status="props">
                <q-td :props="props">
                  <q-chip
                    :color="getStatusColor(props.value)"
                    text-color="white"
                    size="sm"
                  >
                    {{ props.value }}
                  </q-chip>
                </q-td>
              </template>
              
              <template v-slot:body-cell-type="props">
                <q-td :props="props">
                  <q-icon
                    :name="getTaskIcon(props.value)"
                    :color="getTaskColor(props.value)"
                    size="sm"
                    class="q-mr-xs"
                  />
                  {{ props.value }}
                </q-td>
              </template>

              <template v-slot:body-cell-actions="props">
                <q-td :props="props">
                  <q-btn flat round icon="info" size="sm" @click="showDetails(props.row)">
                    <q-tooltip>View Details</q-tooltip>
                  </q-btn>
                  <q-btn flat round icon="replay" size="sm" @click="rerunTask(props.row)">
                    <q-tooltip>Run Again</q-tooltip>
                  </q-btn>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Task Details Dialog -->
    <q-dialog v-model="showDetailsDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Task Details</div>
        </q-card-section>
        
        <q-card-section v-if="selectedTask">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label overline>Name</q-item-label>
                <q-item-label>{{ selectedTask.name }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label overline>Type</q-item-label>
                <q-item-label>{{ selectedTask.type }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label overline>Date</q-item-label>
                <q-item-label>{{ selectedTask.date }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label overline>Duration</q-item-label>
                <q-item-label>{{ selectedTask.duration }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label overline>Status</q-item-label>
                <q-item-label>
                  <q-chip
                    :color="getStatusColor(selectedTask.status)"
                    text-color="white"
                  >
                    {{ selectedTask.status }}
                  </q-chip>
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="selectedTask.notes">
              <q-item-section>
                <q-item-label overline>Notes</q-item-label>
                <q-item-label>{{ selectedTask.notes }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { date } from 'quasar';

interface TaskHistory {
  id: string;
  name: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: 'Completed' | 'Failed' | 'Cancelled';
  notes?: string;
}

// State
const dateRange = ref(null);
const filterType = ref(null);
const filterStatus = ref(null);
const showDetailsDialog = ref(false);
const selectedTask = ref<TaskHistory | null>(null);

const taskTypes = ['mowing', 'edging', 'trimming', 'mulching', 'watering'];

const pagination = ref({
  sortBy: 'date',
  descending: true,
  page: 1,
  rowsPerPage: 10
});

const columns = [
  { name: 'date', label: 'Date', field: 'date', align: 'left', sortable: true },
  { name: 'name', label: 'Task Name', field: 'name', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left', sortable: true },
  { name: 'startTime', label: 'Start', field: 'startTime', align: 'center' },
  { name: 'endTime', label: 'End', field: 'endTime', align: 'center' },
  { name: 'duration', label: 'Duration', field: 'duration', align: 'center' },
  { name: 'status', label: 'Status', field: 'status', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' }
];

const history = ref<TaskHistory[]>([
  {
    id: '1',
    name: 'Front Yard Mowing',
    type: 'mowing',
    date: date.formatDate(new Date(), 'YYYY-MM-DD'),
    startTime: '09:00 AM',
    endTime: '10:30 AM',
    duration: '1h 30m',
    status: 'Completed'
  },
  {
    id: '2',
    name: 'Driveway Edging',
    type: 'edging',
    date: date.formatDate(new Date(), 'YYYY-MM-DD'),
    startTime: '10:45 AM',
    endTime: '11:15 AM',
    duration: '30m',
    status: 'Completed'
  },
  {
    id: '3',
    name: 'Back Yard Mowing',
    type: 'mowing',
    date: date.formatDate(date.subtractFromDate(new Date(), { days: 1 }), 'YYYY-MM-DD'),
    startTime: '02:00 PM',
    endTime: '02:45 PM',
    duration: '45m',
    status: 'Failed',
    notes: 'Battery ran out'
  },
  {
    id: '4',
    name: 'Bush Trimming',
    type: 'trimming',
    date: date.formatDate(date.subtractFromDate(new Date(), { days: 2 }), 'YYYY-MM-DD'),
    startTime: '11:00 AM',
    endTime: '12:00 PM',
    duration: '1h',
    status: 'Completed'
  }
]);

// Computed
const filteredHistory = computed(() => {
  let filtered = [...history.value];
  
  if (filterType.value) {
    filtered = filtered.filter(task => task.type === filterType.value);
  }
  
  if (filterStatus.value) {
    filtered = filtered.filter(task => task.status === filterStatus.value);
  }
  
  return filtered;
});

const totalTasks = computed(() => filteredHistory.value.length);
const completedTasks = computed(() => 
  filteredHistory.value.filter(t => t.status === 'Completed').length
);
const completedRate = computed(() => 
  totalTasks.value > 0 ? completedTasks.value / totalTasks.value : 0
);
const successRate = computed(() => 
  Math.round(completedRate.value * 100)
);
const totalTime = computed(() => {
  // Calculate total time from all tasks
  return '24h 15m';
});

// Methods
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Completed: 'positive',
    Failed: 'negative',
    Cancelled: 'warning'
  };
  return colors[status] || 'grey';
}

function getTaskColor(type: string): string {
  const colors: Record<string, string> = {
    mowing: 'primary',
    edging: 'secondary',
    trimming: 'warning',
    mulching: 'brown',
    watering: 'blue'
  };
  return colors[type] || 'grey';
}

function getTaskIcon(type: string): string {
  const icons: Record<string, string> = {
    mowing: 'grass',
    edging: 'border_outer',
    trimming: 'cut',
    mulching: 'layers',
    watering: 'water_drop'
  };
  return icons[type] || 'task';
}

function showDetails(task: TaskHistory) {
  selectedTask.value = task;
  showDetailsDialog.value = true;
}

function rerunTask(task: TaskHistory) {
  console.log('Rerunning task:', task);
}

function exportHistory() {
  console.log('Exporting history');
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.history-page {
  min-height: calc(100vh - 100px);
}
</style>