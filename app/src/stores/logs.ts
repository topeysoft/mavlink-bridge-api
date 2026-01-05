import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  SessionLog,
  LogEntry,
  LogFilter,
  LogExportFormat,
  LogTimelineEvent,
  LogStatistics,
  LogMetadata,
} from '@/types/log';

const STORAGE_KEY = 'yardrover_logs';

// Mock data generator
function generateMockLogEntries(startTime: number, duration: number, count: number): LogEntry[] {
  const entries: LogEntry[] = [];
  const interval = duration / count;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const timestamp = startTime + (i * interval);

    entries.push({
      id: `entry_${timestamp}_${i}`,
      timestamp,
      mode: t < 0.1 ? 'STABILIZE' : t < 0.9 ? 'AUTO' : 'LAND',
      latitude: 37.7749 + (Math.sin(t * Math.PI * 2) * 0.01),
      longitude: -122.4194 + (Math.cos(t * Math.PI * 2) * 0.01),
      altitude: Math.sin(t * Math.PI) * 50 + 10,
      groundSpeed: 5 + Math.random() * 3,
      airSpeed: 5.5 + Math.random() * 3,
      heading: (t * 360) % 360,
      batteryVoltage: 12.6 - (t * 1.2),
      batteryPercent: 100 - (t * 80),
      current: 15 + Math.random() * 10,
      throttle: 50 + Math.sin(t * Math.PI) * 30,
      pitch: Math.sin(t * Math.PI * 4) * 10,
      roll: Math.cos(t * Math.PI * 4) * 10,
      yaw: (t * 360) % 360,
      satellites: 12 + Math.floor(Math.random() * 3),
      gpsFixType: 3,
      hdop: 0.8 + Math.random() * 0.3,
    });
  }

  return entries;
}

function calculateStatistics(entries: LogEntry[]): LogStatistics {
  if (entries.length === 0) {
    return {
      sessionTime: 0,
      distanceTraveled: 0,
      maxAltitude: 0,
      avgAltitude: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      maxBatteryVoltage: 0,
      minBatteryVoltage: 0,
      avgBatteryVoltage: 0,
      totalEnergyUsed: 0,
      maxCurrent: 0,
      avgCurrent: 0,
      satelliteCount: { min: 0, max: 0, avg: 0 },
    };
  }

  const altitudes = entries.map(e => e.altitude);
  const speeds = entries.map(e => e.groundSpeed);
  const voltages = entries.map(e => e.batteryVoltage);
  const currents = entries.map(e => e.current);
  const satellites = entries.map(e => e.satellites);

  // Calculate distance traveled
  let distance = 0;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const dt = (curr.timestamp - prev.timestamp) / 1000; // seconds
    distance += curr.groundSpeed * dt;
  }

  // Calculate energy used (Ah)
  let energyUsed = 0;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const dt = (curr.timestamp - prev.timestamp) / 1000 / 3600; // hours
    energyUsed += ((prev.current + curr.current) / 2) * dt;
  }

  return {
    sessionTime: (entries[entries.length - 1].timestamp - entries[0].timestamp) / 1000,
    distanceTraveled: distance,
    maxAltitude: Math.max(...altitudes),
    avgAltitude: altitudes.reduce((a, b) => a + b, 0) / altitudes.length,
    maxSpeed: Math.max(...speeds),
    avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    maxBatteryVoltage: Math.max(...voltages),
    minBatteryVoltage: Math.min(...voltages),
    avgBatteryVoltage: voltages.reduce((a, b) => a + b, 0) / voltages.length,
    totalEnergyUsed: energyUsed,
    maxCurrent: Math.max(...currents),
    avgCurrent: currents.reduce((a, b) => a + b, 0) / currents.length,
    satelliteCount: {
      min: Math.min(...satellites),
      max: Math.max(...satellites),
      avg: satellites.reduce((a, b) => a + b, 0) / satellites.length,
    },
  };
}

function generateMockLogs(): SessionLog[] {
  const logs: SessionLog[] = [];
  const now = Date.now();

  for (let i = 0; i < 5; i++) {
    const startTime = now - (i * 86400000) - (i * 3600000); // Days and hours ago
    const duration = 600000 + Math.random() * 1200000; // 10-30 minutes
    const endTime = startTime + duration;
    const entries = generateMockLogEntries(startTime, duration, 200);
    const statistics = calculateStatistics(entries);

    const metadata: LogMetadata = {
      firmwareVersion: '1.2.3',
      vehicleType: 'YardRover',
      modes: ['STABILIZE', 'AUTO', 'LAND'],
      totalDistance: statistics.distanceTraveled,
      maxAltitude: statistics.maxAltitude,
      maxSpeed: statistics.maxSpeed,
      startLocation: { lat: entries[0].latitude, lon: entries[0].longitude },
      endLocation: { lat: entries[entries.length - 1].latitude, lon: entries[entries.length - 1].longitude },
    };

    logs.push({
      id: `log_${startTime}`,
      name: `Session ${new Date(startTime).toLocaleDateString()} ${new Date(startTime).toLocaleTimeString()}`,
      vehicleId: 'yardrover_01',
      startTime,
      endTime,
      duration,
      entries,
      metadata,
      statistics,
    });
  }

  return logs;
}

