<template>
  <q-page class="yard-map-page">
    <q-toolbar class="bg-grass-green text-white">
      <q-toolbar-title>Yard Map & Zones</q-toolbar-title>
      <q-btn 
        flat 
        icon="edit" 
        :label="editMode ? 'Save' : 'Edit'"
        @click="toggleEditMode" 
      />
    </q-toolbar>

    <div class="map-container">
      <!-- Map Canvas -->
      <div class="map-editor">
        <svg
          ref="mapSvg"
          class="map-svg"
          viewBox="0 0 800 600"
          @click="handleMapClick"
          @mousemove="handleMouseMove"
        >
          <!-- Grid Background -->
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <!-- Zones -->
          <g v-for="zone in zones" :key="zone.id">
            <polygon
              :points="zone.points.map(p => `${p.x},${p.y}`).join(' ')"
              :fill="zone.color"
              :fill-opacity="0.3"
              :stroke="zone.color"
              :stroke-width="editMode ? 3 : 2"
              class="zone-polygon"
              @click="selectZone(zone)"
            />
            <text
              :x="getZoneCenter(zone).x"
              :y="getZoneCenter(zone).y"
              text-anchor="middle"
              dominant-baseline="middle"
              class="zone-label"
            >
              {{ zone.name }}
            </text>
          </g>

          <!-- Obstacles -->
          <g v-for="obstacle in obstacles" :key="obstacle.id">
            <circle
              :cx="obstacle.x"
              :cy="obstacle.y"
              :r="obstacle.radius"
              fill="red"
              fill-opacity="0.5"
              stroke="red"
              stroke-width="2"
              class="obstacle"
              @click="selectObstacle(obstacle)"
            />
          </g>

          <!-- Drawing Preview -->
          <polygon
            v-if="drawingZone.length > 0"
            :points="drawingZone.map(p => `${p.x},${p.y}`).join(' ')"
            fill="blue"
            fill-opacity="0.2"
            stroke="blue"
            stroke-width="2"
            stroke-dasharray="5,5"
          />
        </svg>

        <!-- Toolbar -->
        <div class="map-toolbar" v-if="editMode">
          <q-btn-group>
            <q-btn
              :color="tool === 'zone' ? 'primary' : 'grey'"
              icon="crop_free"
              label="Zone"
              @click="tool = 'zone'"
            />
            <q-btn
              :color="tool === 'obstacle' ? 'primary' : 'grey'"
              icon="block"
              label="Obstacle"
              @click="tool = 'obstacle'"
            />
            <q-btn
              color="negative"
              icon="clear"
              label="Clear"
              @click="clearDrawing"
            />
          </q-btn-group>
        </div>
      </div>

      <!-- Zone Details Sidebar -->
      <q-drawer
        v-model="showZoneDetails"
        side="right"
        :width="350"
        bordered
        overlay
      >
        <q-card flat>
          <q-card-section>
            <div class="text-h6">Zone Details</div>
          </q-card-section>

          <q-card-section v-if="selectedZone">
            <q-input
              v-model="selectedZone.name"
              label="Zone Name"
              outlined
              class="q-mb-md"
            />
            
            <q-select
              v-model="selectedZone.type"
              :options="zoneTypes"
              label="Zone Type"
              outlined
              class="q-mb-md"
            />

            <div class="q-mb-md">
              <div class="text-subtitle2 q-mb-xs">Zone Color</div>
              <div class="row q-gutter-sm">
                <div
                  v-for="color in zoneColors"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: selectedZone.color === color }"
                  :style="{ backgroundColor: color }"
                  @click="selectedZone.color = color"
                />
              </div>
            </div>

            <q-input
              v-model="selectedZone.description"
              label="Description"
              type="textarea"
              outlined
              class="q-mb-md"
            />

            <div class="text-subtitle2 q-mb-sm">Settings</div>
            <q-toggle
              v-model="selectedZone.active"
              label="Active for tasks"
              class="q-mb-sm"
            />
            <q-toggle
              v-model="selectedZone.requiresGPS"
              label="Requires GPS precision"
              class="q-mb-md"
            />

            <div class="q-mt-md">
              <q-btn
                color="primary"
                label="Save Zone"
                class="full-width q-mb-sm"
                @click="updateZone"
              />
              <q-btn
                color="negative"
                outline
                label="Delete Zone"
                class="full-width"
                @click="deleteZone"
              />
            </div>
          </q-card-section>

          <q-card-section v-if="selectedObstacle">
            <q-input
              v-model="selectedObstacle.name"
              label="Obstacle Name"
              outlined
              class="q-mb-md"
            />
            
            <q-input
              v-model="selectedObstacle.radius"
              label="Radius"
              type="number"
              outlined
              class="q-mb-md"
            />

            <div class="q-mt-md">
              <q-btn
                color="primary"
                label="Update Obstacle"
                class="full-width q-mb-sm"
                @click="updateObstacle"
              />
              <q-btn
                color="negative"
                outline
                label="Delete Obstacle"
                class="full-width"
                @click="deleteObstacle"
              />
            </div>
          </q-card-section>
        </q-card>
      </q-drawer>
    </div>

    <!-- Zone Creation Dialog -->
    <q-dialog v-model="showZoneDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Create Zone</div>
        </q-card-section>
        
        <q-card-section>
          <q-input v-model="newZone.name" label="Zone Name" outlined />
          <q-select
            v-model="newZone.type"
            :options="zoneTypes"
            label="Zone Type"
            outlined
            class="q-mt-md"
          />
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="cancelZoneCreation" />
          <q-btn flat label="Create" color="primary" @click="createZone" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Point {
  x: number;
  y: number;
}

