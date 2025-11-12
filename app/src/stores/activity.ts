import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { date } from 'quasar';

export interface ActivityEvent {
  id: string;
  type: 'connection' | 'task_progress' | 'error' | 'warning' | 'info' | 'command' | 'system';
  message: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
  acknowledged?: boolean;
}

export const useActivityStore = defineStore('activity', () => {
  // State
  const events = ref<ActivityEvent[]>([
    {
      id: '1',
      type: 'connection',
      message: 'Connected to YardRover device',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      severity: 'low'
    },
    {
      id: '2',
      type: 'system',
      message: 'GPS lock acquired with 12 satellites',
      timestamp: new Date(Date.now() - 240000), // 4 minutes ago
      severity: 'low'
    },
    {
      id: '3',
      type: 'command',
      message: 'Flight mode changed to AUTO',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      severity: 'low'
    },
    {
      id: '4',
      type: 'task_progress',
      message: 'Mowing task started: Front Yard Pattern',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      severity: 'low'
    },
    {
      id: '5',
      type: 'warning',
      message: 'Battery level below 30%',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
      severity: 'medium',
      acknowledged: false
    }
  ]);
  
  const isLogging = ref(false);
  const maxEvents = ref(100);
  
  // Getters
  const recentEvents = computed(() => 
    events.value
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20)
  );
  
  const unacknowledgedEvents = computed(() => 
    events.value.filter(e => !e.acknowledged && e.severity && ['medium', 'high', 'critical'].includes(e.severity))
  );
  
  const eventsByType = computed(() => {
    const grouped: Record<string, ActivityEvent[]> = {};
    events.value.forEach(event => {
      if (!grouped[event.type]) {
        grouped[event.type] = [];
      }
      grouped[event.type].push(event);
    });
    return grouped;
  });
  
  const criticalEvents = computed(() => 
    events.value.filter(e => e.severity === 'critical')
  );
  
  // Actions
  function startLogging() {
    isLogging.value = true;
    
    // Listen for system events using correct client API
    try {
      const client = apiClient.getClient();
      if (client) {
        // Error events
        client.onError((error) => {
          addEvent({
            type: 'error',
            message: error.message || 'Unknown error occurred',
            severity: 'high',
            data: error
          });
        });
        
        // Status events
        client.onStatus((status) => {
          // Log status updates without causing circular refs
          if (status && typeof status === 'object') {
            addEvent({
              type: 'system',
              message: 'System status updated',
              severity: 'low'
            });
          }
        });
      }
    } catch (error) {
      console.warn('Could not set up activity logging:', error);
    }
  }
  
  function stopLogging() {
    isLogging.value = false;
    // Note: WebSocket client handles unsubscription automatically
  }
  
  function addEvent(eventData: Omit<ActivityEvent, 'id' | 'timestamp'>) {
    const event: ActivityEvent = {
      id: generateEventId(),
      timestamp: new Date(),
      acknowledged: false,
      ...eventData
    };
    
    events.value.unshift(event);
    
    // Limit number of stored events
    if (events.value.length > maxEvents.value) {
      events.value = events.value.slice(0, maxEvents.value);
    }
  }
  
  function acknowledgeEvent(eventId: string) {
    const event = events.value.find(e => e.id === eventId);
    if (event) {
      event.acknowledged = true;
    }
  }
  
  function acknowledgeAllEvents() {
    events.value.forEach(event => {
      event.acknowledged = true;
    });
  }
  
  function clearEvents() {
    events.value = [];
  }
  
  function clearEventsByType(type: string) {
    events.value = events.value.filter(e => e.type !== type);
  }
  
  function getEventsByDateRange(startDate: Date, endDate: Date) {
    return events.value.filter(e => 
      e.timestamp >= startDate && e.timestamp <= endDate
    );
  }
  
  function exportEvents(format: 'json' | 'csv' = 'json') {
    if (format === 'json') {
      return JSON.stringify(events.value, null, 2);
    } else {
      // CSV export
      const headers = ['ID', 'Type', 'Message', 'Timestamp', 'Severity', 'Acknowledged'];
      const rows = events.value.map(event => [
        event.id,
        event.type,
        event.message.replace(/"/g, '""'), // Escape quotes
        date.formatDate(event.timestamp, 'YYYY-MM-DD HH:mm:ss'),
        event.severity || '',
        event.acknowledged ? 'Yes' : 'No'
      ]);
      
      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
    }
  }
  
  function generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Add some helper methods for common event types
  function logConnection(message: string, connected: boolean) {
    addEvent({
      type: 'connection',
      message,
      severity: connected ? 'low' : 'medium'
    });
  }
  
  function logError(message: string, error?: any) {
    addEvent({
      type: 'error',
      message,
      severity: 'high',
      data: error
    });
  }
  
  function logWarning(message: string, data?: any) {
    addEvent({
      type: 'warning',
      message,
      severity: 'medium',
      data
    });
  }
  
  function logInfo(message: string, data?: any) {
    addEvent({
      type: 'info',
      message,
      severity: 'low',
      data
    });
  }
  
  function logCommand(message: string, data?: any) {
    addEvent({
      type: 'command',
      message,
      severity: 'low',
      data
    });
  }
  
  return {
    // State
    events,
    isLogging,
    maxEvents,
    
    // Getters
    recentEvents,
    unacknowledgedEvents,
    eventsByType,
    criticalEvents,
    
    // Actions
    startLogging,
    stopLogging,
    addEvent,
    acknowledgeEvent,
    acknowledgeAllEvents,
    clearEvents,
    clearEventsByType,
    getEventsByDateRange,
    exportEvents,
    
    // Helper methods
    logConnection,
    logError,
    logWarning,
    logInfo,
    logCommand
  };
});