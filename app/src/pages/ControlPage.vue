<template>
  <q-page class="control-page nature-gradient">
    <q-toolbar class="bg-transparent">
      <q-toolbar-title class="text-h5 text-primary">
        Machine Control Center
      </q-toolbar-title>
      <ConnectionStatus />
    </q-toolbar>

    <div class="control-layout q-pa-md">
      <!-- Main Control Panel -->
      <section class="control-section">
        <q-card class="nature-card full-height">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-md">
              <q-icon name="control_camera" class="q-mr-sm" />
              Control Panel
            </div>
            
            <!-- Mode Selector -->
            <div class="q-mb-md">
              <q-btn-toggle
                v-model="controlMode"
                spread
                no-caps
                toggle-color="primary"
                :options="[
                  {label: 'Manual', value: 'manual', icon: 'pan_tool'},
                  {label: 'Assisted', value: 'assisted', icon: 'assistant'},
                  {label: 'Auto', value: 'auto', icon: 'smart_toy'}
                ]"
              />
            </div>

            <!-- Joystick Control -->
            <div class="joystick-container">
              <div class="joystick-wrapper">
                <div class="joystick-pad" @touchmove="handleJoystick">
                  <div class="joystick-stick" :style="joystickStyle">
                    <q-icon name="control_camera" size="24px" />
                  </div>
                </div>
              </div>
              <div class="speed-control q-ml-md">
                <q-slider
                  v-model="speed"
                  :min="0"
                  :max="100"
                  vertical
                  reverse
                  label
                  label-always
                  color="primary"
                  style="height: 200px"
                />
                <div class="text-caption q-mt-sm">Speed</div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="row q-gutter-sm q-mt-md">
              <q-btn
                color="positive"
                icon="play_arrow"
                label="Start"
                @click="handleStart"
              />
              <q-btn
                color="warning"
                icon="pause"
                label="Pause"
                @click="handlePause"
              />
              <q-btn
                color="negative"
                icon="stop"
                label="Stop"
                @click="handleStop"
              />
              <q-btn
                color="primary"
                icon="home"
                label="Return Home"
                @click="handleReturnHome"
              />
            </div>
          </q-card-section>
        </q-card>
      </section>

      <!-- Status Section -->
      <section class="status-section">
        <q-card class="nature-card q-mb-md">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">
              <q-icon name="info" class="q-mr-sm" />
              Machine Status
            </div>
            <q-list dense>
              <q-item>
                <q-item-section>
                  <q-item-label>Mode</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip color="primary" text-color="white">
                    {{ flightMode }}
                  </q-chip>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Armed</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip :color="isArmed ? 'positive' : 'grey'" text-color="white">
                    {{ isArmed ? 'Yes' : 'No' }}
                  </q-chip>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Battery</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-linear-progress
                    :value="battery / 100"
                    :color="battery > 30 ? 'positive' : 'warning'"
                    size="25px"
                    class="q-mt-sm"
                  >
                    <div class="absolute-full flex flex-center">
                      <q-badge color="white" text-color="accent" :label="`${battery}%`" />
                    </div>
                  </q-linear-progress>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>GPS Fix</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-chip :color="gpsFixed ? 'positive' : 'warning'" text-color="white">
                    {{ gpsFixed ? `3D (${satelliteCount} sats)` : 'No Fix' }}
                  </q-chip>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- Battery Indicator -->
        <q-card class="nature-card">
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">
              <q-icon name="battery_charging_full" class="q-mr-sm" />
              Power Status
            </div>
            <q-circular-progress
              show-value
              font-size="12px"
              :value="battery"
              size="100px"
              :thickness="0.2"
              :color="battery > 30 ? 'positive' : 'warning'"
              track-color="grey-3"
              class="q-ma-md"
            >
              {{ battery }}%
            </q-circular-progress>
            <div class="text-caption text-grey">
              Voltage: {{ voltage.toFixed(1) }}V<br>
              Current: {{ current.toFixed(1) }}A<br>
              Est. Time: {{ estimatedTime }}
            </div>
          </q-card-section>
        </q-card>
      </section>

      <!-- Map Section -->
      <section class="map-section">
        <q-card class="nature-card full-height">
          <q-card-section class="full-height">
            <div class="text-h6 text-primary q-mb-sm">
              <q-icon name="map" class="q-mr-sm" />
              Live Position
            </div>
            <div class="map-placeholder">
              <div class="text-center text-grey">
                <q-icon name="map" size="64px" />
                <p>Map view will display here</p>
                <p class="text-caption">
                  Lat: {{ latitude.toFixed(6) }}<br>
                  Lon: {{ longitude.toFixed(6) }}
                </p>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </section>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useConnectionStore } from '@/stores/connection';
