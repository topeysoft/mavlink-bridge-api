<template>
  <div class="machine-controls">
    <!-- Quick Actions -->
    <div class="machine-controls__section">
      <h6 class="machine-controls__section-title">Quick Actions</h6>

      <q-card class="machine-controls__quick-actions">
        <q-card-section>
          <div class="machine-controls__action-grid">
            <q-btn
              color="positive"
              icon="play_arrow"
              label="Start"
              size="lg"
              :disable="machine.status === 'working'"
              class="machine-controls__action-btn"
              @click="sendCommand('start')"
            />

            <q-btn
              color="warning"
              icon="pause"
              label="Pause"
              size="lg"
              :disable="machine.status !== 'working'"
              class="machine-controls__action-btn"
              @click="sendCommand('pause')"
            />

            <q-btn
              color="info"
              icon="home"
              label="Return Home"
              size="lg"
              class="machine-controls__action-btn"
              @click="sendCommand('return_home')"
            />

            <q-btn
              color="negative"
              icon="stop"
              label="Emergency Stop"
              size="lg"
              class="machine-controls__action-btn"
              @click="confirmEmergencyStop"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Movement Controls -->
    <div class="machine-controls__section">
      <h6 class="machine-controls__section-title">Manual Movement</h6>

      <div class="row q-gutter-md">
        <div class="col-12 col-md-6">
          <q-card class="machine-controls__movement-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Directional Control</h6>

              <div class="machine-controls__directional">
                <!-- Forward -->
                <q-btn
                  round
                  color="primary"
                  icon="keyboard_arrow_up"
                  size="lg"
                  :disable="!isManualEnabled"
                  class="machine-controls__direction-btn machine-controls__direction-btn--up"
                  @mousedown="startMovement('forward')"
                  @mouseup="stopMovement"
                  @mouseleave="stopMovement"
                />

                <!-- Left -->
                <q-btn
                  round
                  color="primary"
                  icon="keyboard_arrow_left"
                  size="lg"
                  :disable="!isManualEnabled"
                  class="machine-controls__direction-btn machine-controls__direction-btn--left"
                  @mousedown="startMovement('left')"
                  @mouseup="stopMovement"
                  @mouseleave="stopMovement"
                />

                <!-- Center/Stop -->
                <q-btn
                  round
                  color="negative"
                  icon="stop"
                  size="lg"
                  :disable="!isManualEnabled"
                  class="machine-controls__direction-btn machine-controls__direction-btn--center"
                  @click="stopMovement"
                />

                <!-- Right -->
                <q-btn
                  round
                  color="primary"
                  icon="keyboard_arrow_right"
                  size="lg"
                  :disable="!isManualEnabled"
                  class="machine-controls__direction-btn machine-controls__direction-btn--right"
                  @mousedown="startMovement('right')"
                  @mouseup="stopMovement"
                  @mouseleave="stopMovement"
                />

                <!-- Backward -->
                <q-btn
                  round
                  color="primary"
                  icon="keyboard_arrow_down"
                  size="lg"
                  :disable="!isManualEnabled"
                  class="machine-controls__direction-btn machine-controls__direction-btn--down"
                  @mousedown="startMovement('backward')"
                  @mouseup="stopMovement"
                  @mouseleave="stopMovement"
                />
              </div>

              <div class="machine-controls__manual-toggle q-mt-md">
                <q-toggle
                  v-model="manualMode"
                  label="Manual Control Mode"
                  color="primary"
                  @update:model-value="toggleManualMode"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card class="machine-controls__speed-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Speed Control</h6>

              <div class="machine-controls__speed-controls">
                <div class="machine-controls__speed-item">
                  <q-icon name="speed" color="primary" size="24px" />
                  <div class="q-ml-sm">
                    <div class="text-caption text-grey-6">Movement Speed</div>
                    <q-slider
                      v-model="speeds.movement"
                      :min="10"
                      :max="100"
                      :step="5"
                      label
                      color="primary"
                      @change="updateSpeed('movement', speeds.movement)"
                    />
                    <div class="text-caption">{{ speeds.movement }}%</div>
                  </div>
                </div>

                <div class="machine-controls__speed-item">
                  <q-icon name="content_cut" color="secondary" size="24px" />
                  <div class="q-ml-sm">
                    <div class="text-caption text-grey-6">Cutting Speed</div>
                    <q-slider
                      v-model="speeds.cutting"
                      :min="20"
                      :max="100"
                      :step="5"
                      label
                      color="secondary"
                      @change="updateSpeed('cutting', speeds.cutting)"
                    />
                    <div class="text-caption">{{ speeds.cutting }}%</div>
                  </div>
                </div>

                <div class="machine-controls__speed-presets">
                  <q-btn
                    dense
                    outline
                    color="positive"
                    label="Eco"
                    class="q-mr-sm"
                    @click="setSpeedPreset('eco')"
                  />
                  <q-btn
                    dense
                    outline
                    color="primary"
                    label="Normal"
                    class="q-mr-sm"
                    @click="setSpeedPreset('normal')"
                  />
                  <q-btn
                    dense
                    outline
                    color="warning"
                    label="Turbo"
                    @click="setSpeedPreset('turbo')"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Cutting Controls -->
    <div class="machine-controls__section">
      <h6 class="machine-controls__section-title">Cutting System</h6>

      <div class="row q-gutter-md">
        <div class="col-12 col-md-6">
          <q-card class="machine-controls__cutting-card">
            <q-card-section>
              <div class="machine-controls__cutting-controls">
                <div class="machine-controls__cutting-toggle">
                  <q-btn
                    :color="cuttingEnabled ? 'negative' : 'positive'"
                    :icon="cuttingEnabled ? 'stop' : 'play_arrow'"
                    :label="cuttingEnabled ? 'Stop Cutting' : 'Start Cutting'"
                    :loading="loading.cutting"
                    class="q-mb-md"
                    @click="toggleCutting"
                  />
                </div>

                <div class="machine-controls__cutting-height">
                  <div class="text-subtitle2 q-mb-sm">Cutting Height</div>
                  <q-slider
                    v-model="cuttingHeight"
                    :min="20"
                    :max="80"
                    :step="5"
                    label
                    color="secondary"
                    label-always
                    @change="updateCuttingHeight"
                  />
                  <div class="text-caption text-center">{{ cuttingHeight }}mm</div>
                </div>

                <div class="machine-controls__cutting-patterns q-mt-md">
                  <div class="text-subtitle2 q-mb-sm">Cutting Pattern</div>
                  <q-btn-group spread>
                    <q-btn
                      :outline="cuttingPattern !== 'random'"
                      color="primary"
                      label="Random"
                      @click="setCuttingPattern('random')"
                    />
                    <q-btn
                      :outline="cuttingPattern !== 'spiral'"
                      color="primary"
                      label="Spiral"
                      @click="setCuttingPattern('spiral')"
                    />
                    <q-btn
                      :outline="cuttingPattern !== 'edges'"
                      color="primary"
                      label="Edges"
                      @click="setCuttingPattern('edges')"
                    />
                  </q-btn-group>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card class="machine-controls__zones-card">
            <q-card-section>
              <h6 class="q-mt-none q-mb-md">Zone Control</h6>

              <div class="machine-controls__zones">
                <div v-for="zone in zones" :key="zone.id" class="machine-controls__zone">
                  <div class="machine-controls__zone-info">
                    <div class="text-subtitle2">{{ zone.name }}</div>
                    <div class="text-caption text-grey-6">{{ zone.area }} m²</div>
                  </div>

                  <div class="machine-controls__zone-actions">
                    <q-btn
                      dense
                      round
                      :color="zone.enabled ? 'positive' : 'grey'"
                      :icon="zone.enabled ? 'check_circle' : 'radio_button_unchecked'"
                      @click="toggleZone(zone.id)"
                    />
                    <q-btn
                      dense
                      round
                      color="primary"
                      icon="navigation"
                      class="q-ml-sm"
                      @click="navigateToZone(zone.id)"
                    />
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- System Settings -->
    <div class="machine-controls__section">
      <h6 class="machine-controls__section-title">System Settings</h6>

      <q-card class="machine-controls__settings-card">
        <q-card-section>
          <div class="row q-gutter-md">
            <div class="col-12 col-md-4">
              <div class="machine-controls__setting">
                <q-toggle
                  v-model="settings.rainSensor"
                  label="Rain Sensor"
                  color="info"
                  @update:model-value="updateSetting('rainSensor', settings.rainSensor)"
                />
                <div class="text-caption text-grey-6">Automatically stop when rain is detected</div>
              </div>
            </div>

            <div class="col-12 col-md-4">
              <div class="machine-controls__setting">
                <q-toggle
                  v-model="settings.edgeCutting"
                  label="Edge Cutting"
                  color="secondary"
                  @update:model-value="updateSetting('edgeCutting', settings.edgeCutting)"
                />
                <div class="text-caption text-grey-6">Enable precision edge trimming</div>
              </div>
            </div>

            <div class="col-12 col-md-4">
              <div class="machine-controls__setting">
                <q-toggle
                  v-model="settings.nightMode"
                  label="Night Mode"
                  color="warning"
                  @update:model-value="updateSetting('nightMode', settings.nightMode)"
                />
                <div class="text-caption text-grey-6">Quiet operation for night time</div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

