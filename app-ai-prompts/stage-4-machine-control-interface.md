# Stage 4: Machine Control Interface

## Objective
Build comprehensive control interfaces for all YardRover machine functions including mowing, snow clearing, leaf blowing, towing, and patrolling. Each interface should be intuitive, safety-focused, and provide real-time feedback.

## Prerequisites
- Completed Stages 1-3
- Dashboard and telemetry system working
- MAVLink command integration ready
- Real-time updates configured

## Features to Implement

### 1. Control Mode Selection
- Manual control mode
- Autonomous mode
- Semi-autonomous mode
- Safety interlocks
- Mode transition validation

### 2. Function-Specific Controls

#### Mowing Controls
- Blade height adjustment (1-4 inches)
- Cutting pattern selection
- Speed control
- Blade engagement
- Mulching vs bagging mode
- Edge mode toggle

#### Snow Clearing Controls
- Blade angle adjustment (-30° to +30°)
- Blade height setting
- Salt/sand dispenser control
- Throw distance adjustment
- Chute direction control
- Snow depth sensors display

#### Leaf Blowing Controls
- Blower power level (0-100%)
- Direction control (360°)
- Vacuum/blow mode toggle
- Collection bag status
- Mulching ratio control
- Pattern automation

#### Towing Controls
- Hitch status indicator
- Load weight display
- Speed limiter
- Backup assist
- Trailer brake control
- Stability monitoring

#### Patrolling Controls
- Route recording
- Waypoint management
- Speed settings
- Camera controls
- Alert zone configuration
- Schedule management

### 3. Universal Controls
- Emergency stop (always visible)
- Speed governor
- Obstacle detection override
- Manual override controls
- Status indicators
- Voice feedback toggle

### 4. Safety Features
- Dead man's switch simulation
- Proximity warnings
- Tilt/tip detection
- Obstacle visualization
- Geofence boundaries
- Weather-based restrictions

## Component Structure

```
src/components/control/
├── ControlModeSwitcher.vue     # Mode selection
├── SafetyIndicators.vue        # Safety status
├── ManualControls.vue          # Joystick/D-pad
├── functions/
│   ├── MowingControls.vue      # Mowing interface
│   ├── SnowControls.vue        # Snow clearing
│   ├── LeafControls.vue        # Leaf blowing
│   ├── TowingControls.vue      # Towing interface
│   └── PatrolControls.vue      # Patrol settings
├── common/
│   ├── SpeedControl.vue        # Speed adjustment
│   ├── DirectionControl.vue    # Direction input
│   ├── HeightAdjuster.vue      # Height controls
│   └── PowerGauge.vue          # Power display
└── overlays/
    ├── ObstacleRadar.vue       # Obstacle display
    └── SafetyWarning.vue       # Warning overlays

src/pages/
└── ControlPage.vue             # Main control page

src/stores/
├── control.ts                  # Control state
└── safety.ts                   # Safety monitoring
```

## Implementation

### Control Page (pages/ControlPage.vue)

