<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import Card from '@/components/common/Card.vue'
import { useGpsStore } from '@/stores/gps'
import { useBatteryStore } from '@/stores/battery'
import { useImuStore } from '@/stores/imu'

const gpsStore = useGpsStore()
const batteryStore = useBatteryStore()
const imuStore = useImuStore()

// Subscriptions
let imuUnsub: (() => void) | undefined

const telemetry = computed(() => ({
  speed: gpsStore.gpsInfo.speed,
  battery: Math.round(batteryStore.batteryInfo.percent),
  satellites: gpsStore.gpsInfo.satellites,
  hdop: gpsStore.gpsInfo.hdop,
  vibration: Math.round(imuStore.vibrationLevel * 100),
  tilt: Math.round(imuStore.tiltAngle)
}))

onMounted(() => {
  imuUnsub = imuStore.setupSubscription()
})

onUnmounted(() => {
  if (imuUnsub) imuUnsub()
})
</script>

<template>
  <Card>
    <template #header>
      <div class="telemetry-header">
        <div>
          <div class="card-title">Live Telemetry</div>
          <div class="live-indicator">
            <span class="live-dot"></span>
            <span class="live-text">LIVE</span>
          </div>
        </div>
      </div>
    </template>

    <div class="telemetry-grid">
      <div class="telemetry-item">
        <div class="telemetry-label">Speed</div>
        <div class="telemetry-value">{{ telemetry.speed.toFixed(1) }} <span class="unit">m/s</span></div>
        <div class="mini-chart">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline
              points="0,20 10,18 20,15 30,22 40,19 50,16 60,14 70,17 80,13 90,12 100,10"
              fill="none"
              stroke="var(--primary-green)"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <div class="telemetry-item">
        <div class="telemetry-label">Battery</div>
        <div class="telemetry-value">{{ telemetry.battery }}<span class="unit">%</span></div>
        <div class="mini-chart">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline
              points="0,15 10,15 20,15 30,15 40,15 50,16 60,16 70,17 80,18 90,19 100,20"
              fill="none"
              stroke="var(--status-success)"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <div class="telemetry-item">
        <div class="telemetry-label">GPS Satellites</div>
        <div class="telemetry-value">{{ telemetry.satellites }}</div>
        <div class="signal-bars">
          <div v-for="i in 5" :key="i" class="bar" :class="{ active: i <= Math.ceil(telemetry.satellites / 3) }"></div>
        </div>
      </div>

      <div class="telemetry-item">
        <div class="telemetry-label">HDOP</div>
        <div class="telemetry-value">{{ telemetry.hdop.toFixed(1) }}</div>
        <div class="quality-indicator" :class="telemetry.hdop < 2 ? 'excellent' : 'good'">
          {{ telemetry.hdop < 2 ? 'Excellent' : 'Good' }}
        </div>
      </div>

      <div class="telemetry-item">
        <div class="telemetry-label">Vibration</div>
        <div class="telemetry-value">{{ telemetry.vibration }}<span class="unit">%</span></div>
        <div class="vibration-bar">
          <div class="vibration-fill" :style="{ width: telemetry.vibration + '%' }" :class="{
            'low': telemetry.vibration < 30,
            'medium': telemetry.vibration >= 30 && telemetry.vibration < 70,
            'high': telemetry.vibration >= 70
          }"></div>
        </div>
      </div>

      <div class="telemetry-item">
        <div class="telemetry-label">Tilt Angle</div>
        <div class="telemetry-value">{{ telemetry.tilt }}<span class="unit">°</span></div>
        <div class="quality-indicator" :class="telemetry.tilt < 15 ? 'excellent' : telemetry.tilt < 30 ? 'good' : 'warning'">
          {{ telemetry.tilt < 15 ? 'Level' : telemetry.tilt < 30 ? 'Tilted' : 'Warning' }}
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.telemetry-header {
  width: 100%;
  padding: var(--spacing-lg);

  .card-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-error);
  animation: pulse 2s infinite;
}

.live-text {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--status-error);
  letter-spacing: 0.5px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.telemetry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.telemetry-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.telemetry-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.telemetry-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);

  .unit {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-weight: 400;
  }
}

.mini-chart {
  height: 30px;

  svg {
    width: 100%;
    height: 100%;
  }
}

.signal-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 30px;
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
    background: var(--primary-green);
  }
}

.quality-indicator {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.excellent {
    background: rgba(72, 187, 120, 0.1);
    color: var(--status-success);
  }

  &.good {
    background: rgba(66, 153, 225, 0.1);
    color: var(--status-info);
  }

  &.warning {
    background: rgba(237, 137, 54, 0.1);
    color: var(--status-warning);
  }
}

.vibration-bar {
  height: 30px;
  background: var(--bg-tertiary);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.vibration-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;

  &.low {
    background: var(--status-success);
  }

  &.medium {
    background: var(--status-warning);
  }

  &.high {
    background: var(--status-danger);
  }
}
</style>
