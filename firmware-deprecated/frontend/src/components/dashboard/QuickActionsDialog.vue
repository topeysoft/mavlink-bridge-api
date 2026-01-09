<template>
  <q-card class="quick-actions-dialog">
    <q-card-section class="quick-actions-dialog__header">
      <div class="row items-center justify-between">
        <h2 class="quick-actions-dialog__title">Quick Actions</h2>
        <q-btn flat round dense icon="close" @click="$emit('close')" />
      </div>
      <p class="quick-actions-dialog__subtitle">Perform common tasks quickly and efficiently</p>
    </q-card-section>

    <q-separator />

    <!-- Action Categories -->
    <q-card-section class="quick-actions-dialog__content">
      <q-tabs v-model="activeTab" align="justify" class="quick-actions-dialog__tabs">
        <q-tab
          v-for="category in actionCategories"
          :key="category.id"
          :name="category.id"
          :icon="category.icon"
          :label="category.label"
        />
      </q-tabs>

      <q-separator class="q-my-md" />

      <q-tab-panels v-model="activeTab" animated class="quick-actions-dialog__panels">
        <q-tab-panel
          v-for="category in actionCategories"
          :key="category.id"
          :name="category.id"
          class="quick-actions-dialog__panel"
        >
          <div class="quick-actions-grid">
            <QuickActionCard
              v-for="action in category.actions"
              :key="action.id"
              :action="action"
              @click="handleAction(action)"
            />
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card-section>

    <!-- Recent Actions -->
    <q-separator />
    <q-card-section class="quick-actions-dialog__recent">
      <h4 class="quick-actions-dialog__recent-title">Recent Actions</h4>

      <div v-if="recentActions.length === 0" class="quick-actions-dialog__recent-empty">
        <q-icon name="history" size="32px" class="text-grey-4" />
        <div class="text-grey-6 q-mt-sm">No recent actions</div>
      </div>

      <q-list v-else dense class="quick-actions-dialog__recent-list">
        <q-item
          v-for="action in recentActions.slice(0, 5)"
          :key="`recent-${action.id}-${action.timestamp}`"
          clickable
          @click="handleAction(action)"
        >
          <q-item-section avatar>
            <q-icon :name="action.icon" :color="action.color || 'primary'" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ action.label }}</q-item-label>
            <q-item-label caption>
              {{ formatTime(action.timestamp || '') }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn flat round dense size="sm" icon="replay" @click.stop="handleAction(action)">
              <q-tooltip>Repeat Action</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <!-- Footer -->
    <q-card-actions align="right" class="quick-actions-dialog__footer">
      <q-btn flat label="Cancel" @click="$emit('close')" />
      <q-btn unelevated color="primary" label="Create Custom Action" @click="createCustomAction" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

// Components
import QuickActionCard from './QuickActionCard.vue'

// Types
interface QuickAction {
  id: string
  label: string
  description?: string
  icon: string
  color?: string
  category: string
  urgent?: boolean
  disabled?: boolean
  requiresConfirmation?: boolean
  timestamp?: string
}

interface ActionCategory {
  id: string
  label: string
  icon: string
  actions: QuickAction[]
}

// Emits
defineEmits<{
  close: []
  action: [actionId: string]
}>()

// Composables
const $q = useQuasar()

// Local state
const activeTab = ref('machines')
const recentActions = ref<QuickAction[]>([
  {
    id: 'start-mowing',
    label: 'Start Mowing',
    icon: 'grass',
    color: 'positive',
    category: 'machines',
    timestamp: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
  },
  {
    id: 'emergency-stop',
    label: 'Emergency Stop',
    icon: 'stop',
    color: 'negative',
    category: 'safety',
    timestamp: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
  }
])

// Action categories
const actionCategories = computed((): ActionCategory[] => [
  {
    id: 'machines',
    label: 'Machines',
    icon: 'precision_manufacturing',
    actions: [
      {
        id: 'start-all-machines',
        label: 'Start All Machines',
        description: 'Activate all available machines',
        icon: 'play_arrow',
        color: 'positive',
        category: 'machines'
      },
      {
        id: 'stop-all-machines',
        label: 'Stop All Machines',
        description: 'Safely stop all running machines',
        icon: 'stop',
        color: 'negative',
        category: 'machines',
        requiresConfirmation: true
      },
      {
        id: 'return-to-base',
        label: 'Return to Base',
        description: 'Send all machines back to charging station',
        icon: 'home',
        color: 'info',
        category: 'machines'
      },
      {
        id: 'maintenance-mode',
        label: 'Maintenance Mode',
        description: 'Put all machines in maintenance mode',
        icon: 'build',
        color: 'warning',
        category: 'machines'
      }
    ]
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'assignment',
    actions: [
      {
        id: 'start-mowing',
        label: 'Start Mowing',
        description: 'Begin automated mowing task',
        icon: 'grass',
        color: 'positive',
        category: 'tasks'
      },
      {
        id: 'schedule-weekly-mow',
        label: 'Schedule Weekly Mow',
        description: 'Set up recurring weekly mowing',
        icon: 'schedule',
        color: 'primary',
        category: 'tasks'
      },
      {
        id: 'edge-trimming',
        label: 'Edge Trimming',
        description: 'Start edge and border trimming',
        icon: 'content_cut',
        color: 'info',
        category: 'tasks'
      },
      {
        id: 'spot-cleaning',
        label: 'Spot Cleaning',
        description: 'Clean specific areas',
        icon: 'cleaning_services',
        color: 'secondary',
        category: 'tasks'
      }
    ]
  },
  {
    id: 'safety',
    label: 'Safety',
    icon: 'security',
    actions: [
      {
        id: 'emergency-stop',
        label: 'Emergency Stop',
        description: 'Immediately stop all operations',
        icon: 'stop',
        color: 'negative',
        category: 'safety',
        urgent: true,
        requiresConfirmation: true
      },
      {
        id: 'pause-all',
        label: 'Pause All',
        description: 'Temporarily pause all activities',
        icon: 'pause',
        color: 'warning',
        category: 'safety'
      },
      {
        id: 'enable-rain-mode',
        label: 'Enable Rain Mode',
        description: 'Activate weather protection protocols',
        icon: 'umbrella',
        color: 'info',
        category: 'safety'
      },
      {
        id: 'night-mode',
        label: 'Night Mode',
        description: 'Switch to night operation settings',
        icon: 'nightlight',
        color: 'secondary',
        category: 'safety'
      }
    ]
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'monitor',
    actions: [
      {
        id: 'view-live-cameras',
        label: 'View Live Cameras',
        description: 'Open camera monitoring dashboard',
        icon: 'videocam',
        color: 'primary',
        category: 'monitoring'
      },
      {
        id: 'generate-report',
        label: 'Generate Report',
        description: 'Create performance and activity report',
        icon: 'assessment',
        color: 'info',
        category: 'monitoring'
      },
      {
        id: 'check-system-health',
        label: 'System Health Check',
        description: 'Run comprehensive system diagnostics',
        icon: 'health_and_safety',
        color: 'positive',
        category: 'monitoring'
      },
      {
        id: 'export-logs',
        label: 'Export Logs',
        description: 'Download system and activity logs',
        icon: 'download',
        color: 'secondary',
        category: 'monitoring'
      }
    ]
  }
])

// Methods
const handleAction = (action: QuickAction) => {
  // Add to recent actions if not already there
  const existingIndex = recentActions.value.findIndex(a => a.id === action.id)
  if (existingIndex === -1) {
    recentActions.value.unshift({
      ...action,
      timestamp: new Date().toISOString()
    })

    // Keep only last 10 recent actions
    if (recentActions.value.length > 10) {
      recentActions.value = recentActions.value.slice(0, 10)
    }
  } else {
    // Update timestamp for existing action
    recentActions.value[existingIndex].timestamp = new Date().toISOString()

    // Move to front
    const [existingAction] = recentActions.value.splice(existingIndex, 1)
    recentActions.value.unshift(existingAction)
  }

  // emit('action', action.id);
  // emit('close');
}

const createCustomAction = () => {
  $q.dialog({
    title: 'Create Custom Action',
    message: 'This feature will allow you to create custom quick actions.',
    ok: 'Got it'
  })
}

const formatTime = (timestamp: string) => {
  if (!timestamp) return 'Unknown'

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}
</script>

<style lang="scss" scoped>
.quick-actions-dialog {
  min-width: 600px;
  max-width: 800px;
  max-height: 80vh;
}

.quick-actions-dialog__header {
  padding: 24px 24px 16px;
}

.quick-actions-dialog__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.quick-actions-dialog__subtitle {
  font-size: 0.875rem;
  color: var(--q-grey-7);
  margin: 8px 0 0 0;
}

.quick-actions-dialog__content {
  padding: 0 24px;
  max-height: 400px;
  overflow-y: auto;
}

.quick-actions-dialog__tabs {
  .q-tab {
    font-weight: 500;
  }
}

.quick-actions-dialog__panels {
  background: transparent;
}

.quick-actions-dialog__panel {
  padding: 0;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.quick-actions-dialog__recent {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.quick-actions-dialog__recent-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.quick-actions-dialog__recent-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  text-align: center;
}

.quick-actions-dialog__recent-list {
  .q-item {
    border-radius: 8px;
    margin-bottom: 4px;

    &:hover {
      background-color: rgba(var(--q-primary-rgb), 0.1);
    }
  }
}

.quick-actions-dialog__footer {
  padding: 16px 24px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

// Responsive adjustments
@media (max-width: 699px) {
  .quick-actions-dialog {
    min-width: unset;
    width: 95vw;
    max-width: 95vw;
  }

  .quick-actions-dialog__header {
    padding: 20px 20px 12px;
  }

  .quick-actions-dialog__content {
    padding: 0 20px;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .quick-actions-dialog__recent {
    padding: 12px 20px;
  }

  .quick-actions-dialog__footer {
    padding: 12px 20px;
  }

  .quick-actions-dialog__tabs {
    .q-tab {
      font-size: 0.8rem;
      min-height: 40px;
    }
  }
}

@media (max-width: 479px) {
  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .quick-actions-dialog__tabs {
    .q-tab {
      padding: 8px 4px;

      .q-tab__label {
        font-size: 0.7rem;
      }
    }
  }
}

// Scrollbar styling
.quick-actions-dialog__content {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    .body--dark & {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}
</style>