```vue
<template>
  <q-page class="control-page">
    <!-- Safety Status Bar -->
    <div class="safety-bar" :class="`safety-${safetyStore.status}`">
      <SafetyIndicators />
    </div>
    
    <!-- Main Control Area -->
    <div class="control-container">
      <!-- Left Panel - Mode & Function -->
      <div class="control-panel left-panel">
        <ControlModeSwitcher 
          v-model="controlMode"
          @change="handleModeChange"
        />
        
        <q-separator class="q-my-md" />
        
        <!-- Function Selector -->
        <div class="function-selector">
          <h6 class="text-subtitle1 q-mb-md">Machine Function</h6>
          <q-btn-toggle
            v-model="activeFunction"
            toggle-color="primary"
            :options="functionOptions"
            spread
            unelevated
            class="function-toggle"
          />
        </div>
        
        <q-separator class="q-my-md" />
        
        <!-- Universal Controls -->
        <div class="universal-controls">
          <SpeedControl 
            v-model="speedSetting"
            :max-speed="maxSpeed"
            :enabled="controlStore.isEngaged"
          />
          
          <q-space class="q-my-md" />
          
          <q-btn
            :color="controlStore.isEngaged ? 'negative' : 'positive'"
            :icon="controlStore.isEngaged ? 'stop' : 'play_arrow'"
            :label="controlStore.isEngaged ? 'Stop' : 'Start'"
            @click="toggleEngagement"
            size="lg"
            unelevated
            class="full-width"
          />
        </div>
      </div>
      
      <!-- Center Panel - Function Controls -->
      <div class="control-panel center-panel">
        <transition name="fade" mode="out-in">
          <component 
            :is="activeFunctionComponent"
            :key="activeFunction"
            v-model:settings="functionSettings[activeFunction]"
            :enabled="controlStore.isEngaged"
            @command="handleCommand"
          />
        </transition>
        
        <!-- Manual Override Section -->
        <q-expansion-item
          v-if="controlMode === 'manual'"
          icon="sports_esports"
          label="Manual Override Controls"
          class="manual-override q-mt-md"
        >
          <ManualControls 
            @move="handleManualMove"
            :enabled="controlStore.isEngaged && safetyStore.manualOverrideEnabled"
          />
        </q-expansion-item>
      </div>
      
      <!-- Right Panel - Status & Monitoring -->
      <div class="control-panel right-panel">
        <!-- Obstacle Radar -->
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-h6 q-mb-sm">Obstacle Detection</div>
            <ObstacleRadar 
              :obstacles="safetyStore.detectedObstacles"
              :range="obstacleDetectionRange"
            />
          </q-card-section>
        </q-card>
        
        <!-- Status Monitors -->
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-h6 q-mb-sm">System Status</div>
            <q-list dense>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="battery_charging_full" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Battery</q-item-label>
                  <q-item-label caption>{{ telemetryStore.battery.level }}%</q-item-label>
                </q-item-section>
              </q-item>
              
              <q-item>
                <q-item-section avatar>
                  <q-icon name="thermostat" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Temperature</q-item-label>
                  <q-item-label caption>{{ systemTemp }}°C</q-item-label>
                </q-item-section>
              </q-item>
              
              <q-item>
                <q-item-section avatar>
                  <q-icon name="terrain" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Incline</q-item-label>
                  <q-item-label caption>{{ inclineAngle }}°</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
        
        <!-- Activity Log -->
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-sm">Activity Log</div>
            <q-scroll-area style="height: 200px">
              <q-list dense>
                <q-item
                  v-for="(log, index) in recentLogs"
                  :key="index"
                >
                  <q-item-section>
                    <q-item-label>{{ log.message }}</q-item-label>
                    <q-item-label caption>{{ formatTime(log.timestamp) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-scroll-area>
          </q-card-section>
        </q-card>
      </div>
    </div>
    
    <!-- Emergency Stop Overlay -->
    <q-dialog v-model="showEmergencyStop" persistent>
      <EmergencyStopDialog @confirm="executeEmergencyStop" />
    </q-dialog>
    
    <!-- Safety Warning Overlays -->
    <SafetyWarning 
      v-if="safetyStore.activeWarnings.length > 0"
      :warnings="safetyStore.activeWarnings"
      @acknowledge="acknowledgeWarning"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { useControlStore } from '@/stores/control';
import { useSafetyStore } from '@/stores/safety';
import { useTelemetryStore } from '@/stores/telemetry';

// Component imports
import ControlModeSwitcher from '@/components/control/ControlModeSwitcher.vue';
import SafetyIndicators from '@/components/control/SafetyIndicators.vue';
import SpeedControl from '@/components/control/common/SpeedControl.vue';
import ManualControls from '@/components/control/ManualControls.vue';
import ObstacleRadar from '@/components/control/overlays/ObstacleRadar.vue';
import SafetyWarning from '@/components/control/overlays/SafetyWarning.vue';
import EmergencyStopDialog from '@/components/control/EmergencyStopDialog.vue';

// Function-specific controls
import MowingControls from '@/components/control/functions/MowingControls.vue';
import SnowControls from '@/components/control/functions/SnowControls.vue';
import LeafControls from '@/components/control/functions/LeafControls.vue';
import TowingControls from '@/components/control/functions/TowingControls.vue';
import PatrolControls from '@/components/control/functions/PatrolControls.vue';

const $q = useQuasar();
const controlStore = useControlStore();
const safetyStore = useSafetyStore();
const telemetryStore = useTelemetryStore();

// Control mode
const controlMode = ref<'manual' | 'autonomous' | 'semi-auto'>('manual');

// Active function
const activeFunction = ref<'mowing' | 'snow' | 'leaf' | 'towing' | 'patrol'>('mowing');

const functionOptions = [
  { label: 'Mow', value: 'mowing', icon: 'grass' },
  { label: 'Snow', value: 'snow', icon: 'ac_unit' },
  { label: 'Leaf', value: 'leaf', icon: 'park' },
  { label: 'Tow', value: 'towing', icon: 'rv_hookup' },
  { label: 'Patrol', value: 'patrol', icon: 'shield' }
];

// Function components map
const functionComponents = {
  mowing: MowingControls,
  snow: SnowControls,
  leaf: LeafControls,
  towing: TowingControls,
  patrol: PatrolControls
};

const activeFunctionComponent = computed(() => 
  functionComponents[activeFunction.value]
);

// Function settings
const functionSettings = ref({
  mowing: {
    bladeHeight: 2.5,
    pattern: 'stripe',
    speed: 2.0,
    bladeEngaged: false,
    mulching: true,
    edgeMode: false
  },
  snow: {
    bladeAngle: 0,
    bladeHeight: 1,
    dispenserEnabled: false,
    dispenserRate: 50,
    chuteAngle: 0,
    throwDistance: 10
  },
  leaf: {
    powerLevel: 75,
    direction: 0,
    mode: 'blow',
    bagFull: false,
    mulchRatio: 50,
    pattern: 'manual'
  },
  towing: {
    hitchLocked: false,
    loadWeight: 0,
    speedLimit: 5,
    backupAssist: true,
    trailerBrake: 50,
    stabilityControl: true
  },
  patrol: {
    routeId: null,
    speed: 3,
    cameraEnabled: true,
    alertsEnabled: true,
    recordingEnabled: false,
    schedule: null
  }
});

// Universal settings
const speedSetting = ref(2.0);
const maxSpeed = computed(() => {
  switch (activeFunction.value) {
    case 'towing': return 5.0;
    case 'snow': return 4.0;
    default: return 10.0;
  }
});

// Status
const showEmergencyStop = ref(false);
const systemTemp = ref(45);
const inclineAngle = ref(0);
const obstacleDetectionRange = ref(5);
const recentLogs = ref<Array<{ message: string; timestamp: Date }>>([]);

// Handle mode change
function handleModeChange(newMode: string) {
  if (controlStore.isEngaged) {
    $q.dialog({
      title: 'Change Control Mode',
      message: 'Machine must be stopped to change control mode. Stop now?',
      cancel: true
    }).onOk(() => {
      controlStore.disengage();
      controlMode.value = newMode as any;
    });
  }
}

// Toggle engagement
async function toggleEngagement() {
  if (controlStore.isEngaged) {
    controlStore.disengage();
    addLog('Machine stopped');
  } else {
    // Safety checks
    if (!safetyStore.canEngage) {
      $q.notify({
        type: 'negative',
        message: 'Cannot start: Safety conditions not met',
        caption: safetyStore.blockingIssues.join(', ')
      });
      return;
    }
    
    // Confirm engagement
    $q.dialog({
      title: 'Start Machine',
      message: `Start ${activeFunction.value} operation in ${controlMode.value} mode?`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      controlStore.engage(activeFunction.value, controlMode.value);
      addLog(`${activeFunction.value} started in ${controlMode.value} mode`);
    });
  }
}

// Handle function commands
async function handleCommand(command: any) {
  try {
    await controlStore.sendCommand(command);
    addLog(`Command sent: ${command.type}`);
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Command failed: ${error.message}`
    });
  }
}

