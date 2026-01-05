<script setup lang="ts">
import { computed } from 'vue'
import { useGpsStore } from '@/stores/gps'
import Card from '@/components/common/Card.vue'

const gpsStore = useGpsStore()

const gpsInfo = computed(() => gpsStore.gpsInfo)
const fixTypeString = computed(() => gpsStore.fixTypeString)
const signalQuality = computed(() => gpsStore.signalQuality)

const statusColor = computed(() => {
  if (!gpsInfo.value.hasLock) return 'var(--status-error)'
  if (gpsInfo.value.fixType >= 5) return 'var(--status-success)' // RTK
  if (gpsInfo.value.fixType >= 3) return 'var(--status-info)' // 3D fix
  return 'var(--status-warning)'
})

const qualityColor = computed(() => {
  switch (signalQuality.value) {
    case 'excellent': return 'var(--status-success)'
    case 'good': return 'var(--status-info)'
    case 'fair': return 'var(--status-warning)'
    case 'poor': return 'var(--status-error)'
    default: return 'var(--text-secondary)'
  }
})

function formatCoordinate(value: number | null, isLatitude: boolean): string {
  if (value === null) return 'N/A'
  const direction = isLatitude
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W')
  return `${Math.abs(value).toFixed(6)}° ${direction}`
}
</script>

<template>
  <Card>
    <template #header>
      <div class="header">
        <div>
          <div class="card-title">GPS Status</div>
          <div class="card-subtitle">Position and signal quality</div>
        </div>
        <div class="status-badge" :style="{ backgroundColor: statusColor }">
          {{ fixTypeString }}
        </div>
      </div>
    </template>

    <div class="gps-content">
      <!-- GPS Info Grid -->
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Satellites</div>
          <div class="info-value">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M1 12h6m6 0h6"></path>
            </svg>
            {{ gpsInfo.satellites }}
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">HDOP</div>
          <div class="info-value">
            {{ gpsInfo.hdop.toFixed(2) }}
            <span class="quality-badge" :style="{ color: qualityColor }">
              {{ signalQuality }}
            </span>
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">Altitude</div>
          <div class="info-value">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            {{ gpsInfo.altitude.toFixed(1) }}m
          </div>
        </div>

        <div class="info-item">
          <div class="info-label">Speed</div>
          <div class="info-value">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            </svg>
            {{ gpsInfo.speed.toFixed(1) }} m/s
          </div>
        </div>
      </div>

      <!-- Position Display -->
      <div class="position-display">
        <div class="position-header">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Position</span>
        </div>
        <div class="coordinates">
          <div class="coordinate">
            <span class="coord-label">Lat:</span>
            <span class="coord-value">{{ formatCoordinate(gpsInfo.latitude, true) }}</span>
          </div>
          <div class="coordinate">
            <span class="coord-label">Lon:</span>
            <span class="coord-value">{{ formatCoordinate(gpsInfo.longitude, false) }}</span>
          </div>
        </div>
      </div>

      <!-- Signal Strength Indicator -->
      <div class="signal-strength">
        <div class="signal-label">Signal Strength</div>
        <div class="signal-bars">
          <div
            v-for="i in 5"
            :key="i"
            class="bar"
            :class="{
              active: i <= Math.ceil(gpsInfo.satellites / 3),
              excellent: signalQuality === 'excellent',
              good: signalQuality === 'good',
              fair: signalQuality === 'fair'
            }"
          ></div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: var(--spacing-lg);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.status-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gps-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.info-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);

  .icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }
}

.quality-badge {
  font-size: var(--font-size-xs);
  font-weight: 500;
  text-transform: capitalize;
}

.position-display {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.position-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);

  .icon {
    width: 14px;
    height: 14px;
  }
}

.coordinates {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.coordinate {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-family: 'Monaco', 'Courier New', monospace;
}

.coord-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  min-width: 32px;
}

.coord-value {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}

.signal-strength {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.signal-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.signal-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 40px;
}

.bar {
  flex: 1;
  background: var(--bg-tertiary);
  border-radius: 2px;
  transition: background 0.3s;

  &:nth-child(1) { height: 20%; }
  &:nth-child(2) { height: 40%; }
  &:nth-child(3) { height: 60%; }
  &:nth-child(4) { height: 80%; }
  &:nth-child(5) { height: 100%; }

  &.active {
    &.excellent {
      background: var(--status-success);
    }
    &.good {
      background: var(--status-info);
    }
    &.fair {
      background: var(--status-warning);
    }
    &:not(.excellent):not(.good):not(.fair) {
      background: var(--status-error);
    }
  }
}
</style>