// Types
interface Machine {
  id: string
  name: string
  status: string
}

interface Command {
  type: string
  params?: Record<string, any>
}

interface Zone {
  id: string
  name: string
  area: number
  enabled: boolean
}

// Props
const props = defineProps<{
  machine: Machine
}>()

// Emits
const emit = defineEmits<{
  command: [command: Command]
  update: []
}>()

// Composables
const $q = useQuasar()

// Local state
const manualMode = ref(false)
const cuttingEnabled = ref(false)
const cuttingHeight = ref(40)
const cuttingPattern = ref('random')
const movementTimer = ref<number | null>(null)

const speeds = ref({
  movement: 50,
  cutting: 70
})

const settings = ref({
  rainSensor: true,
  edgeCutting: false,
  nightMode: false
})

const loading = ref({
  cutting: false
})

const zones = ref<Zone[]>([
  { id: '1', name: 'Front Yard', area: 150, enabled: true },
  { id: '2', name: 'Back Yard', area: 200, enabled: true },
  { id: '3', name: 'Side Garden', area: 80, enabled: false },
  { id: '4', name: 'Flower Beds', area: 30, enabled: false }
])

// Computed
const isManualEnabled = computed(() => {
  return manualMode.value && (props.machine.status === 'idle' || props.machine.status === 'working')
})