// Handle manual movement
function handleManualMove(direction: string, speed: number) {
  controlStore.sendManualControl(direction, speed);
}

// Emergency stop
function executeEmergencyStop() {
  controlStore.emergencyStop();
  showEmergencyStop.value = false;
  addLog('EMERGENCY STOP ACTIVATED');
  
  $q.notify({
    type: 'negative',
    message: 'Emergency Stop Activated',
    position: 'center',
    timeout: 0,
    actions: [{ label: 'OK', color: 'white' }]
  });
}

// Warning acknowledgment
function acknowledgeWarning(warningId: string) {
  safetyStore.acknowledgeWarning(warningId);
}

// Activity logging
function addLog(message: string) {
  recentLogs.value.unshift({
    message,
    timestamp: new Date()
  });
  
  // Keep only last 50 logs
  if (recentLogs.value.length > 50) {
    recentLogs.value.pop();
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

// Keyboard shortcuts
function handleKeyPress(event: KeyboardEvent) {
  // Emergency stop on spacebar
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    showEmergencyStop.value = true;
  }
  
  // Arrow keys for manual control
  if (controlMode.value === 'manual' && controlStore.isEngaged) {
    switch (event.code) {
      case 'ArrowUp':
        handleManualMove('forward', speedSetting.value);
        break;
      case 'ArrowDown':
        handleManualMove('backward', speedSetting.value);
        break;
      case 'ArrowLeft':
        handleManualMove('left', speedSetting.value);
        break;
      case 'ArrowRight':
        handleManualMove('right', speedSetting.value);
        break;
    }
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyPress);
  safetyStore.startMonitoring();
  
  // Simulate some sensor data
  setInterval(() => {
    systemTemp.value = 40 + Math.random() * 20;
    inclineAngle.value = -5 + Math.random() * 10;
  }, 2000);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress);
  safetyStore.stopMonitoring();
  
  // Ensure machine is stopped
  if (controlStore.isEngaged) {
    controlStore.disengage();
  }
});
</script>

