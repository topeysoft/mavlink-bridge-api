<template>
  <q-card flat bordered class="activity-feed">
    <q-card-section class="activity-feed__header">
      <div class="row items-center justify-between">
        <div>
          <h3 class="activity-feed__title">Recent Activity</h3>
          <p class="activity-feed__subtitle">Live updates from your yard</p>
        </div>

        <div class="activity-feed__actions">
          <q-btn flat round dense icon="filter_list" @click="showFilters = !showFilters">
            <q-tooltip>Filter Activities</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="refresh" :loading="loading" @click="$emit('refresh')">
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>

          <q-btn flat round dense icon="fullscreen" @click="$emit('expand')">
            <q-tooltip>View All</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Filters -->
      <q-slide-transition>
        <div v-show="showFilters" class="activity-feed__filters q-mt-md">
          <q-chip-group
            v-model="selectedFilters"
            multiple
            color="primary"
            class="activity-feed__filter-chips"
          >
            <q-chip
              v-for="filter in availableFilters"
              :key="filter.value"
              :val="filter.value"
              :icon="filter.icon"
              removable
              outline
            >
              {{ filter.label }}
            </q-chip>
          </q-chip-group>
        </div>
      </q-slide-transition>
    </q-card-section>

    <q-separator />

    <!-- Activity List -->
    <q-card-section class="activity-feed__content">
      <div v-if="filteredActivities.length === 0" class="activity-feed__empty">
        <q-icon name="timeline" size="48px" class="text-grey-4" />
        <div class="text-grey-6 q-mt-md">
          {{ loading ? 'Loading activities...' : 'No recent activity' }}
        </div>
      </div>

      <q-timeline v-else color="primary" class="activity-feed__timeline">
        <q-timeline-entry
          v-for="activity in displayActivities"
          :key="activity.id"
          :color="activityColor(activity.type)"
          :icon="activityIcon(activity.type)"
          :title="activity.title"
          :subtitle="formatTime(activity.timestamp)"
          class="activity-feed__entry"
        >
          <div class="activity-feed__entry-content">
            <div class="activity-feed__entry-description">
              {{ activity.description }}
            </div>

            <div v-if="activity.metadata" class="activity-feed__entry-metadata">
              <q-chip
                v-for="(value, key) in activity.metadata"
                :key="key"
                size="sm"
                outline
                dense
                class="activity-feed__metadata-chip"
              >
                <span class="activity-feed__metadata-key">{{ key }}:</span>
                <span class="activity-feed__metadata-value">{{ value }}</span>
              </q-chip>
            </div>

            <div
              v-if="activity.actions && activity.actions.length > 0"
              class="activity-feed__entry-actions"
            >
              <q-btn
                v-for="action in activity.actions"
                :key="action.id"
                flat
                dense
                size="sm"
                :color="action.color || 'primary'"
                :icon="action.icon"
                :label="action.label"
                @click="handleActivityAction(action, activity)"
              />
            </div>
          </div>
        </q-timeline-entry>

        <!-- Load more button -->
        <q-timeline-entry
          v-if="hasMoreActivities"
          color="grey"
          icon="more_horiz"
          class="activity-feed__load-more"
        >
          <q-btn
            flat
            color="primary"
            label="Load More Activities"
            :loading="loadingMore"
            @click="$emit('load-more')"
          />
        </q-timeline-entry>
      </q-timeline>
    </q-card-section>

    <!-- Auto-refresh indicator -->
    <div v-if="autoRefresh" class="activity-feed__auto-refresh">
      <q-linear-progress
        :value="refreshProgress"
        color="primary"
        size="2px"
        animation-speed="200"
      />
    </div>

    <!-- Loading overlay -->
    <q-inner-loading :showing="loading && activities.length === 0" color="primary" />
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

// Types
interface ActivityAction {
  id: string
  label: string
  icon?: string
  color?: string
  handler: string
}

interface Activity {
  id: string
  type: 'machine' | 'task' | 'system' | 'weather' | 'alert' | 'user'
  title: string
  description: string
  timestamp: string
  metadata?: Record<string, string | number>
  actions?: ActivityAction[]
  priority?: 'low' | 'normal' | 'high' | 'critical'
}

interface FilterOption {
  value: string
  label: string
  icon: string
}

interface Props {
  activities: Activity[]
  maxItems?: number
  autoRefresh?: boolean
  refreshInterval?: number
  loading?: boolean
  loadingMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxItems: 10,
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  loading: false,
  loadingMore: false
})

// Emits
defineEmits<{
  refresh: []
  expand: []
  'load-more': []
  'activity-action': [action: ActivityAction, activity: Activity]
}>()

// Local state
const showFilters = ref(false)
const selectedFilters = ref<string[]>([])
const refreshProgress = ref(0)
const refreshTimer = ref<number | null>(null)
const progressTimer = ref<number | null>(null)