export const useLogsStore = defineStore('logs', () => {
  const logs = ref<SessionLog[]>([]);
  const selectedLogId = ref<string | null>(null);
  const filter = ref<LogFilter>({});
  const loading = ref(false);

  // Computed
  const selectedLog = computed(() =>
    logs.value.find(log => log.id === selectedLogId.value) || null
  );

  const filteredLogs = computed(() => {
    let filtered = [...logs.value];

    if (filter.value.startDate) {
      filtered = filtered.filter(log => log.startTime >= filter.value.startDate!);
    }

    if (filter.value.endDate) {
      filtered = filtered.filter(log => log.endTime <= filter.value.endDate!);
    }

    if (filter.value.vehicleId) {
      filtered = filtered.filter(log => log.vehicleId === filter.value.vehicleId);
    }

    if (filter.value.minDuration) {
      filtered = filtered.filter(log => log.duration >= filter.value.minDuration! * 1000);
    }

    if (filter.value.maxDuration) {
      filtered = filtered.filter(log => log.duration <= filter.value.maxDuration! * 1000);
    }

    if (filter.value.searchTerm) {
      const term = filter.value.searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.name.toLowerCase().includes(term) ||
        log.vehicleId.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => b.startTime - a.startTime);
  });

  const totalFlightTime = computed(() =>
    logs.value.reduce((sum, log) => sum + log.duration, 0)
  );

  const totalDistance = computed(() =>
    logs.value.reduce((sum, log) => sum + log.statistics.distanceTraveled, 0)
  );

  // Actions
  function loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        logs.value = JSON.parse(stored);
      } else {
        // Load mock data if no stored data
        logs.value = generateMockLogs();
        saveLogs();
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      logs.value = generateMockLogs();
    }
  }

  function saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.value));
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  async function downloadLog(logId: string): Promise<void> {
    loading.value = true;
    try {
      // TODO: Implement actual MAVLink log download
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Mock: just return existing log
    } finally {
      loading.value = false;
    }
  }

  function selectLog(logId: string | null) {
    selectedLogId.value = logId;
  }

  function deleteLog(logId: string) {
    logs.value = logs.value.filter(log => log.id !== logId);
    if (selectedLogId.value === logId) {
      selectedLogId.value = null;
    }
    saveLogs();
  }

  function setFilter(newFilter: Partial<LogFilter>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  function clearFilter() {
    filter.value = {};
  }

  function exportLog(logId: string, format: LogExportFormat): string {
    const log = logs.value.find(l => l.id === logId);
    if (!log) throw new Error('Log not found');

    switch (format.type) {
      case 'csv':
        return exportToCSV(log, format);
      case 'kml':
        return exportToKML(log, format);
      case 'geojson':
        return exportToGeoJSON(log, format);
      case 'json':
        return JSON.stringify(log, null, 2);
      default:
        throw new Error('Unsupported export format');
    }
  }

  function exportToCSV(log: SessionLog, format: LogExportFormat): string {
    const fields = format.fields || [
      'timestamp', 'latitude', 'longitude', 'altitude', 'groundSpeed',
      'heading', 'batteryVoltage', 'batteryPercent', 'mode'
    ];

    const header = fields.join(',');
    const rows = log.entries.map(entry =>
      fields.map(field => {
        const value = entry[field as keyof LogEntry];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  function exportToKML(log: SessionLog, format: LogExportFormat): string {
    const coordinates = log.entries
      .map(e => `${e.longitude},${e.latitude},${e.altitude}`)
      .join('\n          ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${log.name}</name>
    <description>Session log from ${new Date(log.startTime).toISOString()}</description>
    <Placemark>
      <name>Session Path</name>
      <LineString>
        <coordinates>
          ${coordinates}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
  }

  function exportToGeoJSON(log: SessionLog, format: LogExportFormat): string {
    const coordinates = log.entries.map(e => [e.longitude, e.latitude, e.altitude]);

    const geojson = {
      type: 'Feature',
      properties: {
        name: log.name,
        startTime: log.startTime,
        endTime: log.endTime,
        duration: log.duration,
        ...(format.includeMetadata ? log.metadata : {}),
        ...(format.includeStatistics ? log.statistics : {}),
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };

    return JSON.stringify(geojson, null, 2);
  }

  function getTimelineEvents(logId: string): LogTimelineEvent[] {
    const log = logs.value.find(l => l.id === logId);
    if (!log) return [];

    const events: LogTimelineEvent[] = [];
    let lastMode = '';

    log.entries.forEach((entry, index) => {
      if (entry.mode !== lastMode) {
        events.push({
          timestamp: entry.timestamp,
          type: 'mode_change',
          description: `Mode changed to ${entry.mode}`,
          severity: 'info',
        });
        lastMode = entry.mode;
      }

      if (index === 0) {
        events.push({
          timestamp: entry.timestamp,
          type: 'start',
          description: 'Session started',
          severity: 'info',
        });
      }

      if (index === log.entries.length - 1) {
        events.push({
          timestamp: entry.timestamp,
          type: 'stop',
          description: 'Session ended',
          severity: 'info',
        });
      }

      if (entry.batteryPercent < 20 && index > 0 && log.entries[index - 1].batteryPercent >= 20) {
        events.push({
          timestamp: entry.timestamp,
          type: 'warning',
          description: 'Low battery warning',
          severity: 'warning',
        });
      }
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  return {
    // State
    logs,
    selectedLogId,
    filter,
    loading,

    // Computed
    selectedLog,
    filteredLogs,
    totalFlightTime,
    totalDistance,

    // Actions
    loadLogs,
    downloadLog,
    selectLog,
    deleteLog,
    setFilter,
    clearFilter,
    exportLog,
    getTimelineEvents,
  };
});