<style lang="scss" scoped>
.control-page {
  height: calc(100vh - 50px);
  overflow: hidden;
  background-color: $background;
}

.safety-bar {
  height: 40px;
  background-color: $positive;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 16px;
  transition: background-color 0.3s;
  
  &.safety-warning {
    background-color: $warning;
  }
  
  &.safety-danger {
    background-color: $negative;
    animation: flash 1s infinite;
  }
}

@keyframes flash {
  0%, 50% { opacity: 1; }
  25%, 75% { opacity: 0.7; }
}

.control-container {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 16px;
  height: calc(100% - 40px);
  padding: 16px;
}

.control-panel {
  background: white;
  border-radius: $radius-lg;
  padding: 20px;
  overflow-y: auto;
  box-shadow: $shadow-sm;
}

.function-toggle {
  :deep(.q-btn) {
    flex-direction: column;
    padding: 12px 8px;
    
    .q-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }
  }
}

.manual-override {
  background-color: rgba($warning, 0.1);
  border: 1px solid $warning;
  border-radius: $radius-md;
}

// Responsive
@media (max-width: 1200px) {
  .control-container {
    grid-template-columns: 250px 1fr 300px;
  }
}

@media (max-width: 996px) {
  .control-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .left-panel {
    grid-row: 1;
  }
  
  .center-panel {
    grid-row: 2;
  }
  
  .right-panel {
    grid-row: 3;
  }
}
</style>
```

### Mowing Controls Component (components/control/functions/MowingControls.vue)

```vue
<template>
  <div class="mowing-controls">
    <h5 class="text-h5 q-mb-lg">Mowing Controls</h5>
    
    <!-- Blade Control -->
    <q-card class="control-card q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Blade Control</div>
        
        <!-- Blade Engagement -->
        <div class="row items-center q-mb-md">
          <div class="col">
            <q-toggle
              v-model="settings.bladeEngaged"
              :disable="!enabled"
              label="Blade Engaged"
              color="positive"
              size="lg"
              @update:model-value="updateBladeStatus"
            />
          </div>
          <q-chip
            :color="settings.bladeEngaged ? 'positive' : 'grey-5'"
            text-color="white"
            icon="grass"
          >
            {{ settings.bladeEngaged ? 'CUTTING' : 'IDLE' }}
          </q-chip>
        </div>
        
        <!-- Blade Height -->
        <div class="control-group">
          <label class="control-label">Cutting Height</label>
          <div class="height-control">
            <q-slider
              v-model="settings.bladeHeight"
              :min="1"
              :max="4"
              :step="0.25"
              :disable="!enabled || settings.bladeEngaged"
              label
              :label-value="`${settings.bladeHeight} inches`"
              color="primary"
              track-size="8px"
              thumb-size="24px"
              class="q-mb-md"
            />
            <div class="height-presets">
              <q-btn
                v-for="height in [1, 2, 2.5, 3, 4]"
                :key="height"
                size="sm"
                :outline="settings.bladeHeight !== height"
                :unelevated="settings.bladeHeight === height"
                :color="settings.bladeHeight === height ? 'primary' : 'grey-7'"
                :label="`${height}\"`"
                @click="settings.bladeHeight = height"
                :disable="!enabled || settings.bladeEngaged"
                class="height-preset"
              />
            </div>
          </div>
        </div>
        
        <!-- Blade Speed -->
        <div class="control-group q-mt-md">
          <label class="control-label">Blade Speed</label>
          <q-btn-toggle
            v-model="bladeSpeed"
            toggle-color="primary"
            :options="bladeSpeedOptions"
            :disable="!enabled"
            spread
            unelevated
          />
        </div>
      </q-card-section>
    </q-card>
    
    <!-- Pattern Control -->
    <q-card class="control-card q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Mowing Pattern</div>
        
        <div class="pattern-grid">
          <div
            v-for="pattern in patterns"
            :key="pattern.id"
            class="pattern-option"
            :class="{ active: settings.pattern === pattern.id }"
            @click="selectPattern(pattern.id)"
          >
            <div class="pattern-icon">
              <img :src="pattern.icon" :alt="pattern.name" />
            </div>
            <div class="pattern-name">{{ pattern.name }}</div>
          </div>
        </div>
        
        <!-- Pattern Options -->
        <div v-if="settings.pattern === 'stripe'" class="pattern-options q-mt-md">
          <q-input
            v-model.number="stripeWidth"
            type="number"
            label="Stripe Width (inches)"
            :min="20"
            :max="60"
            :disable="!enabled"
            dense
            outlined
          />
        </div>
      </q-card-section>
    </q-card>
    
    <!-- Operation Modes -->
    <q-card class="control-card">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Operation Modes</div>
        
        <q-list>
          <q-item tag="label">
            <q-item-section avatar>
              <q-toggle
                v-model="settings.mulching"
                :disable="!enabled"
                color="primary"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>Mulching Mode</q-item-label>
              <q-item-label caption>Cut grass into fine pieces</q-item-label>
            </q-item-section>
          </q-item>
          
          <q-item tag="label">
            <q-item-section avatar>
              <q-toggle
                v-model="settings.edgeMode"
                :disable="!enabled"
                color="primary"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>Edge Mode</q-item-label>
              <q-item-label caption>Precise edge trimming</q-item-label>
            </q-item-section>
          </q-item>
          
          <q-item tag="label">
            <q-item-section avatar>
              <q-toggle
                v-model="ecoMode"
                :disable="!enabled"
                color="positive"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>Eco Mode</q-item-label>
              <q-item-label caption>Optimize for battery life</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    
    <!-- Real-time Stats -->
    <div class="stats-row q-mt-md">
      <q-chip color="primary" text-color="white" icon="straighten">
        Coverage: {{ coverage }}%
      </q-chip>
      <q-chip color="secondary" text-color="white" icon="speed">
        Speed: {{ settings.speed }} m/s
      </q-chip>
      <q-chip color="accent" text-color="white" icon="landscape">
        Area: {{ areaMowed }} m²
      </q-chip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';