import { useTelemetryStore } from '@/stores/telemetry';
import ConnectionStatus from '@/components/common/ConnectionStatus.vue';

const connectionStore = useConnectionStore();
const telemetryStore = useTelemetryStore();

// Control state
const controlMode = ref('manual');
const speed = ref(50);
const joystickX = ref(0);
const joystickY = ref(0);

// Machine state (from telemetry)
const flightMode = computed(() => telemetryStore.telemetry.flight_mode || 'MANUAL');
const isArmed = computed(() => telemetryStore.telemetry.armed || false);
const battery = computed(() => telemetryStore.telemetry.battery?.percentage || 0);
const voltage = computed(() => telemetryStore.telemetry.battery?.voltage || 0);
const current = computed(() => telemetryStore.telemetry.battery?.current || 0);
const gpsFixed = computed(() => telemetryStore.telemetry.gps?.fix_type === 3);
const satelliteCount = computed(() => telemetryStore.telemetry.gps?.satellites_visible || 0);
const latitude = computed(() => telemetryStore.telemetry.gps?.lat || 0);
const longitude = computed(() => telemetryStore.telemetry.gps?.lon || 0);

// Computed
const estimatedTime = computed(() => {
  const minutes = Math.floor((battery.value / 100) * 60);
  return `${minutes} min`;
});

const joystickStyle = computed(() => ({
  transform: `translate(${joystickX.value}px, ${joystickY.value}px)`,
}));

// Methods
function handleJoystick(event: TouchEvent) {
  const touch = event.touches[0];
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const maxDistance = Math.min(centerX, centerY) - 20;

  let x = touch.clientX - rect.left - centerX;
  let y = touch.clientY - rect.top - centerY;

  const distance = Math.sqrt(x * x + y * y);
  if (distance > maxDistance) {
    x = (x / distance) * maxDistance;
    y = (y / distance) * maxDistance;
  }

  joystickX.value = x;
  joystickY.value = y;
}

function handleStart() {
  console.log('Start command');
}

function handlePause() {
  console.log('Pause command');
}

function handleStop() {
  console.log('Stop command');
}

function handleReturnHome() {
  console.log('Return home command');
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.control-page {
  min-height: 100vh;
}

.control-layout {
  display: grid;
  grid-template-columns: 1fr 350px;
  grid-template-rows: auto 1fr;
  gap: $spacing-md;
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: $breakpoint-md) {
    grid-template-columns: 1fr;
  }
}

.control-section {
  grid-column: 1;
  grid-row: 1 / 3;
}

.status-section {
  grid-column: 2;
  grid-row: 1;
  
  @media (max-width: $breakpoint-md) {
    grid-column: 1;
    grid-row: 2;
  }
}

.map-section {
  grid-column: 2;
  grid-row: 2;
  min-height: 300px;
  
  @media (max-width: $breakpoint-md) {
    grid-column: 1;
    grid-row: 3;
  }
}

.joystick-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: $spacing-lg 0;
}

.joystick-wrapper {
  position: relative;
}

.joystick-pad {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f0f0f0, #e0e0e0);
  box-shadow: 
    inset 5px 5px 10px #d0d0d0,
    inset -5px -5px 10px #ffffff;
  position: relative;
  touch-action: none;
}

.joystick-stick {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: $primary;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: $shadow-md;
}

.speed-control {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.map-placeholder {
  height: 250px;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
}

.full-height {
  height: 100%;
}
</style>