<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Card from '@/components/common/Card.vue'
import FormSelect from '@/components/common/FormSelect.vue'
import Button from '@/components/common/Button.vue'
import { useImuStore } from '@/stores/imu'

const imuStore = useImuStore()

const eStopMode = ref('immediate')
const tiltProtection = ref(true)
const rainSensor = ref(true)
const collisionDetection = ref(true)

const eStopOptions = [
  { value: 'immediate', label: 'Immediate Stop' },
  { value: 'controlled', label: 'Controlled Stop' },
  { value: 'return-home', label: 'Return Home' }
]

// Current tilt angle from IMU
const currentTilt = computed(() => Math.round(imuStore.tiltAngle))

// Subscription
let imuUnsub: (() => void) | undefined

const handleSave = () => {
  console.log('Saving safety settings...')
}

onMounted(() => {
  imuUnsub = imuStore.setupSubscription()
})

onUnmounted(() => {
  if (imuUnsub) imuUnsub()
})
</script>

<template>
  <Card title="Safety Settings">
    <div class="settings-form">
      <FormSelect
        v-model="eStopMode"
        label="Emergency Stop Mode"
        :options="eStopOptions"
      />

      <div class="toggles-list">
        <label class="toggle-label">
          <input v-model="tiltProtection" type="checkbox" class="toggle-input" />
          <span class="toggle-switch"></span>
          <div class="toggle-info">
            <span class="toggle-text">Tilt Protection</span>
            <span class="toggle-description">
              Stops vehicle if tilt exceeds safe angle
              <span v-if="currentTilt > 0" class="current-value">(Current: {{ currentTilt }}°)</span>
            </span>
          </div>
        </label>

        <label class="toggle-label">
          <input v-model="rainSensor" type="checkbox" class="toggle-input" />
          <span class="toggle-switch"></span>
          <div class="toggle-info">
            <span class="toggle-text">Rain Sensor</span>
            <span class="toggle-description">Pauses missions when rain detected</span>
          </div>
        </label>

        <label class="toggle-label">
          <input v-model="collisionDetection" type="checkbox" class="toggle-input" />
          <span class="toggle-switch"></span>
          <div class="toggle-info">
            <span class="toggle-text">Collision Detection</span>
            <span class="toggle-description">Stops on obstacle contact</span>
          </div>
        </label>
      </div>

      <Button variant="primary" @click="handleSave">Save Settings</Button>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.toggles-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: background 0.3s;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
  }
}

.toggle-input:checked + .toggle-switch {
  background: var(--primary-green);

  &::after {
    transform: translateX(24px);
  }
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.toggle-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-description {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);

  .current-value {
    color: var(--primary-green);
    font-weight: 500;
    margin-left: var(--spacing-xs);
  }
}
</style>