const props = defineProps<{
  settings: {
    bladeHeight: number;
    pattern: string;
    speed: number;
    bladeEngaged: boolean;
    mulching: boolean;
    edgeMode: boolean;
  };
  enabled: boolean;
}>();

const emit = defineEmits<{
  'update:settings': [settings: typeof props.settings];
  command: [command: any];
}>();

const $q = useQuasar();

// Local state
const bladeSpeed = ref<'eco' | 'normal' | 'turbo'>('normal');
const stripeWidth = ref(48);
const ecoMode = ref(false);
const coverage = ref(0);
const areaMowed = ref(0);

// Blade speed options
const bladeSpeedOptions = [
  { label: 'Eco', value: 'eco', icon: 'eco' },
  { label: 'Normal', value: 'normal', icon: 'speed' },
  { label: 'Turbo', value: 'turbo', icon: 'flash_on' }
];

// Pattern options
const patterns = [
  { id: 'stripe', name: 'Stripes', icon: '/images/patterns/stripe.svg' },
  { id: 'checkerboard', name: 'Checkerboard', icon: '/images/patterns/checkerboard.svg' },
  { id: 'spiral', name: 'Spiral', icon: '/images/patterns/spiral.svg' },
  { id: 'random', name: 'Random', icon: '/images/patterns/random.svg' },
  { id: 'edge', name: 'Edge First', icon: '/images/patterns/edge.svg' }
];