// Available filters
const availableFilters: FilterOption[] = [
  { value: 'machine', label: 'Machines', icon: 'precision_manufacturing' },
  { value: 'task', label: 'Tasks', icon: 'assignment' },
  { value: 'system', label: 'System', icon: 'settings' },
  { value: 'weather', label: 'Weather', icon: 'wb_sunny' },
  { value: 'alert', label: 'Alerts', icon: 'warning' },
  { value: 'user', label: 'User Actions', icon: 'person' }
]

// Computed properties
const filteredActivities = computed(() => {
  if (selectedFilters.value.length === 0) {
    return props.activities
  }
  return props.activities.filter(activity => selectedFilters.value.includes(activity.type))
})

const displayActivities = computed(() => filteredActivities.value.slice(0, props.maxItems))

const hasMoreActivities = computed(() => filteredActivities.value.length > props.maxItems)

// Watch for auto-refresh
watch(
  () => props.autoRefresh,
  enabled => {
    if (enabled) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  },
  { immediate: true }
)

// Lifecycle
onMounted(() => {
  if (props.autoRefresh) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

// Methods
const activityColor = (type: string) => {
  switch (type) {
    case 'machine':
      return 'primary'
    case 'task':
      return 'info'
    case 'system':
      return 'secondary'
    case 'weather':
      return 'warning'
    case 'alert':
      return 'negative'
    case 'user':
      return 'positive'
    default:
      return 'grey'
  }
}

const activityIcon = (type: string) => {
  switch (type) {
    case 'machine':
      return 'precision_manufacturing'
    case 'task':
      return 'assignment'
    case 'system':
      return 'settings'
    case 'weather':
      return 'wb_sunny'
    case 'alert':
      return 'warning'
    case 'user':
      return 'person'
    default:
      return 'info'
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else if (seconds > 10) {
    return `${seconds}s ago`
  } else {
    return 'Just now'
  }
}

const handleActivityAction = (action: ActivityAction, activity: Activity) => {
  // emit('activity-action', action, activity);
}

const startAutoRefresh = () => {
  stopAutoRefresh() // Clear any existing timers

  refreshTimer.value = window.setInterval(() => {
    // emit('refresh');
  }, props.refreshInterval)

  // Progress indicator
  const progressStep = 100 / (props.refreshInterval / 200) // Update every 200ms
  progressTimer.value = window.setInterval(() => {
    refreshProgress.value += progressStep
    if (refreshProgress.value >= 100) {
      refreshProgress.value = 0
    }
  }, 200)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }

  if (progressTimer.value) {
    clearInterval(progressTimer.value)
    progressTimer.value = null
  }

  refreshProgress.value = 0
}
</script>

<style lang="scss" scoped>
.activity-feed {
  border-radius: 12px;
}

.activity-feed__header {
  padding: 20px 24px 16px;
}

.activity-feed__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.activity-feed__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 0;
}

.activity-feed__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.activity-feed__filters {
  padding: 12px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);

  .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.05);
  }
}

.activity-feed__filter-chips {
  margin: 0;
}

.activity-feed__content {
  padding: 0;
  min-height: 300px;
}

.activity-feed__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 40px 24px;
}

.activity-feed__timeline {
  padding: 24px;

  :deep(.q-timeline__subtitle) {
    font-size: 0.75rem;
    opacity: 0.7;
  }
}

.activity-feed__entry {
  :deep(.q-timeline__dot) {
    border-width: 2px;
  }
}

.activity-feed__entry-content {
  margin-top: 8px;
}

.activity-feed__entry-description {
  font-size: 0.875rem;
  color: var(--q-dark);
  line-height: 1.4;
  margin-bottom: 8px;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.activity-feed__entry-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.activity-feed__metadata-chip {
  font-size: 0.7rem;
  height: 20px;
}

.activity-feed__metadata-key {
  opacity: 0.7;
  margin-right: 2px;
}

.activity-feed__metadata-value {
  font-weight: 600;
}

.activity-feed__entry-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.activity-feed__load-more {
  :deep(.q-timeline__content) {
    padding-top: 8px;
  }
}

.activity-feed__auto-refresh {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .activity-feed__header {
    padding: 16px 20px 12px;

    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .activity-feed__actions {
      justify-content: center;
    }
  }

  .activity-feed__timeline {
    padding: 20px;
  }
}

@media (max-width: 599px) {
  .activity-feed__header {
    padding: 12px 16px;
  }

  .activity-feed__timeline {
    padding: 16px;
  }

  .activity-feed__empty {
    padding: 30px 16px;
  }

  .activity-feed__entry-actions {
    flex-direction: column;
    gap: 4px;
  }

  .activity-feed__filter-chips {
    justify-content: center;
  }
}

// Animation for new activities
.activity-feed__entry {
  &.activity-new {
    animation: slideInFromTop 0.3s ease-out;
  }
}

@keyframes slideInFromTop {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