// Methods
const sendCommand = (type: string, params?: Record<string, any>) => {
  emit('command', { type, params })
}

const confirmEmergencyStop = async () => {
  const confirmed = await $q
    .dialog({
      title: 'Emergency Stop',
      message: 'This will immediately stop all machine operations. Continue?',
      cancel: true,
      persistent: true,
      color: 'negative'
    })
    .onOk(() => true)
    .onCancel(() => false)

  if (confirmed) {
    sendCommand('emergency_stop')
  }
}

const toggleManualMode = (enabled: boolean) => {
  if (enabled && props.machine.status !== 'idle') {
    $q.notify({
      type: 'warning',
      message: 'Machine must be idle to enable manual mode'
    })
    manualMode.value = false
    return
  }

  sendCommand('set_manual_mode', { enabled })

  if (!enabled) {
    stopMovement()
  }
}

const startMovement = (direction: string) => {
  if (!isManualEnabled.value) return

  sendCommand('manual_move', {
    direction,
    speed: speeds.value.movement
  })

  // Auto-stop after 5 seconds for safety
  if (movementTimer.value) {
    clearTimeout(movementTimer.value)
  }

  movementTimer.value = globalThis.setTimeout(() => {
    stopMovement()
  }, 5000)
}

const stopMovement = () => {
  if (movementTimer.value) {
    clearTimeout(movementTimer.value)
    movementTimer.value = null
  }

  if (isManualEnabled.value) {
    sendCommand('manual_stop')
  }
}

const updateSpeed = (type: string, value: number) => {
  sendCommand('set_speed', { type, value })

  $q.notify({
    type: 'info',
    message: `${type} speed set to ${value}%`
  })
}

const setSpeedPreset = (preset: string) => {
  const presets = {
    eco: { movement: 30, cutting: 40 },
    normal: { movement: 60, cutting: 70 },
    turbo: { movement: 90, cutting: 100 }
  }

  const presetSpeeds = presets[preset as keyof typeof presets]
  if (presetSpeeds) {
    speeds.value = { ...presetSpeeds }
    sendCommand('set_speed_preset', { preset })

    $q.notify({
      type: 'positive',
      message: `Speed preset "${preset}" applied`
    })
  }
}