// Methods
function updateBladeStatus(engaged: boolean) {
  if (engaged) {
    // Safety check
    $q.dialog({
      title: 'Engage Blades',
      message: 'Are you sure you want to engage the cutting blades?',
      cancel: true,
      persistent: true
    }).onOk(() => {
      emit('command', {
        type: 'blade_control',
        action: 'engage',
        speed: bladeSpeed.value
      });
    }).onCancel(() => {
      // Revert the toggle
      props.settings.bladeEngaged = false;
    });
  } else {
    emit('command', {
      type: 'blade_control',
      action: 'disengage'
    });
  }
}

function selectPattern(patternId: string) {
  if (!props.enabled) return;
  
  props.settings.pattern = patternId;
  
  emit('command', {
    type: 'set_pattern',
    pattern: patternId,
    options: {
      stripeWidth: stripeWidth.value
    }
  });
}

// Simulate coverage updates
let coverageInterval: NodeJS.Timeout;

watch(() => props.settings.bladeEngaged, (engaged) => {
  if (engaged) {
    coverageInterval = setInterval(() => {
      coverage.value = Math.min(coverage.value + 0.5, 100);
      areaMowed.value += props.settings.speed * 2; // m² per second
    }, 1000);
  } else {
    clearInterval(coverageInterval);
  }
});

// Watch eco mode
watch(ecoMode, (eco) => {
  if (eco) {
    bladeSpeed.value = 'eco';
    props.settings.speed = Math.min(props.settings.speed, 1.5);
  }
});
</script>

<style lang="scss" scoped>
.mowing-controls {
  max-width: 800px;
  margin: 0 auto;
}

.control-card {
  background: rgba(white, 0.9);
  backdrop-filter: blur(10px);
}

.control-group {
  margin-bottom: 20px;
}

.control-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: $text-secondary;
}

.height-presets {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.height-preset {
  flex: 1;
  min-width: 0;
}

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.pattern-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 2px solid $grey-4;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: $primary;
    transform: translateY(-2px);
  }
  
  &.active {
    border-color: $primary;
    background-color: rgba($primary, 0.1);
  }
}

.pattern-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.pattern-name {
  font-size: 0.875rem;
  text-align: center;
}

