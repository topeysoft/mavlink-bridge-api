<script setup lang="ts">
import { useRouter } from 'vue-router'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import CalendarCard from '@/components/schedule/CalendarCard.vue'
import ScheduledMissionsList from '@/components/schedule/ScheduledMissionsList.vue'
import RecurringSchedules from '@/components/schedule/RecurringSchedules.vue'
import Button from '@/components/common/Button.vue'

const router = useRouter()

const breadcrumbItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Schedule' }
]

const handleScheduleMission = () => {
  router.push({ name: 'mission-new' })
}

const handleNewRecurring = () => {
  router.push({ name: 'mission-new', query: { recurring: 'true' } })
}
</script>

<template>
  <div class="schedule-view">
    <Breadcrumb :items="breadcrumbItems" />

    <div class="schedule-actions">
      <Button variant="outline" @click="handleNewRecurring">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        New Recurring
      </Button>
      <Button variant="primary" @click="handleScheduleMission">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Schedule Mission
      </Button>
    </div>

    <div class="schedule-grid">
      <div class="calendar-section">
        <CalendarCard />
      </div>

      <div class="missions-section">
        <ScheduledMissionsList />
        <RecurringSchedules />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.schedule-view {
  padding: var(--spacing-xl);
}

.schedule-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);

  svg {
    width: 16px;
    height: 16px;
  }
}

.schedule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.missions-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
</style>
