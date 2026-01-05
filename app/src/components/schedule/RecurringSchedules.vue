<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

interface RecurringSchedule {
  id: number
  name: string
  frequency: string
  time: string
  enabled: boolean
}

const schedules = ref<RecurringSchedule[]>([
  { id: 1, name: 'Daily Lawn Care', frequency: 'Daily', time: '8:00 AM', enabled: true },
  { id: 2, name: 'Weekly Garden Maintenance', frequency: 'Weekly (Sunday)', time: '10:00 AM', enabled: true },
  { id: 3, name: 'Bi-weekly Perimeter Check', frequency: 'Every 2 weeks', time: '6:00 PM', enabled: false }
])

const toggleSchedule = (id: number) => {
  const schedule = schedules.value.find(s => s.id === id)
  if (schedule) {
    schedule.enabled = !schedule.enabled
  }
}
</script>

<template>
  <Card title="Recurring Schedules">
    <div class="schedules-list">
      <div v-for="schedule in schedules" :key="schedule.id" class="schedule-item">
        <div class="schedule-info">
          <div class="schedule-name">{{ schedule.name }}</div>
          <div class="schedule-details">
            <span class="schedule-frequency">{{ schedule.frequency }}</span>
            <span class="schedule-separator">•</span>
            <span class="schedule-time">{{ schedule.time }}</span>
          </div>
        </div>
        <Button
          :variant="schedule.enabled ? 'success' : 'outline'"
          size="sm"
          @click="toggleSchedule(schedule.id)"
        >
          {{ schedule.enabled ? 'Enabled' : 'Disabled' }}
        </Button>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.schedules-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.schedule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.schedule-info {
  flex: 1;
}

.schedule-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.schedule-details {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.schedule-separator {
  color: var(--border-color);
}
</style>
