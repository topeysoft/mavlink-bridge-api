<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'

const systemInfo = ref({
  firmwareVersion: '2.1.3',
  hardwareVersion: 'YR-1000',
  serialNumber: 'YR-2024-001',
  uptime: '5 days, 3 hours',
  lastUpdate: 'Dec 1, 2024',
  totalMissions: '142',
  totalRuntime: '87.5 hours',
  totalDistance: '145.3 km'
})

const handleExportLogs = () => {
  console.log('Exporting logs...')
}

const handleCheckUpdates = () => {
  console.log('Checking for updates...')
}

const handleFactoryReset = () => {
  if (confirm('Are you sure you want to reset to factory defaults? This cannot be undone.')) {
    console.log('Factory reset...')
  }
}
</script>

<template>
  <Card title="System Information">
    <div class="system-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Firmware Version</span>
          <span class="info-value">{{ systemInfo.firmwareVersion }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Hardware Version</span>
          <span class="info-value">{{ systemInfo.hardwareVersion }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Serial Number</span>
          <span class="info-value">{{ systemInfo.serialNumber }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">System Uptime</span>
          <span class="info-value">{{ systemInfo.uptime }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Update</span>
          <span class="info-value">{{ systemInfo.lastUpdate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Total Missions</span>
          <span class="info-value">{{ systemInfo.totalMissions }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Total Runtime</span>
          <span class="info-value">{{ systemInfo.totalRuntime }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Total Distance</span>
          <span class="info-value">{{ systemInfo.totalDistance }}</span>
        </div>
      </div>

      <div class="system-actions">
        <Button variant="outline" @click="handleExportLogs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export Logs
        </Button>
        <Button variant="primary" @click="handleCheckUpdates">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Check for Updates
        </Button>
        <Button variant="danger" @click="handleFactoryReset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M3 21v-5h5"></path>
          </svg>
          Factory Reset
        </Button>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.system-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}

.info-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.system-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;

  svg {
    width: 16px;
    height: 16px;
  }
}
</style>
