<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBatteryStore } from '@/stores/battery'
import { useConnectionStore } from '@/stores/connection'
import TaskCard from '@/components/consumer/TaskCard.vue'
import SimpleStatusCard from '@/components/consumer/SimpleStatusCard.vue'
import MapPreviewCard from '@/components/dashboard/MapPreviewCard.vue'
import JobWizard from '@/components/consumer/JobWizard.vue'
import HelpTooltip from '@/components/consumer/HelpTooltip.vue'
import { useNotifications } from '@/composables/useNotifications'

const router = useRouter()
const { success } = useNotifications()
const batteryStore = useBatteryStore()
const connectionStore = useConnectionStore()

// Live data from stores
const batteryLevel = computed(() => Math.round(batteryStore.batteryInfo.percent))
const isConnected = computed(() => connectionStore.isConnected)
const currentTask = ref<string>()
const showJobWizard = ref(false)

interface Task {
  id: string
  title: string
  emoji: string
  description: string
  color: string
  route?: string
  action?: () => void
  disabled?: boolean
}

const jobTemplates = [
  {
    id: 1,
    name: 'Weekly Lawn Mowing',
    emoji: '🌱',
    description: 'Regular lawn maintenance every week',
    estimatedTime: '~45 minutes'
  },
  {
    id: 2,
    name: 'Perimeter Patrol',
    emoji: '🚨',
    description: 'Security patrol around property boundaries',
    estimatedTime: '~30 minutes'
  },
  {
    id: 3,
    name: 'Garden Care',
    emoji: '🌻',
    description: 'Maintain flower beds and garden areas',
    estimatedTime: '~60 minutes'
  }
]

const mockZones = [
  { id: '1', name: 'Front Lawn', type: 'Lawn', area: 0.5 },
  { id: '2', name: 'Back Yard', type: 'Lawn', area: 1.2 },
  { id: '3', name: 'Side Garden', type: 'Garden', area: 0.3 }
]

const quickTasks: Task[] = [
  {
    id: 'mow',
    title: 'Start a Job',
    emoji: '🌱',
    description: 'Create and start a new job with easy setup',
    color: '#10b981',
    action: () => { showJobWizard.value = true }
  },
  {
    id: 'schedule',
    title: 'Schedule a Job',
    emoji: '📅',
    description: 'Plan tasks for later or set up recurring jobs',
    color: '#3b82f6',
    route: '/schedule'
  },
  {
    id: 'areas',
    title: 'Manage Areas',
    emoji: '🗺️',
    description: 'Set up or edit your yard zones and boundaries',
    color: '#f59e0b',
    route: '/zones'
  },
  {
    id: 'patrol',
    title: 'View My Jobs',
    emoji: '📋',
    description: 'See all your active and scheduled jobs',
    color: '#8b5cf6',
    route: '/missions'
  }
]

const upcomingJobs = ref([
  {
    id: 1,
    name: 'Weekly Garden Maintenance',
    time: 'Sunday at 8:00 AM',
    emoji: '🌻'
  },
  {
    id: 2,
    name: 'Perimeter Patrol',
    time: 'Today at 6:00 PM',
    emoji: '🚨'
  }
])

function handleTaskClick(task: Task) {
  if (task.disabled) return

  if (task.action) {
    task.action()
  } else if (task.route) {
    router.push(task.route)
  }
}

function handleJobCreated(job: any) {
  console.log('Job created:', job)
  success(`Job "${job.name}" has been ${job.scheduleType === 'now' ? 'started' : 'scheduled'}!`)
  // In real app, this would save to the store/backend
}
</script>

<template>
  <div class="consumer-dashboard">
    <!-- Hero Section -->
    <div class="hero-section">
      <h1 class="hero-title">What would you like to do today?</h1>
      <p class="hero-subtitle">Choose a task to get started with your YardRover</p>
    </div>

    <!-- Status Overview -->
    <SimpleStatusCard
      :battery-level="batteryLevel"
      :is-connected="isConnected"
      :current-task="currentTask"
    />

    <!-- Quick Tasks -->
    <section class="tasks-section">
      <div class="section-header">
        <h2 class="section-title">Quick Tasks</h2>
        <HelpTooltip
          content="These are the most common tasks. Click any card to get started!"
          position="bottom"
        />
      </div>
      <div class="tasks-grid">
        <TaskCard
          v-for="task in quickTasks"
          :key="task.id"
          :title="task.title"
          :emoji="task.emoji"
          :description="task.description"
          :color="task.color"
          :disabled="task.disabled"
          @click="handleTaskClick(task)"
        />
      </div>
    </section>

    <!-- Upcoming Jobs -->
    <section class="upcoming-section">
      <div class="upcoming-header">
        <h2 class="section-title">Upcoming Jobs</h2>
        <button class="view-all-link" @click="router.push('/schedule')">
          View All
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="upcoming-list">
        <div
          v-for="job in upcomingJobs"
          :key="job.id"
          class="upcoming-item"
        >
          <span class="upcoming-emoji">{{ job.emoji }}</span>
          <div class="upcoming-info">
            <div class="upcoming-name">{{ job.name }}</div>
            <div class="upcoming-time">{{ job.time }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Map Preview -->
    <MapPreviewCard />

    <!-- Job Creation Wizard -->
    <JobWizard
      v-model="showJobWizard"
      :templates="jobTemplates"
      :zones="mockZones"
      @complete="handleJobCreated"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.consumer-dashboard {
  padding: var(--spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  padding: var(--spacing-2xl) 0;
  margin-bottom: var(--spacing-xl);
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
  line-height: 1.2;

  @include mobile {
    font-size: 2rem;
  }
}

.hero-subtitle {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto;
}

.tasks-section {
  margin: var(--spacing-2xl) 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--spacing-lg);

  @include mobile {
    grid-template-columns: 1fr;
  }
}

.upcoming-section {
  @include card;
  padding: var(--spacing-xl);
  margin: var(--spacing-2xl) 0;
}

.upcoming-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.view-all-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  color: var(--primary-green);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: var(--bg-secondary);
    transform: translateX(2px);
  }
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.upcoming-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.upcoming-emoji {
  font-size: 32px;
  line-height: 1;
}

.upcoming-info {
  flex: 1;
}

.upcoming-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.upcoming-time {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
