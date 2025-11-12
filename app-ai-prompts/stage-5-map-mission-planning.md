# Stage 5: Map & Mission Planning

## Objective
Implement an interactive mapping interface with comprehensive mission planning tools. Enable users to define work areas, create efficient patterns, set boundaries, mark obstacles, and preview missions before execution.

## Prerequisites
- Completed Stages 1-4
- Control interfaces implemented
- Real-time telemetry working
- Task management foundation ready

## Features to Implement

### 1. Interactive Map
- Leaflet-based mapping
- Satellite/terrain/street view layers
- Real-time vehicle position
- GPS tracking with breadcrumb trail
- Zoom and pan controls
- Coordinate display

### 2. Mission Drawing Tools
- Polygon boundary drawing
- Rectangle/circle area tools
- Waypoint placement
- Path drawing with curves
- Freehand drawing mode
- Measurement tools (distance, area)

### 3. Pattern Generation
- Automatic pattern algorithms
- Configurable spacing and overlap
- Multiple pattern types per function
- Pattern optimization
- Preview with statistics
- Manual pattern editing

### 4. Obstacle Management
- Static obstacle placement
- Obstacle detection from sensors
- No-go zone definition
- Buffer zone settings
- Obstacle avoidance configuration
- Safety margin visualization

### 5. Mission Validation
- Path collision detection
- Boundary validation
- Time/battery estimation
- Weather suitability check
- Slope analysis
- Risk assessment

## Component Structure

```
src/components/map/
├── MapContainer.vue            # Main map component
├── MapControls.vue            # Map toolbar
├── LayerSelector.vue          # Map layer controls
├── CoordinateDisplay.vue      # GPS coordinates
├── drawing/
│   ├── DrawingToolbar.vue     # Drawing tools
│   ├── BoundaryTool.vue       # Boundary drawing
│   ├── WaypointTool.vue       # Waypoint placement
│   ├── MeasurementTool.vue    # Distance/area tools
│   └── PatternPreview.vue     # Pattern visualization
├── patterns/
│   ├── PatternGenerator.vue   # Pattern creation
│   ├── MowingPatterns.vue     # Mowing-specific patterns
│   ├── SnowPatterns.vue       # Snow clearing patterns
│   ├── LeafPatterns.vue       # Leaf collection patterns
│   └── PatrolPatterns.vue     # Patrol route patterns
├── obstacles/
│   ├── ObstacleManager.vue    # Obstacle interface
│   ├── ObstacleEditor.vue     # Edit obstacles
│   └── NoGoZones.vue          # No-go zone editor
└── mission/
    ├── MissionPreview.vue     # Mission preview
    ├── MissionValidation.vue  # Validation results
    └── MissionSummary.vue     # Mission statistics

src/pages/
└── MissionPlannerPage.vue     # Main planning page

src/stores/
├── map.ts                     # Map state
├── mission.ts                 # Mission planning
└── patterns.ts                # Pattern generation
```

## Implementation

### Mission Planner Page (pages/MissionPlannerPage.vue)

