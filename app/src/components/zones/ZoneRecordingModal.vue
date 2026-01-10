<script setup lang="ts">
import { ref, computed } from 'vue'
import { useZoneRecording } from '@/composables/useZoneRecording'
import { useAnchorRecording } from '@/composables/useAnchorRecording'
import { useZonesStore } from '@/stores/zones'
import { useNotifications } from '@/composables/useNotifications'
import { useDialog } from '@/composables/useDialog'
import RecordingMap from './RecordingMap.vue'
import RecordingControls from './RecordingControls.vue'
import RecordingStats from './RecordingStats.vue'
import AnchorRecordingMode from './AnchorRecordingMode.vue'
import AnchorStats from './AnchorStats.vue'
import type { RecordingMode } from '@/types/recording'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const zonesStore = useZonesStore()
const { success, error: showError } = useNotifications()
const dialog = useDialog()

// Recording mode
const recordingMode = ref<RecordingMode>('perimeter')

// Perimeter recording composable
const perimeterRecording = useZoneRecording()

// Anchor recording composable
const anchorRecording = useAnchorRecording()

// Use appropriate composable based on mode
const isRecording = computed(() =>
  recordingMode.value === 'perimeter' ? perimeterRecording.isRecording.value : anchorRecording.isRecording.value
)
const isPaused = computed(() =>
  recordingMode.value === 'perimeter' ? perimeterRecording.isPaused.value : anchorRecording.isPaused.value
)
const waypoints = computed(() => perimeterRecording.waypoints.value)
const anchors = computed(() => anchorRecording.anchors.value)
const estimatedArea = computed(() =>
  recordingMode.value === 'perimeter' ? perimeterRecording.estimatedArea.value : anchorRecording.estimatedArea.value
)
const estimatedPerimeter = computed(() =>
  recordingMode.value === 'perimeter' ? perimeterRecording.estimatedPerimeter.value : anchorRecording.estimatedPerimeter.value
)

const zoneName = ref('')
const showNameInput = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

async function handleStart() {
  try {
    if (recordingMode.value === 'perimeter') {
      await perimeterRecording.startRecording({
        sampleRate: 1.0,      // 1 meter between samples
        minAccuracy: 3.0,      // 3m GPS accuracy required
        autoClose: true,
        autoSimplify: true,
        simplifyTolerance: 0.5
      })
      success('Recording started - drive around the perimeter')
    } else {
      await anchorRecording.startRecording({
        autoSquare: true,
        snapAngleThreshold: 10.0,
        minAnchors: 3,
        maxAnchors: 20
      })
      success('Recording started - click on the map to mark corners')
    }
  } catch (err) {
    showError('Failed to start recording')
    console.error(err)
  }
}

async function handlePause() {
  if (recordingMode.value === 'perimeter') {
    await perimeterRecording.pauseRecording()
  } else {
    await anchorRecording.pauseRecording()
  }
}

async function handleResume() {
  if (recordingMode.value === 'perimeter') {
    await perimeterRecording.resumeRecording()
  } else {
    await anchorRecording.resumeRecording()
  }
}

async function handleStop() {
  showNameInput.value = true
}

// Anchor-specific handlers
async function handleMapClick(lat: number, lon: number) {
  try {
    await anchorRecording.addAnchor(lat, lon)
  } catch (err) {
    showError('Failed to add anchor')
    console.error(err)
  }
}

async function handleAnchorDrag(index: number, lat: number, lon: number) {
  try {
    await anchorRecording.updateAnchor(index, lat, lon)
  } catch (err) {
    showError('Failed to update anchor')
    console.error(err)
  }
}

async function handleAnchorDelete(index: number) {
  try {
    await anchorRecording.removeAnchor(index)
  } catch (err) {
    showError('Failed to remove anchor')
    console.error(err)
  }
}

async function handleSave() {
  if (!zoneName.value.trim()) {
    showError('Please enter a zone name')
    return
  }

  try {
    const result = recordingMode.value === 'perimeter'
      ? await perimeterRecording.stopRecording()
      : await anchorRecording.stopRecording()

    if (!result) {
      showError('Failed to complete recording')
      return
    }

    // Create zone from recording result
    const zone = {
      id: `zone_${Date.now()}`,
      name: zoneName.value.trim(),
      type: 'mowing' as const,
      description: `Created via ${recordingMode.value === 'perimeter' ? 'perimeter' : 'anchor'} recording`,
      coordinates: result.zonePreview.geometry.coordinates[0].map(
        (coord: number[]) => [coord[1], coord[0]]  // GeoJSON is [lon, lat], we need [lat, lon]
      ),
      area: result.area,
      color: '#2C5F2D',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }

    await zonesStore.addZone(zone)
    success(`Zone "${zone.name}" created successfully`)
    isOpen.value = false
    resetForm()
  } catch (err) {
    showError('Failed to save zone')
    console.error(err)
  }
}

async function handleCancel() {
  const hasData = (recordingMode.value === 'perimeter' && waypoints.value.length > 0) ||
                  (recordingMode.value === 'anchor' && anchors.value.length > 0)

  if (isRecording.value && hasData) {
    const confirmed = await dialog.confirm(
      'Discard recording?',
      'Cancel Recording'
    )
    if (!confirmed) return
  }

  if (recordingMode.value === 'perimeter') {
    await perimeterRecording.cancelRecording()
  } else {
    await anchorRecording.cancelRecording()
  }

  isOpen.value = false
  resetForm()
}

function resetForm() {
  zoneName.value = ''
  showNameInput.value = false
  recordingMode.value = 'perimeter'
}
</script>