const toggleCutting = async () => {
  loading.value.cutting = true

  try {
    const newState = !cuttingEnabled.value
    sendCommand('set_cutting', { enabled: newState })
    cuttingEnabled.value = newState

    $q.notify({
      type: newState ? 'positive' : 'info',
      message: `Cutting system ${newState ? 'started' : 'stopped'}`
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to toggle cutting system'
    })
  } finally {
    loading.value.cutting = false
  }
}

const updateCuttingHeight = (height: number) => {
  sendCommand('set_cutting_height', { height })

  $q.notify({
    type: 'info',
    message: `Cutting height set to ${height}mm`
  })
}

const setCuttingPattern = (pattern: string) => {
  cuttingPattern.value = pattern
  sendCommand('set_cutting_pattern', { pattern })

  $q.notify({
    type: 'info',
    message: `Cutting pattern set to ${pattern}`
  })
}

const toggleZone = (zoneId: string) => {
  const zone = zones.value.find(z => z.id === zoneId)
  if (zone) {
    zone.enabled = !zone.enabled
    sendCommand('toggle_zone', { zoneId, enabled: zone.enabled })

    $q.notify({
      type: zone.enabled ? 'positive' : 'info',
      message: `Zone "${zone.name}" ${zone.enabled ? 'enabled' : 'disabled'}`
    })
  }
}

const navigateToZone = (zoneId: string) => {
  const zone = zones.value.find(z => z.id === zoneId)
  if (zone) {
    sendCommand('navigate_to_zone', { zoneId })

    $q.notify({
      type: 'info',
      message: `Navigating to ${zone.name}`
    })
  }
}

const updateSetting = (key: string, value: boolean) => {
  sendCommand('update_setting', { key, value })

  $q.notify({
    type: 'info',
    message: `${key} ${value ? 'enabled' : 'disabled'}`
  })
}
</script>

<style lang="scss" scoped>
.machine-controls {
  padding: 24px;
  background-color: var(--q-grey-1);

  .body--dark & {
    background-color: var(--q-dark-page);
  }
}

.machine-controls__section {
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
}

.machine-controls__section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.machine-controls__action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.machine-controls__action-btn {
  height: 80px;
  font-size: 1rem;
  font-weight: 600;
}

.machine-controls__directional {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  width: 200px;
  height: 200px;
  margin: 0 auto;
}

.machine-controls__direction-btn {
  width: 60px;
  height: 60px;

  &--up {
    grid-column: 2;
    grid-row: 1;
  }

  &--left {
    grid-column: 1;
    grid-row: 2;
  }

  &--center {
    grid-column: 2;
    grid-row: 2;
  }

  &--right {
    grid-column: 3;
    grid-row: 2;
  }

  &--down {
    grid-column: 2;
    grid-row: 3;
  }
}

.machine-controls__manual-toggle {
  text-align: center;
}

.machine-controls__speed-controls {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.machine-controls__speed-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.machine-controls__speed-presets {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.machine-controls__cutting-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.machine-controls__cutting-toggle {
  text-align: center;
}

.machine-controls__zones {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.machine-controls__zone {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);

  .body--dark & {
    background-color: rgba(255, 255, 255, 0.02);
  }
}

.machine-controls__zone-info {
  flex: 1;
}

.machine-controls__zone-actions {
  display: flex;
  align-items: center;
}

.machine-controls__setting {
  margin-bottom: 16px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .machine-controls__action-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .machine-controls__directional {
    width: 180px;
    height: 180px;
  }

  .machine-controls__direction-btn {
    width: 50px;
    height: 50px;
  }
}

@media (max-width: 599px) {
  .machine-controls {
    padding: 16px;
  }

  .machine-controls__section {
    margin-bottom: 24px;
  }

  .machine-controls__action-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .machine-controls__action-btn {
    height: 60px;
    font-size: 0.9rem;
  }

  .machine-controls__directional {
    width: 150px;
    height: 150px;
  }

  .machine-controls__direction-btn {
    width: 40px;
    height: 40px;
  }
}
</style>