```vue
<template>
  <q-page class="mission-planner">
    <!-- Top Toolbar -->
    <div class="planner-toolbar">
      <div class="toolbar-section">
        <q-btn-group unelevated>
          <q-btn 
            :color="tool === 'select' ? 'primary' : 'grey-5'"
            icon="near_me" 
            label="Select"
            @click="setTool('select')"
          />
          <q-btn 
            :color="tool === 'boundary' ? 'primary' : 'grey-5'"
            icon="crop_free" 
            label="Boundary"
            @click="setTool('boundary')"
          />
          <q-btn 
            :color="tool === 'pattern' ? 'primary' : 'grey-5'"
            icon="grid_on" 
            label="Pattern"
            @click="setTool('pattern')"
          />
          <q-btn 
            :color="tool === 'obstacle' ? 'primary' : 'grey-5'"
            icon="warning" 
            label="Obstacles"
            @click="setTool('obstacle')"
          />
          <q-btn 
            :color="tool === 'waypoint' ? 'primary' : 'grey-5'"
            icon="place" 
            label="Waypoints"
            @click="setTool('waypoint')"
          />
        </q-btn-group>
      </div>
      
      <q-space />
      
      <div class="toolbar-section">
        <q-btn 
          outline 
          color="primary" 
          icon="visibility" 
          label="Preview"
          @click="previewMission"
          :disable="!canPreview"
        />
        <q-btn 
          unelevated 
          color="positive" 
          icon="save" 
          label="Save Mission"
          @click="saveMission"
          :disable="!canSave"
        />
      </div>
    </div>
    
    <!-- Main Content -->
    <div class="planner-content">
      <!-- Left Panel - Tools -->
      <div class="tools-panel">
        <q-scroll-area class="fit">
          <!-- Tool-specific controls -->
          <transition name="slide-right" mode="out-in">
            <component 
              :is="activeToolComponent"
              :key="tool"
              v-model="toolSettings"
              @update="handleToolUpdate"
            />
          </transition>
          
          <q-separator class="q-my-md" />
          
          <!-- Mission Settings -->
          <q-card>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Mission Settings</div>
              
              <q-input
                v-model="missionStore.currentMission.name"
                label="Mission Name"
                outlined
                dense
                class="q-mb-md"
              />
              
              <q-select
                v-model="missionStore.currentMission.type"
                :options="missionTypes"
                label="Mission Type"
                outlined
                dense
                class="q-mb-md"
              />
              
              <q-input
                v-model="missionStore.currentMission.description"
                type="textarea"
                label="Description"
                outlined
                dense
                rows="3"
              />
            </q-card-section>
          </q-card>
          
          <!-- Pattern Settings -->
          <q-card v-if="tool === 'pattern'" class="q-mt-md">
            <q-card-section>
              <PatternGenerator 
                v-model="patternSettings"
                :function-type="missionStore.currentMission.type"
                :boundary="mapStore.boundary"
                @generate="generatePattern"
              />
            </q-card-section>
          </q-card>
          
          <!-- Mission Statistics -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Mission Statistics</div>
              <q-list dense>
                <q-item>
                  <q-item-section>
                    <q-item-label>Total Distance</q-item-label>
                    <q-item-label caption>{{ missionStats.distance }} m</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label>Estimated Time</q-item-label>
                    <q-item-label caption>{{ missionStats.duration }} min</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label>Area Coverage</q-item-label>
                    <q-item-label caption>{{ missionStats.area }} m²</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label>Battery Usage</q-item-label>
                    <q-item-label caption>~{{ missionStats.batteryUsage }}%</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </q-scroll-area>
      </div>
      
      <!-- Center Panel - Map -->
      <div class="map-panel">
        <MapContainer
          ref="mapRef"
          :tool="tool"
          :boundary="mapStore.boundary"
          :waypoints="mapStore.waypoints"
          :obstacles="mapStore.obstacles"
          :pattern="mapStore.pattern"
          :vehicle-position="telemetryStore.position"
          :vehicle-heading="telemetryStore.attitude.yaw"
          @boundary-updated="updateBoundary"
          @waypoint-added="addWaypoint"
          @waypoint-moved="moveWaypoint"
          @waypoint-removed="removeWaypoint"
          @obstacle-added="addObstacle"
          @obstacle-moved="moveObstacle"
          @obstacle-removed="removeObstacle"
          @map-clicked="handleMapClick"
        />
        
        <!-- Map Overlay Controls -->
        <div class="map-overlays">
          <!-- Layer Selector -->
          <LayerSelector 
            v-model="mapLayer"
            class="layer-selector"
          />
          
          <!-- Coordinate Display -->
          <CoordinateDisplay 
            :position="mousePosition"
            :vehicle-position="telemetryStore.position"
            class="coordinate-display"
          />
          
          <!-- Zoom Controls -->
          <div class="zoom-controls">
            <q-btn 
              round 
              color="white" 
              text-color="grey-8"
              icon="add"
              size="sm"
              @click="zoomIn"
            />
            <q-btn 
              round 
              color="white" 
              text-color="grey-8"
              icon="remove"
              size="sm"
              @click="zoomOut"
            />
            <q-btn 
              round 
              color="white" 
              text-color="grey-8"
              icon="my_location"
              size="sm"
              @click="centerOnVehicle"
            />
          </div>
        </div>
      </div>
      
      <!-- Right Panel - Validation & Preview -->
      <div class="validation-panel">
        <q-tabs
          v-model="rightTab"
          vertical
          class="text-primary"
        >
          <q-tab name="validation" label="Validation" icon="check_circle" />
          <q-tab name="preview" label="Preview" icon="visibility" />
          <q-tab name="history" label="History" icon="history" />
        </q-tabs>
        
        <q-separator />
        
        <q-tab-panels v-model="rightTab" vertical>
          <!-- Validation Panel -->
          <q-tab-panel name="validation">
            <MissionValidation 
              :mission="missionStore.currentMission"
              :boundary="mapStore.boundary"
              :obstacles="mapStore.obstacles"
              :pattern="mapStore.pattern"
              @fix-issue="handleValidationFix"
            />
          </q-tab-panel>
          
          <!-- Preview Panel -->
          <q-tab-panel name="preview">
            <MissionPreview 
              :mission="missionStore.currentMission"
              :stats="missionStats"
              @start-mission="startMission"
            />
          </q-tab-panel>
          
          <!-- History Panel -->
          <q-tab-panel name="history">
            <div class="text-subtitle1 q-mb-md">Recent Missions</div>
            <q-list>
              <q-item
                v-for="mission in recentMissions"
                :key="mission.id"
                clickable
                @click="loadMission(mission)"
              >
                <q-item-section avatar>
                  <q-icon :name="getMissionIcon(mission.type)" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ mission.name }}</q-item-label>
                  <q-item-label caption>
                    {{ formatDate(mission.createdTime) }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>
    
    <!-- Preview Dialog -->
    <q-dialog v-model="showPreview" maximized>
      <MissionPreviewDialog 
        :mission="missionStore.currentMission"
        @confirm="confirmMission"
        @cancel="showPreview = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useMapStore } from '@/stores/map';
import { useMissionStore } from '@/stores/mission';
import { usePatternsStore } from '@/stores/patterns';
import { useTelemetryStore } from '@/stores/telemetry';

// Component imports
import MapContainer from '@/components/map/MapContainer.vue';
import LayerSelector from '@/components/map/LayerSelector.vue';
import CoordinateDisplay from '@/components/map/CoordinateDisplay.vue';
import PatternGenerator from '@/components/map/patterns/PatternGenerator.vue';
import MissionValidation from '@/components/map/mission/MissionValidation.vue';
import MissionPreview from '@/components/map/mission/MissionPreview.vue';
import MissionPreviewDialog from '@/components/map/mission/MissionPreviewDialog.vue';

const router = useRouter();
const $q = useQuasar();
const mapStore = useMapStore();
const missionStore = useMissionStore();
const patternsStore = usePatternsStore();
const telemetryStore = useTelemetryStore();

// Current tool state
const tool = ref<'select' | 'boundary' | 'pattern' | 'obstacle' | 'waypoint'>('select');
const rightTab = ref('validation');
const mapLayer = ref('satellite');
const mousePosition = ref({ lat: 0, lng: 0 });
const showPreview = ref(false);

// Tool settings
const toolSettings = ref({});
const patternSettings = ref({
  type: 'stripe',
  spacing: 2,
  overlap: 0.1,
  angle: 0,
  startCorner: 'bottom-left'
});

// Mission types
const missionTypes = [
  { label: 'Mowing', value: 'mowing', icon: 'grass' },
  { label: 'Snow Clearing', value: 'snow_removal', icon: 'ac_unit' },
  { label: 'Leaf Collection', value: 'leaf_blowing', icon: 'park' },
  { label: 'Patrol Route', value: 'patrolling', icon: 'shield' },
  { label: 'Custom', value: 'custom', icon: 'build' }
];

// Tool components map
const toolComponents = {
  boundary: 'BoundaryTool',
  pattern: 'PatternGenerator',
  obstacle: 'ObstacleManager',
  waypoint: 'WaypointTool',
  select: 'div'
};

const activeToolComponent = computed(() => 
  toolComponents[tool.value] || 'div'
);

// Mission statistics
const missionStats = computed(() => {
  const pattern = mapStore.pattern;
  const boundary = mapStore.boundary;
  
  if (!pattern || !boundary) {
    return {
      distance: 0,
      duration: 0,
      area: 0,
      batteryUsage: 0,
      waypoints: 0
    };
  }
  
  const distance = calculateTotalDistance(pattern);
  const area = calculateArea(boundary);
  const duration = estimateDuration(distance, missionStore.currentMission.type);
  const batteryUsage = estimateBatteryUsage(duration, missionStore.currentMission.type);
  
  return {
    distance: Math.round(distance),
    duration: Math.round(duration),
    area: Math.round(area),
    batteryUsage: Math.round(batteryUsage),
    waypoints: pattern.length
  };
});

// Validation
const canPreview = computed(() => {
  return mapStore.boundary && mapStore.pattern && mapStore.pattern.length > 0;
});

const canSave = computed(() => {
  return canPreview.value && 
         missionStore.currentMission.name &&
         missionStore.validation.isValid;
});

const recentMissions = computed(() => 
  missionStore.savedMissions.slice(0, 10)
);

// Tool management
function setTool(newTool: string) {
  tool.value = newTool as any;
  mapStore.setActiveTool(newTool);
}

function handleToolUpdate(data: any) {
  toolSettings.value = { ...toolSettings.value, ...data };
}

// Map interactions
function handleMapClick(event: any) {
  mousePosition.value = event.latlng;
  
  switch (tool.value) {
    case 'waypoint':
      addWaypoint(event.latlng);
      break;
    case 'obstacle':
      addObstacle(event.latlng);
      break;
  }
}

// Boundary management
function updateBoundary(boundary: any) {
  mapStore.setBoundary(boundary);
  
  // Auto-generate pattern if none exists
  if (!mapStore.pattern && boundary) {
    generatePattern();
  }
}

// Waypoint management
function addWaypoint(latlng: any) {
  mapStore.addWaypoint({
    lat: latlng.lat,
    lng: latlng.lng,
    altitude: 10,
    speed: 2
  });
}

function moveWaypoint(index: number, latlng: any) {
  mapStore.updateWaypoint(index, {
    lat: latlng.lat,
    lng: latlng.lng
  });
}

function removeWaypoint(index: number) {
  mapStore.removeWaypoint(index);
}

// Obstacle management
function addObstacle(latlng: any) {
  $q.dialog({
    title: 'Add Obstacle',
    message: 'What type of obstacle is this?',
    options: {
      type: 'radio',
      model: 'tree',
      items: [
        { label: 'Tree', value: 'tree' },
        { label: 'Building', value: 'building' },
        { label: 'Garden Bed', value: 'garden' },
        { label: 'Water Feature', value: 'water' },
        { label: 'Other', value: 'other' }
      ]
    },
    cancel: true
  }).onOk((obstacleType) => {
    mapStore.addObstacle({
      lat: latlng.lat,
      lng: latlng.lng,
      type: obstacleType,
      radius: 2,
      height: 2
    });
  });
}

function moveObstacle(id: string, latlng: any) {
  mapStore.updateObstacle(id, {
    lat: latlng.lat,
    lng: latlng.lng
  });
}

function removeObstacle(id: string) {
  mapStore.removeObstacle(id);
}

// Pattern generation
async function generatePattern() {
  if (!mapStore.boundary) {
    $q.notify({
      type: 'warning',
      message: 'Please draw a boundary first'
    });
    return;
  }
  
  try {
    const pattern = await patternsStore.generatePattern({
      boundary: mapStore.boundary,
      obstacles: mapStore.obstacles,
      type: patternSettings.value.type,
      spacing: patternSettings.value.spacing,
      overlap: patternSettings.value.overlap,
      angle: patternSettings.value.angle,
      functionType: missionStore.currentMission.type
    });
    
    mapStore.setPattern(pattern);
    
    $q.notify({
      type: 'positive',
      message: `Pattern generated: ${pattern.length} waypoints`
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Pattern generation failed: ${error.message}`
    });
  }
}