<template>
  <div v-if="isOpen" class="recording-modal">
    <div class="modal-overlay" @click="handleCancel"></div>

    <div class="modal-content">
      <!-- Header -->
      <div class="modal-header">
        <h2>Record Zone Boundary</h2>
        <button class="btn-close" @click="handleCancel">✕</button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Mode selector (before recording) -->
        <div v-if="!isRecording && !showNameInput" class="mode-selector">
          <button
            :class="['mode-btn', { active: recordingMode === 'perimeter' }]"
            @click="recordingMode = 'perimeter'"
          >
            <div class="mode-icon">🚶</div>
            <div class="mode-label">Walk the Edge</div>
            <div class="mode-desc">Drive around the perimeter</div>
          </button>
          <button
            :class="['mode-btn', { active: recordingMode === 'anchor' }]"
            @click="recordingMode = 'anchor'"
          >
            <div class="mode-icon">📍</div>
            <div class="mode-label">Mark the Corners</div>
            <div class="mode-desc">Click to place anchor points</div>
          </button>
        </div>

        <!-- Instructions (before recording) -->
        <div v-if="!isRecording && !showNameInput" class="instructions">
          <div v-if="recordingMode === 'perimeter'">
            <h3>📍 Walk the Edge</h3>
            <p>Drive or guide the rover around the perimeter of your zone.</p>
            <ul>
              <li>Stay close to the boundary edge</li>
              <li>Drive at a steady pace</li>
              <li>Return to your starting point to complete</li>
            </ul>
          </div>
          <div v-else>
            <h3>📍 Mark the Corners</h3>
            <p>Click on the map to place anchor points at each corner.</p>
            <ul>
              <li>Minimum 3 corners required</li>
              <li>Drag markers to adjust position</li>
              <li>Auto-squaring for near-90° angles</li>
            </ul>
          </div>
          <button class="btn btn-primary btn-large" @click="handleStart">
            🟢 Start Recording
          </button>
        </div>

        <!-- Recording in progress -->
        <div v-else-if="isRecording" class="recording-active">
          <!-- Perimeter mode -->
          <template v-if="recordingMode === 'perimeter'">
            <RecordingMap
              :waypoints="waypoints"
              :is-recording="!isPaused"
            />

            <RecordingStats
              :waypoint-count="waypoints.length"
              :area="estimatedArea"
              :perimeter="estimatedPerimeter"
            />
          </template>

          <!-- Anchor mode -->
          <template v-else>
            <AnchorRecordingMode
              :anchors="anchors"
              :is-recording="!isPaused"
              @map-click="handleMapClick"
              @anchor-drag="handleAnchorDrag"
              @anchor-delete="handleAnchorDelete"
            />

            <AnchorStats
              :anchor-count="anchors.length"
              :area="estimatedArea"
              :perimeter="estimatedPerimeter"
              :shape-type="anchorRecording.shapeType.value"
            />
          </template>

          <RecordingControls
            :is-recording="isRecording"
            :is-paused="isPaused"
            @pause="handlePause"
            @resume="handleResume"
            @stop="handleStop"
          />
        </div>

        <!-- Name input (after recording) -->
        <div v-else-if="showNameInput" class="name-input">
          <h3>Name Your Zone</h3>
          <p v-if="recordingMode === 'perimeter'">
            Recording complete! {{ waypoints.length }} points recorded.
          </p>
          <p v-else>
            Recording complete! {{ anchors.length }} anchors marked.
          </p>

          <RecordingMap
            v-if="recordingMode === 'perimeter'"
            :waypoints="waypoints"
            :is-recording="false"
            :show-preview="true"
          />
          <AnchorRecordingMode
            v-else
            :anchors="anchors"
            :is-recording="false"
          />

          <div class="form-group">
            <label for="zoneName">Zone Name</label>
            <input
              id="zoneName"
              v-model="zoneName"
              type="text"
              class="form-input"
              placeholder="e.g., Front Lawn"
              autofocus
            />
          </div>

          <div class="actions">
            <button class="btn btn-secondary" @click="handleCancel">
              Cancel
            </button>
            <button class="btn btn-primary" @click="handleSave">
              Save Zone
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.recording-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);

  h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    color: var(--text-primary);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 4px 8px;

    &:hover {
      color: var(--text-primary);
    }
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

.mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);

  .mode-btn {
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;

    &:hover {
      border-color: var(--primary-green);
      background: var(--bg-primary);
    }

    &.active {
      border-color: var(--primary-green);
      background: var(--primary-green);
      color: white;

      .mode-desc {
        color: rgba(255, 255, 255, 0.8);
      }
    }

    .mode-icon {
      font-size: 32px;
      margin-bottom: var(--spacing-sm);
    }

    .mode-label {
      font-size: var(--font-size-lg);
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
    }

    .mode-desc {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }
}

.instructions {
  text-align: center;
  padding: var(--spacing-xl);

  h3 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
  }

  p {
    font-size: var(--font-size-md);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  ul {
    text-align: left;
    max-width: 400px;
    margin: 0 auto var(--spacing-xl) auto;
    color: var(--text-secondary);
  }

  .btn-large {
    font-size: var(--font-size-lg);
    padding: var(--spacing-md) var(--spacing-xl);
  }
}

.recording-active {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.name-input {
  h3 {
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  .form-group {
    margin: var(--spacing-lg) 0;

    label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 500;
      margin-bottom: var(--spacing-xs);
      color: var(--text-secondary);
    }
  }

  .form-input {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--font-size-md);

    &:focus {
      outline: 2px solid var(--primary-green);
      outline-offset: 0;
    }
  }

  .actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
    margin-top: var(--spacing-lg);
  }
}
</style>