interface Zone {
  id: string;
  name: string;
  type: string;
  color: string;
  points: Point[];
  active: boolean;
  requiresGPS: boolean;
  description?: string;
}

interface Obstacle {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
}

// State
const editMode = ref(false);
const tool = ref<'zone' | 'obstacle'>('zone');
const showZoneDetails = ref(false);
const showZoneDialog = ref(false);
const selectedZone = ref<Zone | null>(null);
const selectedObstacle = ref<Obstacle | null>(null);
const drawingZone = ref<Point[]>([]);
const mapSvg = ref<SVGElement>();

const zoneTypes = [
  'Lawn Area',
  'Flower Bed',
  'Vegetable Garden',
  'Shrub Area',
  'Tree Zone',
  'Patio/Deck',
  'Walkway',
  'No-Go Zone'
];

const zoneColors = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#FFEB3B', // Yellow
  '#795548'  // Brown
];

const zones = ref<Zone[]>([
  {
    id: '1',
    name: 'Front Lawn',
    type: 'Lawn Area',
    color: '#4CAF50',
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 250 },
      { x: 100, y: 250 }
    ],
    active: true,
    requiresGPS: false,
    description: 'Main front lawn area for regular mowing'
  },
  {
    id: '2',
    name: 'Flower Bed',
    type: 'Flower Bed',
    color: '#FF9800',
    points: [
      { x: 350, y: 120 },
      { x: 450, y: 120 },
      { x: 450, y: 200 },
      { x: 350, y: 200 }
    ],
    active: false,
    requiresGPS: true,
    description: 'Delicate flower bed - avoid mowing'
  }
]);

const obstacles = ref<Obstacle[]>([
  { id: '1', name: 'Oak Tree', x: 200, y: 300, radius: 30 },
  { id: '2', name: 'Garden Shed', x: 500, y: 400, radius: 40 }
]);

const newZone = ref({
  name: '',
  type: 'Lawn Area'
});

// Computed
const grassGreen = '#4CAF50';

// Methods
function toggleEditMode() {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    clearDrawing();
  }
}

