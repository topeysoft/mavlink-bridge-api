<template>
  <q-page class="schedule-page q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Calendar View -->
      <div class="col-12 col-lg-8">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="calendar_month" class="q-mr-sm" />
              Task Schedule
            </div>
            
            <!-- Calendar Toolbar -->
            <div class="row items-center q-mb-md">
              <q-btn flat round icon="chevron_left" @click="previousMonth" />
              <div class="col text-center text-h6">
                {{ currentMonthYear }}
              </div>
              <q-btn flat round icon="chevron_right" @click="nextMonth" />
            </div>

            <!-- Calendar Grid -->
            <div class="calendar-grid">
              <div v-for="day in weekDays" :key="day" class="calendar-header">
                {{ day }}
              </div>
              <div
                v-for="(date, index) in calendarDates"
                :key="index"
                class="calendar-date"
                :class="{
                  'other-month': date.otherMonth,
                  'today': date.isToday,
                  'has-tasks': date.tasks && date.tasks.length > 0
                }"
                @click="selectDate(date)"
              >
                <div class="date-number">{{ date.day }}</div>
                <div v-if="date.tasks" class="task-indicators">
                  <q-badge
                    v-for="task in date.tasks.slice(0, 2)"
                    :key="task.id"
                    :color="getTaskColor(task.type)"
                    class="q-ma-xs"
                  />
                  <q-badge
                    v-if="date.tasks.length > 2"
                    color="grey"
                    :label="`+${date.tasks.length - 2}`"
                  />
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Scheduled Tasks Sidebar -->
      <div class="col-12 col-lg-4">
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="event" class="q-mr-sm" />
              {{ selectedDate ? formatDate(selectedDate.date) : 'Select a Date' }}
            </div>
            
            <q-list separator v-if="selectedTasks.length > 0">
              <q-item v-for="task in selectedTasks" :key="task.id">
                <q-item-section avatar>
                  <q-icon :name="getTaskIcon(task.type)" :color="getTaskColor(task.type)" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ task.name }}</q-item-label>
                  <q-item-label caption>
                    {{ formatTime(task.time) }} - {{ task.duration }} min
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round icon="edit" size="sm" @click="editTask(task)" />
                </q-item-section>
              </q-item>
            </q-list>
            
            <div v-else class="text-center text-grey q-py-md">
              No tasks scheduled for this date
            </div>
            
            <q-btn
              color="primary"
              icon="add"
              label="Schedule Task"
              class="full-width q-mt-md"
              @click="showScheduleDialog = true"
            />
          </q-card-section>
        </q-card>

        <!-- Recurring Tasks -->
        <q-card class="nature-card q-mt-md">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="repeat" class="q-mr-sm" />
              Recurring Tasks
            </div>
            
            <q-list separator>
              <q-item v-for="task in recurringTasks" :key="task.id">
                <q-item-section avatar>
                  <q-icon :name="getTaskIcon(task.type)" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ task.name }}</q-item-label>
                  <q-item-label caption>
                    {{ task.frequency }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="task.enabled" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Schedule Task Dialog -->
    <q-dialog v-model="showScheduleDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Schedule Task</div>
        </q-card-section>
        
        <q-card-section>
          <q-input v-model="newScheduledTask.name" label="Task Name" outlined />
          <q-select
            v-model="newScheduledTask.type"
            :options="taskTypes"
            label="Task Type"
            outlined
            class="q-mt-md"
          />
          <q-input
            v-model="newScheduledTask.date"
            type="date"
            label="Date"
            outlined
            class="q-mt-md"
          />
          <q-input
            v-model="newScheduledTask.time"
            type="time"
            label="Time"
            outlined
            class="q-mt-md"
          />
          <q-input
            v-model="newScheduledTask.duration"
            type="number"
            label="Duration (minutes)"
            outlined
            class="q-mt-md"
          />
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat label="Schedule" color="primary" @click="scheduleTask" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { date } from 'quasar';

interface ScheduledTask {
  id: string;
  name: string;
  type: string;
  date: Date;
  time: string;
  duration: number;
}

interface CalendarDate {
  day: number;
  date: Date;
  otherMonth: boolean;
  isToday: boolean;
  tasks?: ScheduledTask[];
}

// State
const currentMonth = ref(new Date());
const selectedDate = ref<CalendarDate | null>(null);
const showScheduleDialog = ref(false);

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const taskTypes = ['mowing', 'edging', 'trimming', 'mulching', 'watering'];

const newScheduledTask = ref({
  name: '',
  type: 'mowing',
  date: '',
  time: '',
  duration: 60
});

const scheduledTasks = ref<ScheduledTask[]>([
  {
    id: '1',
    name: 'Weekly Lawn Mowing',
    type: 'mowing',
    date: new Date(),
    time: '09:00',
    duration: 90
  },
  {
    id: '2',
    name: 'Edge Driveway',
    type: 'edging',
    date: new Date(),
    time: '11:00',
    duration: 30
  }
]);

const recurringTasks = ref([
  { id: '1', name: 'Weekly Mowing', type: 'mowing', frequency: 'Every Monday', enabled: true },
  { id: '2', name: 'Bi-weekly Edging', type: 'edging', frequency: 'Every 2 weeks', enabled: true },
  { id: '3', name: 'Monthly Trimming', type: 'trimming', frequency: 'First Sunday', enabled: false }
]);

// Computed
const currentMonthYear = computed(() => {
  return date.formatDate(currentMonth.value, 'MMMM YYYY');
});

const calendarDates = computed(() => {
  const dates: CalendarDate[] = [];
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    dates.push({
      day: currentDate.getDate(),
      date: currentDate,
      otherMonth: currentDate.getMonth() !== month,
      isToday: date.isSameDate(currentDate, new Date(), 'day'),
      tasks: getTasksForDate(currentDate)
    });
  }
  
  return dates;
});