.stats-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
```

### Safety Store (stores/safety.ts)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api/client';

export interface SafetyWarning {
  id: string;
  type: 'obstacle' | 'tilt' | 'boundary' | 'weather' | 'mechanical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface Obstacle {
  id: string;
  type: 'static' | 'dynamic' | 'unknown';
  distance: number;
  angle: number;
  size: 'small' | 'medium' | 'large';
  velocity?: { x: number; y: number };
}

export const useSafetyStore = defineStore('safety', () => {
  // State
  const status = ref<'safe' | 'warning' | 'danger'>('safe');
  const detectedObstacles = ref<Obstacle[]>([]);
  const activeWarnings = ref<SafetyWarning[]>([]);
  const manualOverrideEnabled = ref(false);
  const emergencyStopActive = ref(false);
  
  // Sensor states
  const tiltAngle = ref({ roll: 0, pitch: 0 });
  const proximity = ref({ front: 100, rear: 100, left: 100, right: 100 });
  const bumperContact = ref(false);
  const gpsSignalQuality = ref(100);
  const weatherSafe = ref(true);
  
  // Boundaries
  const geofenceBoundary = ref<any>(null);
  const isWithinBoundary = ref(true);
  
  // Monitoring
  let monitoringInterval: NodeJS.Timeout | null = null;
  
  // Getters
  const canEngage = computed(() => {
    return status.value !== 'danger' && 
           !emergencyStopActive.value &&
           blockingIssues.value.length === 0;
  });
  
  const blockingIssues = computed(() => {
    const issues: string[] = [];
    
    if (emergencyStopActive.value) {
      issues.push('Emergency stop active');
    }
    
    if (Math.abs(tiltAngle.value.roll) > 30 || Math.abs(tiltAngle.value.pitch) > 30) {
      issues.push('Excessive tilt detected');
    }
    
    if (bumperContact.value) {
      issues.push('Bumper contact detected');
    }
    
    if (!isWithinBoundary.value) {
      issues.push('Outside geofence boundary');
    }
    
    if (gpsSignalQuality.value < 50) {
      issues.push('Poor GPS signal');
    }
    
    if (!weatherSafe.value) {
      issues.push('Unsafe weather conditions');
    }
    
    const criticalWarnings = activeWarnings.value.filter(w => 
      w.severity === 'critical' && !w.acknowledged
    );
    
    if (criticalWarnings.length > 0) {
      issues.push('Critical warnings not acknowledged');
    }
    
    return issues;
  });
  
  const hasObstaclesNearby = computed(() => {
    return detectedObstacles.value.some(o => o.distance < 2);
  });
  
  // Actions
  function startMonitoring() {
    stopMonitoring();
    
    monitoringInterval = setInterval(() => {
      updateSafetyStatus();
      checkForObstacles();
      checkBoundaries();
    }, 100); // 10Hz update rate
  }
  
  function stopMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }
  
  function updateSafetyStatus() {
    // Update status based on conditions
    if (blockingIssues.value.length > 0 || hasObstaclesNearby.value) {
      status.value = 'danger';
    } else if (activeWarnings.value.filter(w => !w.acknowledged).length > 0) {
      status.value = 'warning';
    } else {
      status.value = 'safe';
    }
  }
  
  function checkForObstacles() {
    // Simulate obstacle detection (replace with actual sensor data)
    const obstacles: Obstacle[] = [];
    
    // Check proximity sensors
    Object.entries(proximity.value).forEach(([direction, distance]) => {
      if (distance < 5) {
        obstacles.push({
          id: `proximity-${direction}`,
          type: 'unknown',
          distance,
          angle: getAngleForDirection(direction),
          size: 'medium'
        });
      }
    });
    
    detectedObstacles.value = obstacles;
    
    // Generate warnings for close obstacles
    obstacles.forEach(obstacle => {
      if (obstacle.distance < 2) {
        addWarning({
          id: `obstacle-${obstacle.id}`,
          type: 'obstacle',
          severity: obstacle.distance < 1 ? 'critical' : 'high',
          message: `Obstacle detected ${obstacle.distance.toFixed(1)}m ahead`,
          timestamp: new Date(),
          acknowledged: false
        });
      }
    });
  }
  
  function checkBoundaries() {
    if (!geofenceBoundary.value) return;
    
    // Check if current position is within boundary
    // This would use actual GPS coordinates
    const withinBoundary = true; // Placeholder
    
    if (!withinBoundary && isWithinBoundary.value) {
      addWarning({
        id: 'boundary-violation',
        type: 'boundary',
        severity: 'critical',
        message: 'Vehicle is outside designated boundary',
        timestamp: new Date(),
        acknowledged: false
      });
    }
    
    isWithinBoundary.value = withinBoundary;
  }
  
  function addWarning(warning: SafetyWarning) {
    // Don't duplicate warnings
    const existing = activeWarnings.value.find(w => w.id === warning.id);
    if (!existing) {
      activeWarnings.value.push(warning);
    }
  }
  
  function acknowledgeWarning(warningId: string) {
    const warning = activeWarnings.value.find(w => w.id === warningId);
    if (warning) {
      warning.acknowledged = true;
    }
  }
  
  function clearWarning(warningId: string) {
    const index = activeWarnings.value.findIndex(w => w.id === warningId);
    if (index >= 0) {
      activeWarnings.value.splice(index, 1);
    }
  }
  
  function activateEmergencyStop() {
    emergencyStopActive.value = true;
    status.value = 'danger';
    
    // Send emergency stop command
    apiClient.getClient()?.mavlink.emergencyStop();
  }
  
  function resetEmergencyStop() {
    emergencyStopActive.value = false;
    updateSafetyStatus();
  }
  
  function enableManualOverride(duration: number = 30000) {
    manualOverrideEnabled.value = true;
    
    // Auto-disable after duration
    setTimeout(() => {
      manualOverrideEnabled.value = false;
    }, duration);
  }
  
  function getAngleForDirection(direction: string): number {
    switch (direction) {
      case 'front': return 0;
      case 'right': return 90;
      case 'rear': return 180;
      case 'left': return 270;
      default: return 0;
    }
  }
  
  return {
    // State
    status,
    detectedObstacles,
    activeWarnings,
    manualOverrideEnabled,
    emergencyStopActive,
    tiltAngle,
    proximity,
    bumperContact,
    gpsSignalQuality,
    weatherSafe,
    geofenceBoundary,
    isWithinBoundary,
    
    // Getters
    canEngage,
    blockingIssues,
    hasObstaclesNearby,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    addWarning,
    acknowledgeWarning,
    clearWarning,
    activateEmergencyStop,
    resetEmergencyStop,
    enableManualOverride
  };
});
```

