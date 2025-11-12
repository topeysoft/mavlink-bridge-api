<template>
  <q-card class="widget activity-widget full-height">
    <q-card-section class="widget-header">
      <div class="text-h6">Recent Activity</div>
      <q-space />
      <q-chip
        v-if="unacknowledgedCount > 0"
        color="warning"
        text-color="white"
        size="sm"
        :label="`${unacknowledgedCount} new`"
      />
      <q-btn
        flat
        round
        dense
        icon="more_vert"
        size="sm"
      >
        <q-menu>
          <q-list>
            <q-item clickable @click="acknowledgeAll">
              <q-item-section avatar>
                <q-icon name="done_all" />
              </q-item-section>
              <q-item-section>Acknowledge All</q-item-section>
            </q-item>
            <q-item clickable @click="clearEvents">
              <q-item-section avatar>
                <q-icon name="clear_all" />
              </q-item-section>
              <q-item-section>Clear History</q-item-section>
            </q-item>
            <q-item clickable @click="exportEvents">
              <q-item-section avatar>
                <q-icon name="download" />
              </q-item-section>
              <q-item-section>Export</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        v-if="editMode"
        flat
        round
        dense
        icon="close"
        size="sm"
        @click="$emit('remove', widgetId)"
      />
    </q-card-section>
    
    <q-separator />
    
    <q-card-section class="widget-content">
      <div class="activity-list">
        <div
          v-for="event in activityStore.recentEvents"
          :key="event.id"
          class="activity-item"
          :class="{
            'unacknowledged': !event.acknowledged && event.severity && ['medium', 'high', 'critical'].includes(event.severity)
          }"
        >
          <div class="activity-icon">
            <q-icon
              :name="getEventIcon(event.type)"
              :color="getEventColor(event.severity)"
              size="20px"
            />
          </div>
          
          <div class="activity-content">
            <div class="activity-message">{{ event.message }}</div>
            <div class="activity-time">{{ formatTime(event.timestamp) }}</div>
          </div>
          
          <div class="activity-actions">
            <q-btn
              v-if="!event.acknowledged && event.severity && ['medium', 'high', 'critical'].includes(event.severity)"
              flat
              round
              dense
              icon="done"
              size="sm"
              @click="acknowledgeEvent(event.id)"
            />
            <q-chip
              dense
              size="xs"
              :color="getSeverityColor(event.severity)"
              text-color="white"
              :label="event.type"
              class="event-type-chip"
            />
          </div>
        </div>
        
        <div v-if="activityStore.recentEvents.length === 0" class="no-events">
          <q-icon name="event_note" size="48px" color="grey-5" />
          <div class="text-body2 text-grey-6 q-mt-sm">No recent activity</div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { date, exportFile, useQuasar } from 'quasar';
import { useActivityStore } from '@/stores/activity';
import type { ActivityEvent } from '@/stores/activity';

const props = defineProps<{
  widgetId: string;
}>();

defineEmits<{
  remove: [widgetId: string];
}>();

const $q = useQuasar();
const editMode = inject('dashboardEditMode', false);
const activityStore = useActivityStore();

const unacknowledgedCount = computed(() => activityStore.unacknowledgedEvents.length);

// Helper functions
function getEventIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'connection': 'wifi',
    'task_progress': 'task',
    'error': 'error',
    'warning': 'warning',
    'info': 'info',
    'command': 'send',
    'system': 'settings'
  };
  return iconMap[type] || 'event_note';
}

function getEventColor(severity?: string): string {
  switch (severity) {
    case 'critical': return 'negative';
    case 'high': return 'negative';
    case 'medium': return 'warning';
    case 'low': return 'positive';
    default: return 'grey';
  }
}

function getSeverityColor(severity?: string): string {
  switch (severity) {
    case 'critical': return 'deep-purple';
    case 'high': return 'negative';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'grey';
  }
}

function formatTime(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  
  if (diffMs < 60000) {
    return 'Just now';
  } else if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes}m ago`;
  } else if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return `${hours}h ago`;
  } else {
    return date.formatDate(timestamp, 'MMM D, HH:mm');
  }
}

function acknowledgeEvent(eventId: string) {
  activityStore.acknowledgeEvent(eventId);
}

function acknowledgeAll() {
  activityStore.acknowledgeAllEvents();
  $q.notify({
    type: 'positive',
    message: 'All events acknowledged',
    position: 'top'
  });
}

function clearEvents() {
  $q.dialog({
    title: 'Clear Activity History',
    message: 'Are you sure you want to clear all activity events?',
    cancel: true,
    persistent: true
  }).onOk(() => {
    activityStore.clearEvents();
    $q.notify({
      type: 'positive',
      message: 'Activity history cleared',
      position: 'top'
    });
  });
}

function exportEvents() {
  const csvData = activityStore.exportEvents('csv');
  const fileName = `yardrover-activity-${date.formatDate(new Date(), 'YYYY-MM-DD-HHmm')}.csv`;
  
  exportFile(fileName, csvData, 'text/csv');
  
  $q.notify({
    type: 'positive',
    message: 'Activity log exported',
    position: 'top'
  });
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.activity-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 12px 16px;
  background-color: rgba($primary, 0.05);
  display: flex;
  align-items: center;
}

.widget-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.activity-list {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: $radius-sm;
  border-left: 3px solid transparent;
  margin-bottom: 8px;
  background-color: rgba($surface, 0.5);
  
  &.unacknowledged {
    border-left-color: $warning;
    background-color: rgba($warning, 0.05);
  }
  
  &:hover {
    background-color: rgba($primary, 0.05);
  }
}

.activity-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-message {
  font-size: 0.875rem;
  color: $text-primary;
  line-height: 1.4;
  margin-bottom: 4px;
}

.activity-time {
  font-size: 0.75rem;
  color: $text-secondary;
}

.activity-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.event-type-chip {
  font-size: 0.7rem;
}

.no-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
}
</style>