function handleMapClick(event: MouseEvent) {
  if (!editMode.value) return;

  const rect = mapSvg.value!.getBoundingClientRect();
  const point = {
    x: ((event.clientX - rect.left) / rect.width) * 800,
    y: ((event.clientY - rect.top) / rect.height) * 600
  };

  if (tool.value === 'zone') {
    drawingZone.value.push(point);
    if (drawingZone.value.length >= 3) {
      // Allow completion with right-click or double-click
      // For now, complete after 4 points
      if (drawingZone.value.length >= 4) {
        completeZoneDrawing();
      }
    }
  } else if (tool.value === 'obstacle') {
    createObstacle(point);
  }
}

function handleMouseMove(event: MouseEvent) {
  // Handle preview drawing if needed
}

function completeZoneDrawing() {
  if (drawingZone.value.length >= 3) {
    showZoneDialog.value = true;
  }
}

function createZone() {
  const zone: Zone = {
    id: Date.now().toString(),
    name: newZone.value.name,
    type: newZone.value.type,
    color: zoneColors[0],
    points: [...drawingZone.value],
    active: true,
    requiresGPS: false
  };
  zones.value.push(zone);
  clearDrawing();
  showZoneDialog.value = false;
  newZone.value = { name: '', type: 'Lawn Area' };
}

function cancelZoneCreation() {
  clearDrawing();
  showZoneDialog.value = false;
}

function createObstacle(point: Point) {
  const obstacle: Obstacle = {
    id: Date.now().toString(),
    name: `Obstacle ${obstacles.value.length + 1}`,
    x: point.x,
    y: point.y,
    radius: 25
  };
  obstacles.value.push(obstacle);
}

function selectZone(zone: Zone) {
  selectedZone.value = zone;
  selectedObstacle.value = null;
  showZoneDetails.value = true;
}

function selectObstacle(obstacle: Obstacle) {
  selectedObstacle.value = obstacle;
  selectedZone.value = null;
  showZoneDetails.value = true;
}

function updateZone() {
  console.log('Updating zone:', selectedZone.value);
}

function deleteZone() {
  if (selectedZone.value) {
    const index = zones.value.findIndex(z => z.id === selectedZone.value!.id);
    if (index >= 0) {
      zones.value.splice(index, 1);
      showZoneDetails.value = false;
      selectedZone.value = null;
    }
  }
}

function updateObstacle() {
  console.log('Updating obstacle:', selectedObstacle.value);
}

function deleteObstacle() {
  if (selectedObstacle.value) {
    const index = obstacles.value.findIndex(o => o.id === selectedObstacle.value!.id);
    if (index >= 0) {
      obstacles.value.splice(index, 1);
      showZoneDetails.value = false;
      selectedObstacle.value = null;
    }
  }
}

function getZoneCenter(zone: Zone): Point {
  const x = zone.points.reduce((sum, p) => sum + p.x, 0) / zone.points.length;
  const y = zone.points.reduce((sum, p) => sum + p.y, 0) / zone.points.length;
  return { x, y };
}

function clearDrawing() {
  drawingZone.value = [];
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.yard-map-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.bg-grass-green {
  background-color: $primary !important;
}

.map-container {
  flex: 1;
  display: flex;
  position: relative;
}

.map-editor {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.map-svg {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.zone-polygon {
  cursor: pointer;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 0.8;
  }
}

.zone-label {
  font-size: 14px;
  font-weight: 600;
  fill: #333;
  pointer-events: none;
}

.obstacle {
  cursor: pointer;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 0.8;
  }
}

.map-toolbar {
  position: absolute;
  top: $spacing-md;
  left: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
  border-radius: $radius-md;
  padding: $spacing-sm;
  backdrop-filter: blur(10px);
}

.color-swatch {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.3s ease;

  &.active {
    border-color: #333;
  }

  &:hover {
    border-color: #666;
  }
}
</style>