## Additional Function Controls

### Snow Clearing Controls
- Blade angle slider (-30° to +30°)
- Blade height adjustment
- Salt/sand dispenser rate
- Chute direction control (360°)
- Throw distance adjustment
- Snow depth display
- Ice detection warning

### Leaf Blowing Controls
- Power level slider (0-100%)
- Direction joystick (360°)
- Blow/vacuum mode toggle
- Collection bag fullness indicator
- Mulching ratio control
- Pattern automation options
- Debris type detection

### Towing Controls
- Hitch status indicator with lock control
- Load weight display and limits
- Speed governor settings
- Backup camera view
- Trailer brake adjustment
- Sway control activation
- Turn signal sync

### Patrol Controls
- Route recording interface
- Waypoint editor
- Speed profile settings
- Camera pan/tilt/zoom
- Alert zone configuration
- Motion detection sensitivity
- Scheduled patrol setup

## Safety Features Implementation

### Dead Man's Switch
- Continuous engagement required in manual mode
- Auto-stop if connection lost
- Configurable timeout period
- Override with acknowledgment

### Obstacle Detection
- 360-degree sensor coverage
- Distance-based speed reduction
- Automatic stop zones
- Override with caution mode

### Weather Integration
- Real-time weather monitoring
- Operation restrictions based on conditions
- Rain/snow detection
- Wind speed limits

### Geofencing
- Boundary definition on map
- Warning zones
- Hard stop boundaries
- RTH on boundary violation

## Testing Requirements
- Test all control modes
- Verify safety interlocks
- Test emergency stop from all states
- Validate function-specific controls
- Test keyboard shortcuts
- Verify obstacle detection
- Test weather restrictions

## Next Steps
After completing this stage, proceed to Stage 5: Map & Mission Planning to implement the mapping and mission planning interface.