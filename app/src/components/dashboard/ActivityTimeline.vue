<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'

interface Activity {
  id: number
  type: 'success' | 'warning' | 'info'
  title: string
  time: string
  icon: string
}

const activities = ref<Activity[]>([
  { id: 1, type: 'success', title: 'Mission "Front Lawn" completed successfully', time: '2 minutes ago', icon: 'check-circle' },
  { id: 2, type: 'warning', title: 'Battery level below 20%', time: '15 minutes ago', icon: 'battery' },
  { id: 3, type: 'info', title: 'System update available', time: '1 hour ago', icon: 'download' },
  { id: 4, type: 'success', title: 'GPS lock acquired (12 satellites)', time: '2 hours ago', icon: 'satellite' }
])

// Auto-refresh activity feed
const { formattedLastUpdated, autoRefreshEnabled } = useAutoRefresh({
  interval: 10000, // Check for new activities every 10 seconds
  onRefresh: async () => {
    // In real app, this would fetch new activities from API
    console.log('Checking for new activities...')
  }
})

const exportActivities = () => {
  const dataStr = JSON.stringify(activities.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `yardrover-activity-log-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Card
    title="Recent Activity"
    :last-updated="formattedLastUpdated"
    :auto-refresh="autoRefreshEnabled"
  >
    <template #actions>
      <button class="export-btn" @click="exportActivities" title="Export activity log">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </template>
    <div class="activity-timeline">
      <div v-for="activity in activities" :key="activity.id" class="activity-item" :class="`activity-${activity.type}`">
        <div class="activity-icon">
          <svg v-if="activity.icon === 'check-circle'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <svg v-else-if="activity.icon === 'battery'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
            <line x1="23" y1="13" x2="23" y2="11"></line>
          </svg>
          <svg v-else-if="activity.icon === 'download'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <svg v-else-if="activity.icon === 'satellite'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="2"></circle>
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-title">{{ activity.title }}</div>
          <div class="activity-time">{{ activity.time }}</div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.activity-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.activity-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-secondary);
  }
}

.activity-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  svg {
    width: 18px;
    height: 18px;
  }
}

.activity-success .activity-icon {
  background: rgba(72, 187, 120, 0.1);
  color: var(--status-success);
}

.activity-warning .activity-icon {
  background: rgba(237, 137, 54, 0.1);
  color: var(--status-warning);
}

.activity-info .activity-icon {
  background: rgba(66, 153, 225, 0.1);
  color: var(--status-info);
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.activity-time {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.export-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xs);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--border-radius);
  transition: all 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
}
</style>
