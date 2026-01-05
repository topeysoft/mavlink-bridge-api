<script setup lang="ts">
import { ref, computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(null)

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonth = computed(() => monthNames[currentDate.value.getMonth()])
const currentYear = computed(() => currentDate.value.getFullYear())

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()

  const days: (number | null)[] = []

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  // Add days of the month
  for (let i = 1; i <= lastDate; i++) {
    days.push(i)
  }

  return days
})

const previousMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date()
}

const isToday = (day: number | null) => {
  if (!day) return false
  const today = new Date()
  return day === today.getDate() &&
    currentDate.value.getMonth() === today.getMonth() &&
    currentDate.value.getFullYear() === today.getFullYear()
}

const hasMission = (day: number | null) => {
  // Sample logic - in real app, check against actual missions
  return day && (day === 5 || day === 12 || day === 19 || day === 26)
}
</script>

<template>
  <Card>
    <template #header>
      <div class="calendar-header">
        <h3 class="calendar-title">{{ currentMonth }} {{ currentYear }}</h3>
        <div class="calendar-controls">
          <Button variant="outline" size="sm" @click="previousMonth">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Button>
          <Button variant="outline" size="sm" @click="goToToday">Today</Button>
          <Button variant="outline" size="sm" @click="nextMonth">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Button>
        </div>
      </div>
    </template>

    <div class="calendar-grid">
      <div v-for="day in dayNames" :key="day" class="calendar-day-name">
        {{ day }}
      </div>
      <div
        v-for="(day, index) in daysInMonth"
        :key="index"
        class="calendar-day"
        :class="{
          'is-today': isToday(day),
          'has-mission': hasMission(day),
          'is-empty': !day
        }"
      >
        <span v-if="day" class="day-number">{{ day }}</span>
        <span v-if="hasMission(day)" class="mission-dot"></span>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--spacing-lg);

  .calendar-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }
}

.calendar-controls {
  display: flex;
  gap: var(--spacing-xs);

  svg {
    width: 14px;
    height: 14px;
  }
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--border-color);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.calendar-day-name {
  background: var(--bg-secondary);
  padding: var(--spacing-sm);
  text-align: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.calendar-day {
  background: var(--bg-primary);
  aspect-ratio: 1;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(.is-empty) {
    background: var(--bg-secondary);
  }

  &.is-empty {
    background: var(--bg-secondary);
    opacity: 0.3;
    cursor: default;
  }

  &.is-today {
    background: var(--primary-green-light);

    .day-number {
      font-weight: 700;
      color: var(--primary-green);
    }
  }
}

.day-number {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.mission-dot {
  position: absolute;
  bottom: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-green);
}
</style>
