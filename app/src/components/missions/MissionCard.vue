<script setup lang="ts">
import Card from '@/components/common/Card.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/common/Button.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'

interface Mission {
  id: string
  name: string
  type: string
  status: 'active' | 'scheduled' | 'completed' | 'pending'
  progress?: number
  schedule?: string
  estimatedTime?: string
  zones: string[]
  trigger?: string
}

interface Props {
  mission: Mission
}

defineProps<Props>()

const emit = defineEmits<{
  edit: [id: string]
  start: [id: string]
  pause: [id: string]
  cancel: [id: string]
  delete: [id: string]
}>()

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'info'
    case 'completed':
      return 'success'
    case 'scheduled':
      return 'warning'
    default:
      return 'pending'
  }
}
</script>

<template>
  <Card>
    <div class="mission-content">
      <div class="mission-header">
        <div class="mission-info">
          <h3 class="mission-name">{{ mission.name }}</h3>
          <span class="mission-type">{{ mission.type }}</span>
        </div>
        <StatusBadge :status="getStatusVariant(mission.status)" :label="mission.status" />
      </div>

      <ProgressBar
        v-if="mission.status === 'active' && mission.progress !== undefined"
        :value="mission.progress"
        :label="`Progress`"
      />

      <div class="mission-details">
        <div v-if="mission.schedule" class="detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{{ mission.schedule }}</span>
        </div>
        <div v-if="mission.estimatedTime" class="detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>{{ mission.estimatedTime }}</span>
        </div>
        <div class="detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>{{ mission.zones.join(', ') }}</span>
        </div>
        <div v-if="mission.trigger" class="detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
          <span>{{ mission.trigger }}</span>
        </div>
      </div>

      <div class="mission-actions">
        <Button
          v-if="mission.status === 'active'"
          variant="outline"
          size="sm"
          @click="emit('pause', mission.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          Pause
        </Button>
        <Button
          v-if="mission.status === 'scheduled'"
          variant="primary"
          size="sm"
          @click="emit('start', mission.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Start Now
        </Button>
        <Button variant="outline" size="sm" @click="emit('edit', mission.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </Button>
        <Button
          v-if="mission.status === 'active'"
          variant="danger"
          size="sm"
          @click="emit('cancel', mission.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cancel
        </Button>
        <Button
          v-else
          variant="danger"
          size="sm"
          @click="emit('delete', mission.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </Button>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.mission-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.mission-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.mission-info {
  flex: 1;
}

.mission-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.mission-type {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.mission-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.detail {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

.mission-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  svg {
    width: 14px;
    height: 14px;
  }
}
</style>