// Mission management
function previewMission() {
  showPreview.value = true;
}

async function saveMission() {
  try {
    const mission = {
      ...missionStore.currentMission,
      boundary: mapStore.boundary,
      waypoints: mapStore.pattern,
      obstacles: mapStore.obstacles,
      statistics: missionStats.value
    };
    
    await missionStore.saveMission(mission);
    
    $q.notify({
      type: 'positive',
      message: 'Mission saved successfully'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Save failed: ${error.message}`
    });
  }
}

async function startMission() {
  try {
    // Validate mission
    const validation = await missionStore.validateMission();
    
    if (!validation.isValid) {
      $q.notify({
        type: 'negative',
        message: 'Mission validation failed',
        caption: validation.errors.join(', ')
      });
      return;
    }
    
    // Confirm start
    $q.dialog({
      title: 'Start Mission',
      message: `Start ${missionStore.currentMission.name}?`,
      html: `
        <div>
          <p>Duration: ${missionStats.value.duration} minutes</p>
          <p>Distance: ${missionStats.value.distance} meters</p>
          <p>Battery: ~${missionStats.value.batteryUsage}%</p>
        </div>
      `,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      await missionStore.startMission();
      router.push('/control');
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Mission start failed: ${error.message}`
    });
  }
}

function confirmMission() {
  showPreview.value = false;
  startMission();
}

