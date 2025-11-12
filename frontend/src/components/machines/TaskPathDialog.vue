<template>
  <q-card class="task-path-dialog">
    <q-card-section class="task-path-dialog__header">
      <div class="task-path-dialog__title-section">
        <q-icon name="route" size="32px" color="primary" class="q-mr-md" />
        <div>
          <div class="text-h6">Task Path</div>
          <div class="text-subtitle2 text-grey-6">
            {{ task.title }} - Path visualization and details
          </div>
        </div>
      </div>

      <q-btn flat round icon="close" @click="closeDialog" />
    </q-card-section>

    <q-separator />

    <q-card-section class="task-path-dialog__content">
      <div class="task-path-dialog__main">
        <!-- Path Map/Visualization -->
        <div class="task-path-dialog__map-container">
          <div class="task-path-dialog__map-header">
            <h6 class="q-mb-md">Path Visualization</h6>
            <div class="task-path-dialog__controls">
              <q-btn-group outline>
                <q-btn
                  :color="viewMode === 'overview' ? 'primary' : 'grey'"
                  label="Overview"
                  size="sm"
                  @click="viewMode = 'overview'"
                />
                <q-btn
                  :color="viewMode === 'detailed' ? 'primary' : 'grey'"
                  label="Detailed"
                  size="sm"
                  @click="viewMode = 'detailed'"
                />
              </q-btn-group>
            </div>
          </div>

          <!-- Map Placeholder -->
          <div class="task-path-dialog__map">
            <div class="task-path-dialog__map-placeholder">
              <q-icon name="map" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">Path Map</div>
              <div class="text-body2 text-grey-5">
                Interactive path visualization would be displayed here
              </div>

              <!-- Mock path data visualization -->
              <div class="task-path-dialog__path-stats q-mt-lg">
                <div class="row q-col-gutter-md">
                  <div class="col-3">
                    <q-card flat class="task-path-dialog__stat-card">
                      <q-card-section class="text-center">
                        <q-icon name="straighten" size="24px" color="primary" />
                        <div class="text-h6 q-mt-sm">{{ pathStats.totalDistance }}m</div>
                        <div class="text-caption text-grey-6">Distance</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-3">
                    <q-card flat class="task-path-dialog__stat-card">
                      <q-card-section class="text-center">
                        <q-icon name="speed" size="24px" color="green" />
                        <div class="text-h6 q-mt-sm">{{ pathStats.avgSpeed }}m/s</div>
                        <div class="text-caption text-grey-6">Avg Speed</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-3">
                    <q-card flat class="task-path-dialog__stat-card">
                      <q-card-section class="text-center">
                        <q-icon name="turn_right" size="24px" color="orange" />
                        <div class="text-h6 q-mt-sm">{{ pathStats.turns }}</div>
                        <div class="text-caption text-grey-6">Turns</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-3">
                    <q-card flat class="task-path-dialog__stat-card">
                      <q-card-section class="text-center">
                        <q-icon name="pause" size="24px" color="blue" />
                        <div class="text-h6 q-mt-sm">{{ pathStats.pauses }}</div>
                        <div class="text-caption text-grey-6">Pauses</div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Path Details -->
        <div class="task-path-dialog__details">
          <h6 class="q-mb-md">Path Details</h6>

          <!-- Navigation Events -->
          <q-list bordered class="task-path-dialog__events">
            <q-item-label header>Navigation Events</q-item-label>
            <q-item
              v-for="event in navigationEvents"
              :key="event.id"
              class="task-path-dialog__event-item"
            >
              <q-item-section avatar>
                <q-icon :name="event.icon" :color="event.color" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ event.title }}</q-item-label>
                <q-item-label caption>
                  {{ event.timestamp }} - {{ event.description }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip v-if="event.duration" :color="event.color" text-color="white" size="sm">
                  {{ event.duration }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Waypoints -->
          <div class="task-path-dialog__waypoints q-mt-lg">
            <h6 class="q-mb-md">Key Waypoints</h6>
            <q-list bordered dense>
              <q-item
                v-for="waypoint in waypoints"
                :key="waypoint.id"
                class="task-path-dialog__waypoint-item"
              >
                <q-item-section avatar>
                  <q-icon :name="waypoint.icon" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ waypoint.name }}</q-item-label>
                  <q-item-label caption>
                    {{ waypoint.coordinates.lat.toFixed(6) }},
                    {{ waypoint.coordinates.lng.toFixed(6) }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label caption>{{ waypoint.timestamp }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right" class="q-pa-md">
      <q-btn flat label="Export Path" color="grey" icon="download" @click="exportPath" />
      <q-btn flat label="Close" color="primary" @click="closeDialog" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

// Props
interface HistoryItem {
  id: string
  title: string
  type: 'mowing' | 'trimming' | 'maintenance' | 'charging' | 'navigation'
  status: 'completed' | 'failed' | 'cancelled' | 'paused'
  startTime: string
  endTime?: string
  duration: number
  areaCovered?: number
  efficiency?: number
  notes?: string
  errors?: string[]
}

interface Props {
  task: HistoryItem
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
}>()

// Composables
const $q = useQuasar()

// Local state
const viewMode = ref<'overview' | 'detailed'>('overview')

// Mock data for demonstration
const pathStats = computed(() => ({
  totalDistance: 1250,
  avgSpeed: 0.8,
  turns: 42,
  pauses: 3
}))

const navigationEvents = computed(() => [
  {
    id: '1',
    title: 'Task Started',
    description: 'Started mowing operation from docking station',
    timestamp: formatTime(props.task.startTime),
    icon: 'play_arrow',
    color: 'green',
    duration: null
  },
  {
    id: '2',
    title: 'Obstacle Detected',
    description: 'Stopped for obstacle avoidance',
    timestamp: formatTime(addMinutes(props.task.startTime, 15)),
    icon: 'warning',
    color: 'orange',
    duration: '30s'
  },
  {
    id: '3',
    title: 'Area Change',
    description: 'Moved to new mowing zone',
    timestamp: formatTime(addMinutes(props.task.startTime, 45)),
    icon: 'swap_horiz',
    color: 'blue',
    duration: null
  },
  {
    id: '4',
    title: 'Low Battery',
    description: 'Paused for charging cycle',
    timestamp: formatTime(addMinutes(props.task.startTime, 90)),
    icon: 'battery_alert',
    color: 'red',
    duration: '45min'
  },
  {
    id: '5',
    title: 'Task Completed',
    description: 'Returned to docking station',
    timestamp: props.task.endTime ? formatTime(props.task.endTime) : 'N/A',
    icon: 'check_circle',
    color: 'green',
    duration: null
  }
])

const waypoints = computed(() => [
  {
    id: '1',
    name: 'Start Position',
    coordinates: { lat: 40.7128, lng: -74.006 },
    timestamp: formatTime(props.task.startTime),
    icon: 'place'
  },
  {
    id: '2',
    name: 'Zone A Entry',
    coordinates: { lat: 40.71285, lng: -74.00595 },
    timestamp: formatTime(addMinutes(props.task.startTime, 10)),
    icon: 'location_on'
  },
  {
    id: '3',
    name: 'Obstacle Point',
    coordinates: { lat: 40.7129, lng: -74.0059 },
    timestamp: formatTime(addMinutes(props.task.startTime, 15)),
    icon: 'warning'
  },
  {
    id: '4',
    name: 'Zone B Entry',
    coordinates: { lat: 40.71295, lng: -74.00585 },
    timestamp: formatTime(addMinutes(props.task.startTime, 45)),
    icon: 'location_on'
  },
  {
    id: '5',
    name: 'Charging Station',
    coordinates: { lat: 40.713, lng: -74.0058 },
    timestamp: formatTime(addMinutes(props.task.startTime, 90)),
    icon: 'ev_station'
  },
  {
    id: '6',
    name: 'End Position',
    coordinates: { lat: 40.7128, lng: -74.006 },
    timestamp: props.task.endTime ? formatTime(props.task.endTime) : 'N/A',
    icon: 'flag'
  }
])

// Methods
const formatTime = (dateTimeString: string) => {
  try {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString()
  } catch {
    return dateTimeString
  }
}

const addMinutes = (dateTimeString: string, minutes: number) => {
  try {
    const date = new Date(dateTimeString)
    date.setMinutes(date.getMinutes() + minutes)
    return date.toISOString()
  } catch {
    return dateTimeString
  }
}

const exportPath = () => {
  $q.notify({
    type: 'info',
    message: 'Path data export feature would be implemented here',
    position: 'top'
  })
}

const closeDialog = () => {
  emit('close')
}
</script>

<style scoped lang="scss">
.task-path-dialog {
  width: 1000px;
  max-width: 95vw;
  height: 700px;
  max-height: 95vh;

  &__header {
    background-color: var(--q-primary);
    color: white;

    .task-path-dialog__title-section {
      display: flex;
      align-items: center;
    }
  }

  &__content {
    height: calc(100% - 120px);
    overflow-y: auto;
  }

  &__main {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
    height: 100%;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 16px;
    }
  }

  &__map-container {
    display: flex;
    flex-direction: column;
  }

  &__map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h6 {
      margin: 0;
      color: var(--q-primary);
    }
  }

  &__map {
    flex: 1;
    border: 2px dashed #e0e0e0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    background: #fafafa;
  }

  &__map-placeholder {
    text-align: center;
    padding: 32px;
  }

  &__path-stats {
    max-width: 400px;
    margin: 0 auto;
  }

  &__stat-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  &__details {
    h6 {
      margin-top: 0;
      color: var(--q-primary);
    }
  }

  &__events {
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  &__event-item {
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }

  &__waypoints {
    .q-list {
      border-radius: 8px;
      max-height: 250px;
      overflow-y: auto;
    }
  }

  &__waypoint-item {
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }
}
</style>
