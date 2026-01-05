<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

interface ScheduledMission {
  id: number
  name: string
  date: string
  time: string
  type: string
  zone: string
}

const missions = ref<ScheduledMission[]>([
  { id: 1, name: 'Morning Lawn Mowing', date: 'Today', time: '8:00 AM', type: 'Lawn', zone: 'Front Lawn' },
  { id: 2, name: 'Garden Patrol', date: 'Tomorrow', time: '2:00 PM', type: 'Patrol', zone: 'Back Garden' },
  { id: 3, name: 'Weekly Maintenance', date: 'Dec 15', time: '10:00 AM', type: 'Maintenance', zone: 'All Zones' }
])
</script>

<template>
  <Card title="Upcoming Missions">
    <div class="missions-list">
      <div v-for="mission in missions" :key="mission.id" class="mission-item">
        <div class="mission-time">
          <div class="mission-date">{{ mission.date }}</div>
          <div class="mission-hour">{{ mission.time }}</div>
        </div>
        <div class="mission-details">
          <div class="mission-name">{{ mission.name }}</div>
          <div class="mission-meta">
            <StatusBadge status="info" :label="mission.type" />
            <span class="mission-zone">{{ mission.zone }}</span>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.missions-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.mission-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.mission-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius);
  text-align: center;
}

.mission-date {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.mission-hour {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.mission-details {
  flex: 1;
}

.mission-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.mission-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mission-zone {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
</style>