const selectedTasks = computed(() => {
  return selectedDate.value?.tasks || [];
});

// Methods
function getTasksForDate(dateValue: Date): ScheduledTask[] {
  return scheduledTasks.value.filter(task => 
    date.isSameDate(task.date, dateValue, 'day')
  );
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

function formatDate(dateValue: Date): string {
  return date.formatDate(dateValue, 'dddd, MMMM D');
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function previousMonth() {
  const newDate = new Date(currentMonth.value);
  newDate.setMonth(newDate.getMonth() - 1);
  currentMonth.value = newDate;
}

function nextMonth() {
  const newDate = new Date(currentMonth.value);
  newDate.setMonth(newDate.getMonth() + 1);
  currentMonth.value = newDate;
}

function selectDate(date: CalendarDate) {
  selectedDate.value = date;
}

function editTask(task: ScheduledTask) {
  console.log('Editing task:', task);
}

function scheduleTask() {
  const task: ScheduledTask = {
    id: Date.now().toString(),
    name: newScheduledTask.value.name,
    type: newScheduledTask.value.type,
    date: new Date(newScheduledTask.value.date),
    time: newScheduledTask.value.time,
    duration: newScheduledTask.value.duration
  };
  scheduledTasks.value.push(task);
  showScheduleDialog.value = false;
  newScheduledTask.value = {
    name: '',
    type: 'mowing',
    date: '',
    time: '',
    duration: 60
  };
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.schedule-page {
  min-height: calc(100vh - 100px);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.calendar-header {
  background: $primary;
  color: white;
  padding: $spacing-sm;
  text-align: center;
  font-weight: 600;
}

.calendar-date {
  background: white;
  min-height: 80px;
  padding: $spacing-xs;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba($primary, 0.05);
  }

  &.other-month {
    opacity: 0.5;
    background: #fafafa;
  }

  &.today {
    background: rgba($primary, 0.1);

    .date-number {
      color: $primary;
      font-weight: 600;
    }
  }

  &.has-tasks {
    border-left: 3px solid $primary;
  }
}

.date-number {
  font-size: 14px;
  color: $text-primary;
}

.task-indicators {
  margin-top: $spacing-xs;
  display: flex;
  flex-wrap: wrap;
}
</style>