async function loadMission(mission: any) {
  try {
    await missionStore.loadMission(mission.id);
    
    // Update map
    mapStore.setBoundary(mission.boundary);
    mapStore.setPattern(mission.waypoints);
    mapStore.setObstacles(mission.obstacles);
    
    $q.notify({
      type: 'positive',
      message: `Loaded mission: ${mission.name}`
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Load failed: ${error.message}`
    });
  }
}

// Map controls
function zoomIn() {
  mapStore.adjustZoom(1);
}

function zoomOut() {
  mapStore.adjustZoom(-1);
}

function centerOnVehicle() {
  if (telemetryStore.position.lat && telemetryStore.position.lon) {
    mapStore.setCenter({
      lat: telemetryStore.position.lat,
      lng: telemetryStore.position.lon
    });
  }
}

// Validation
function handleValidationFix(issue: any) {
  switch (issue.type) {
    case 'pattern_overlap':
      generatePattern();
      break;
    case 'boundary_invalid':
      mapStore.clearBoundary();
      break;
    case 'obstacle_conflict':
      // Auto-adjust obstacles
      break;
  }
}

// Utility functions
function calculateTotalDistance(pattern: any[]): number {
  if (!pattern || pattern.length < 2) return 0;
  
  let distance = 0;
  for (let i = 1; i < pattern.length; i++) {
    const prev = pattern[i - 1];
    const curr = pattern[i];
    distance += haversineDistance(prev, curr);
  }
  
  return distance;
}

function calculateArea(boundary: any): number {
  if (!boundary) return 0;
  // Calculate polygon area using shoelace formula
  return 0; // Placeholder
}

function estimateDuration(distance: number, missionType: string): number {
  const speed = getAverageSpeed(missionType);
  return distance / speed / 60; // minutes
}

function estimateBatteryUsage(duration: number, missionType: string): number {
  const consumption = getPowerConsumption(missionType);
  return (duration * consumption) / 100; // percentage
}

function getAverageSpeed(missionType: string): number {
  switch (missionType) {
    case 'mowing': return 2.0;
    case 'snow_removal': return 3.0;
    case 'leaf_blowing': return 2.5;
    case 'patrolling': return 4.0;
    default: return 2.0;
  }
}

function getPowerConsumption(missionType: string): number {
  switch (missionType) {
    case 'mowing': return 5; // % per minute
    case 'snow_removal': return 8;
    case 'leaf_blowing': return 6;
    case 'patrolling': return 3;
    default: return 5;
  }
}

function haversineDistance(pos1: any, pos2: any): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = pos1.lat * Math.PI / 180;
  const φ2 = pos2.lat * Math.PI / 180;
  const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
  const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getMissionIcon(type: string): string {
  const icons = {
    mowing: 'grass',
    snow_removal: 'ac_unit',
    leaf_blowing: 'park',
    patrolling: 'shield',
    custom: 'build'
  };
  return icons[type] || 'task';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

onMounted(() => {
  // Initialize map center to vehicle position or default
  if (telemetryStore.position.lat && telemetryStore.position.lon) {
    centerOnVehicle();
  } else {
    // Default to a reasonable location
    mapStore.setCenter({ lat: 40.7128, lng: -74.0060 });
  }
});
</script>

<style lang="scss" scoped>
.mission-planner {
  height: 100vh;
  overflow: hidden;
  background-color: $background;
}

.planner-toolbar {
  height: 60px;
  background: white;
  border-bottom: 1px solid $grey-4;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.toolbar-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.planner-content {
  height: calc(100vh - 60px);
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 0;
}

.tools-panel,
.validation-panel {
  background: white;
  border-right: 1px solid $grey-4;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.map-panel {
  position: relative;
  background: $grey-2;
}

.map-overlays {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-selector,
.coordinate-display {
  background: rgba(white, 0.95);
  backdrop-filter: blur(5px);
  border-radius: $radius-md;
  padding: 8px;
  box-shadow: $shadow-sm;
}

.zoom-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

// Responsive
@media (max-width: 1400px) {
  .planner-content {
    grid-template-columns: 280px 1fr 320px;
  }
}

@media (max-width: 1200px) {
  .planner-content {
    grid-template-columns: 250px 1fr 280px;
  }
}

@media (max-width: 996px) {
  .planner-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .tools-panel {
    grid-row: 1;
    max-height: 200px;
  }
  
  .map-panel {
    grid-row: 2;
  }
  
  .validation-panel {
    grid-row: 3;
    max-height: 200px;
  }
}

// Tool-specific styles
:deep(.vue-map-container) {
  height: 100%;
  width: 100%;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
```

### Map Store (stores/map.ts)

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface MapBoundary {
  type: 'polygon' | 'rectangle' | 'circle';
  coordinates: Array<{ lat: number; lng: number }>;
  area?: number;
}

export interface MapWaypoint {
  lat: number;
  lng: number;
  altitude: number;
  speed?: number;
  yaw?: number;
  dwellTime?: number;
  action?: string;
}

export interface MapObstacle {
  id: string;
  lat: number;
  lng: number;
  type: 'tree' | 'building' | 'garden' | 'water' | 'other';
  radius: number;
  height: number;
  avoidanceBuffer: number;
}

export const useMapStore = defineStore('map', () => {
  // State
  const center = ref({ lat: 40.7128, lng: -74.0060 });
  const zoom = ref(18);
  const activeTool = ref('select');
  const selectedLayer = ref('satellite');
  
  // Mission elements
  const boundary = ref<MapBoundary | null>(null);
  const waypoints = ref<MapWaypoint[]>([]);
  const pattern = ref<MapWaypoint[]>([]);
  const obstacles = ref<MapObstacle[]>([]);
  const noGoZones = ref<MapBoundary[]>([]);
  
  // Drawing state
  const isDrawing = ref(false);
  const tempDrawing = ref<any>(null);
  
  // Vehicle state
  const vehiclePosition = ref<{ lat: number; lng: number } | null>(null);
  const vehicleHeading = ref(0);
  const vehicleTrail = ref<Array<{ lat: number; lng: number; timestamp: Date }>>([]);
  
  // Getters
  const hasValidBoundary = computed(() => {
    return boundary.value && boundary.value.coordinates.length >= 3;
  });
  
  const totalArea = computed(() => {
    if (!boundary.value) return 0;
    return calculatePolygonArea(boundary.value.coordinates);
  });
  
  const obstacleCount = computed(() => obstacles.value.length);
  
  const waypointCount = computed(() => pattern.value.length);
  
  // Actions
  function setCenter(position: { lat: number; lng: number }) {
    center.value = position;
  }
  
  function setZoom(level: number) {
    zoom.value = Math.max(1, Math.min(20, level));
  }
  
  function adjustZoom(delta: number) {
    setZoom(zoom.value + delta);
  }
  
  function setActiveTool(tool: string) {
    activeTool.value = tool;
    
    // Clear temp drawing when switching tools
    if (isDrawing.value) {
      cancelDrawing();
    }
  }
  
  function setLayer(layer: string) {
    selectedLayer.value = layer;
  }
  
  // Boundary management
  function setBoundary(newBoundary: MapBoundary) {
    boundary.value = newBoundary;
    
    // Clear existing pattern when boundary changes
    if (pattern.value.length > 0) {
      pattern.value = [];
    }
  }
  
  function clearBoundary() {
    boundary.value = null;
    pattern.value = [];
  }
  
  function addBoundaryPoint(point: { lat: number; lng: number }) {
    if (!boundary.value) {
      boundary.value = {
        type: 'polygon',
        coordinates: [point]
      };
    } else {
      boundary.value.coordinates.push(point);
    }
  }
  
  function closeBoundary() {
    if (boundary.value && boundary.value.coordinates.length >= 3) {
      // Calculate area
      boundary.value.area = calculatePolygonArea(boundary.value.coordinates);
      isDrawing.value = false;
    }
  }
  
  // Waypoint management
  function addWaypoint(waypoint: MapWaypoint) {
    waypoints.value.push(waypoint);
  }
  
  function updateWaypoint(index: number, updates: Partial<MapWaypoint>) {
    const waypoint = waypoints.value[index];
    if (waypoint) {
      Object.assign(waypoint, updates);
    }
  }
  
  function removeWaypoint(index: number) {
    waypoints.value.splice(index, 1);
  }
  
  function clearWaypoints() {
    waypoints.value = [];
  }
  
  // Pattern management
  function setPattern(newPattern: MapWaypoint[]) {
    pattern.value = newPattern;
  }
  
  function clearPattern() {
    pattern.value = [];
  }
  
  // Obstacle management
  function addObstacle(obstacle: Omit<MapObstacle, 'id'>) {
    const newObstacle: MapObstacle = {
      ...obstacle,
      id: `obstacle-${Date.now()}`,
      avoidanceBuffer: obstacle.radius + 1
    };
    obstacles.value.push(newObstacle);
  }
  
  function updateObstacle(id: string, updates: Partial<MapObstacle>) {
    const obstacle = obstacles.value.find(o => o.id === id);
    if (obstacle) {
      Object.assign(obstacle, updates);
    }
  }
  
  function removeObstacle(id: string) {
    const index = obstacles.value.findIndex(o => o.id === id);
    if (index >= 0) {
      obstacles.value.splice(index, 1);
    }
  }
  
  function clearObstacles() {
    obstacles.value = [];
  }
  
  // Vehicle tracking
  function updateVehiclePosition(position: { lat: number; lng: number }) {
    vehiclePosition.value = position;
    
    // Add to trail
    vehicleTrail.value.push({
      ...position,
      timestamp: new Date()
    });
    
    // Keep trail to reasonable size
    if (vehicleTrail.value.length > 1000) {
      vehicleTrail.value.shift();
    }
  }
  
  function updateVehicleHeading(heading: number) {
    vehicleHeading.value = heading;
  }
  
  function clearVehicleTrail() {
    vehicleTrail.value = [];
  }
  
  // Drawing utilities
  function startDrawing() {
    isDrawing.value = true;
    tempDrawing.value = null;
  }
  
  function cancelDrawing() {
    isDrawing.value = false;
    tempDrawing.value = null;
  }
  
  // Utility functions
  function calculatePolygonArea(coordinates: Array<{ lat: number; lng: number }>): number {
    if (coordinates.length < 3) return 0;
    
    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      area += coordinates[i].lat * coordinates[j].lng;
      area -= coordinates[j].lat * coordinates[i].lng;
    }
    
    return Math.abs(area) / 2 * 111320 * 111320; // Convert to square meters (approximate)
  }
  
  return {
    // State
    center,
    zoom,
    activeTool,
    selectedLayer,
    boundary,
    waypoints,
    pattern,
    obstacles,
    noGoZones,
    isDrawing,
    tempDrawing,
    vehiclePosition,
    vehicleHeading,
    vehicleTrail,
    
    // Getters
    hasValidBoundary,
    totalArea,
    obstacleCount,
    waypointCount,
    
    // Actions
    setCenter,
    setZoom,
    adjustZoom,
    setActiveTool,
    setLayer,
    setBoundary,
    clearBoundary,
    addBoundaryPoint,
    closeBoundary,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    clearWaypoints,
    setPattern,
    clearPattern,
    addObstacle,
    updateObstacle,
    removeObstacle,
    clearObstacles,
    updateVehiclePosition,
    updateVehicleHeading,
    clearVehicleTrail,
    startDrawing,
    cancelDrawing
  };
});
```

## Pattern Generation Algorithms

### Mowing Patterns

#### Stripe Pattern (Parallel Lines)
```typescript
function generateStripePattern(boundary: MapBoundary, spacing: number, angle: number = 0): MapWaypoint[] {
  // Calculate optimal stripe direction
  // Generate parallel lines with specified spacing
  // Handle boundary intersections
  // Optimize turn points
  // Return waypoint array
}
```

#### Spiral Pattern (Inward/Outward)
```typescript
function generateSpiralPattern(boundary: MapBoundary, spacing: number, direction: 'inward' | 'outward'): MapWaypoint[] {
  // Start from boundary edge or center
  // Create spiral path with consistent spacing
  // Handle complex boundary shapes
  // Minimize turns and direction changes
}
```

#### Checkerboard Pattern
```typescript
function generateCheckerboardPattern(boundary: MapBoundary, spacing: number): MapWaypoint[] {
  // Divide area into grid squares
  // Create alternating pattern
  // Optimize for minimal travel distance
  // Handle partial squares at boundaries
}
```

### Snow Clearing Patterns

#### Priority Route Pattern
- Clear main paths first
- Emergency access routes
- High-traffic areas
- Drainage considerations

#### Windrow Pattern
- Push snow to designated areas
- Minimize rehandling
- Consider wind direction
- Optimize for equipment width

### Leaf Collection Patterns

#### Collection Zone Pattern
- Blow leaves to collection points
- Multiple collection areas
- Wind direction optimization
- Minimize scatter

#### Vacuum Pattern
- Systematic coverage
- Overlap for thorough collection
- Bag capacity considerations
- Empty point routing

## Map Integration Features

### Leaflet Plugins
- Drawing plugin for boundaries
- Measurement plugin for distances
- Elevation plugin for terrain
- Geocoding for address search
- Export plugin for saving maps

### Custom Overlays
- Vehicle icon with heading
- Progress trail visualization
- Pattern preview lines
- Obstacle markers
- Boundary highlighting
- Grid overlay for measurements

### Real-time Updates
- Vehicle position tracking
- Progress visualization
- Obstacle detection overlay
- Weather conditions display
- Live sensor data integration

## Mission Validation Rules

### Boundary Validation
- Minimum area requirements
- Self-intersection detection
- Slope analysis
- Property boundary compliance

### Pattern Validation
- Coverage completeness check
- Obstacle collision detection
- Turn radius validation
- Battery life estimation
- Time constraint verification

### Safety Validation
- Emergency access routes
- No-go zone compliance
- Weather suitability
- Equipment readiness
- Operator authorization

## Testing Requirements
- Test pattern generation algorithms
- Verify boundary drawing tools
- Test mission validation logic
- Validate coordinate transformations
- Test map performance with large datasets
- Verify real-time position updates

## Next Steps
After completing this stage, proceed to Stage 6: Task Management System to implement comprehensive task creation, scheduling, and execution features.