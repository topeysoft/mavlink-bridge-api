<template>
  <q-dialog
    v-model="showDialog"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="zone-create-dialog">
      <q-card-section class="zone-create-dialog__header">
        <div class="zone-create-dialog__title-section">
          <q-icon name="add_location" size="32px" color="primary" class="q-mr-md" />
          <div>
            <div class="text-h5">
              {{ isEditing ? 'Edit Zone' : 'Create New Zone' }}
            </div>
            <div class="text-subtitle2 text-grey-6">
              {{
                isEditing
                  ? 'Modify zone settings and boundaries'
                  : 'Define a new mowing zone with custom settings'
              }}
            </div>
          </div>
        </div>

        <q-btn flat round icon="close" @click="closeDialog" />
      </q-card-section>

      <q-separator />

      <q-card-section class="zone-create-dialog__content">
        <div class="zone-create-dialog__form">
          <q-stepper
            ref="stepper"
            v-model="currentStep"
            color="primary"
            animated
            flat
            bordered
            class="zone-create-dialog__stepper"
          >
            <!-- Step 1: Basic Information -->
            <q-step
              :name="1"
              title="Basic Information"
              icon="info"
              :done="currentStep > 1"
              class="zone-create-dialog__step"
            >
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Zone Details</div>

                      <q-input
                        v-model="zoneData.name"
                        label="Zone Name *"
                        outlined
                        class="q-mb-md"
                        :rules="[val => !!val || 'Zone name is required']"
                      />

                      <q-input
                        v-model="zoneData.description"
                        label="Description"
                        type="textarea"
                        rows="3"
                        outlined
                        class="q-mb-md"
                      />

                      <q-select
                        v-model="zoneData.type"
                        :options="zoneTypeOptions"
                        label="Zone Type *"
                        outlined
                        class="q-mb-md"
                        :rules="[val => !!val || 'Zone type is required']"
                      />

                      <q-select
                        v-model="zoneData.priority"
                        :options="priorityOptions"
                        label="Priority"
                        outlined
                        class="q-mb-md"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Zone Properties</div>

                      <q-input
                        v-model.number="zoneData.area"
                        label="Estimated Area"
                        type="number"
                        suffix="m²"
                        outlined
                        class="q-mb-md"
                        readonly
                        hint="Will be calculated from boundaries"
                      />

                      <q-toggle v-model="zoneData.active" label="Active Zone" class="q-mb-md" />

                      <q-toggle
                        v-model="zoneData.autoSchedule"
                        label="Auto Schedule"
                        class="q-mb-md"
                      />

                      <q-color v-model="zoneData.color" class="zone-create-dialog__color-picker" />

                      <div class="text-caption text-grey-6 q-mt-sm">
                        Choose a color for map visualization
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <q-stepper-navigation class="q-mt-lg">
                <q-btn :disable="!isStep1Valid" color="primary" label="Next" @click="nextStep" />
              </q-stepper-navigation>
            </q-step>

            <!-- Step 2: Zone Boundaries -->
            <q-step
              :name="2"
              title="Define Boundaries"
              icon="edit_location"
              :done="currentStep > 2"
              class="zone-create-dialog__step"
            >
              <div class="row q-col-gutter-md">
                <div class="col-12 col-lg-8">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Interactive Map</div>

                      <div class="zone-create-dialog__map-container">
                        <div ref="mapContainer" class="zone-create-dialog__map">
                          <!-- Map placeholder - in real app this would be Google Maps/Leaflet -->
                          <div class="zone-create-dialog__map-placeholder">
                            <q-icon name="map" size="64px" color="grey-5" />
                            <div class="text-body1 text-grey-6 q-mt-md">Interactive Map View</div>
                            <div class="text-caption text-grey-5">Click to add boundary points</div>
                          </div>
                        </div>
                      </div>

                      <div class="zone-create-dialog__map-controls q-mt-md">
                        <q-btn-group>
                          <q-btn
                            :color="drawingMode === 'polygon' ? 'primary' : 'grey'"
                            icon="polyline"
                            label="Draw Polygon"
                            @click="setDrawingMode('polygon')"
                          />
                          <q-btn
                            :color="drawingMode === 'rectangle' ? 'primary' : 'grey'"
                            icon="crop_square"
                            label="Rectangle"
                            @click="setDrawingMode('rectangle')"
                          />
                          <q-btn
                            :color="drawingMode === 'circle' ? 'primary' : 'grey'"
                            icon="radio_button_unchecked"
                            label="Circle"
                            @click="setDrawingMode('circle')"
                          />
                        </q-btn-group>

                        <q-space />

                        <q-btn flat icon="clear" label="Clear" @click="clearBoundaries" />

                        <q-btn
                          :disable="zoneData.boundaries.length === 0"
                          flat
                          icon="undo"
                          label="Undo"
                          @click="undoLastPoint"
                        />
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-lg-4">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Boundary Points</div>

                      <div
                        v-if="zoneData.boundaries.length === 0"
                        class="text-center text-grey-5 q-py-lg"
                      >
                        <q-icon name="location_off" size="48px" />
                        <div class="q-mt-md">No boundaries defined</div>
                        <div class="text-caption">Click on the map to start</div>
                      </div>

                      <q-list v-else dense class="zone-create-dialog__boundary-list">
                        <q-item
                          v-for="(point, index) in zoneData.boundaries"
                          :key="index"
                          class="zone-create-dialog__boundary-item"
                        >
                          <q-item-section avatar>
                            <q-avatar size="24px" color="primary" text-color="white">
                              {{ index + 1 }}
                            </q-avatar>
                          </q-item-section>

                          <q-item-section>
                            <q-item-label class="text-caption">
                              {{ point.lat.toFixed(6) }}, {{ point.lng.toFixed(6) }}
                            </q-item-label>
                          </q-item-section>

                          <q-item-section side>
                            <q-btn
                              flat
                              round
                              dense
                              icon="delete"
                              size="sm"
                              @click="removeBoundaryPoint(index)"
                            />
                          </q-item-section>
                        </q-item>
                      </q-list>

                      <q-separator v-if="zoneData.boundaries.length > 0" class="q-my-md" />

                      <div v-if="calculatedArea > 0" class="zone-create-dialog__area-info">
                        <q-icon name="square_foot" color="primary" class="q-mr-sm" />
                        <span class="text-body2"> Area: {{ calculatedArea.toFixed(1) }} m² </span>
                      </div>
                    </q-card-section>
                  </q-card>

                  <q-card flat bordered class="q-mt-md">
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Quick Actions</div>

                      <q-btn
                        flat
                        icon="my_location"
                        label="Use Current Location"
                        class="full-width q-mb-sm"
                        @click="useCurrentLocation"
                      />

                      <q-btn
                        flat
                        icon="file_upload"
                        label="Import from File"
                        class="full-width q-mb-sm"
                        @click="importBoundaries"
                      />

                      <q-btn
                        flat
                        icon="content_copy"
                        label="Copy from Zone"
                        class="full-width"
                        @click="copyFromZone"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <q-stepper-navigation class="q-mt-lg">
                <q-btn flat color="primary" label="Back" @click="previousStep" />
                <q-btn :disable="!isStep2Valid" color="primary" label="Next" @click="nextStep" />
              </q-stepper-navigation>
            </q-step>

            <!-- Step 3: Mowing Settings -->
            <q-step
              :name="3"
              title="Mowing Settings"
              icon="grass"
              :done="currentStep > 3"
              class="zone-create-dialog__step"
            >
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Cutting Parameters</div>

                      <q-input
                        v-model.number="zoneData.mowingSettings.cuttingHeight"
                        label="Cutting Height"
                        type="number"
                        suffix="mm"
                        outlined
                        class="q-mb-md"
                        :min="20"
                        :max="80"
                      />

                      <q-select
                        v-model="zoneData.mowingSettings.pattern"
                        :options="mowingPatternOptions"
                        label="Mowing Pattern"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="zoneData.mowingSettings.speed"
                        label="Mowing Speed"
                        type="number"
                        suffix="m/min"
                        outlined
                        class="q-mb-md"
                        :min="5"
                        :max="25"
                      />

                      <q-input
                        v-model.number="zoneData.mowingSettings.overlap"
                        label="Path Overlap"
                        type="number"
                        suffix="%"
                        outlined
                        :min="10"
                        :max="50"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Schedule Settings</div>

                      <q-select
                        v-model="zoneData.mowingSettings.frequency"
                        :options="frequencyOptions"
                        label="Mowing Frequency"
                        outlined
                        class="q-mb-md"
                      />

                      <q-input
                        v-model="zoneData.mowingSettings.preferredTime"
                        label="Preferred Start Time"
                        type="time"
                        outlined
                        class="q-mb-md"
                        :disable="!zoneData.autoSchedule"
                      />

                      <q-select
                        v-model="zoneData.mowingSettings.workingDays"
                        :options="dayOptions"
                        multiple
                        label="Working Days"
                        outlined
                        class="q-mb-md"
                        :disable="!zoneData.autoSchedule"
                      />

                      <q-toggle
                        v-model="zoneData.mowingSettings.weatherDependent"
                        label="Weather Dependent"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="zoneData.mowingSettings.edgeTrimming"
                        label="Edge Trimming"
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <q-stepper-navigation class="q-mt-lg">
                <q-btn flat color="primary" label="Back" @click="previousStep" />
                <q-btn color="primary" label="Next" @click="nextStep" />
              </q-stepper-navigation>
            </q-step>

            <!-- Step 4: Advanced Settings -->
            <q-step
              :name="4"
              title="Advanced Settings"
              icon="tune"
              :done="currentStep > 4"
              class="zone-create-dialog__step"
            >
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Safety & Navigation</div>

                      <q-input
                        v-model.number="zoneData.advancedSettings.maxSlope"
                        label="Maximum Slope"
                        type="number"
                        suffix="degrees"
                        outlined
                        class="q-mb-md"
                        :min="0"
                        :max="45"
                      />

                      <q-toggle
                        v-model="zoneData.advancedSettings.obstacleAvoidance"
                        label="Enhanced Obstacle Avoidance"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="zoneData.advancedSettings.rainSensor"
                        label="Rain Sensor Active"
                        class="q-mb-md"
                      />

                      <q-toggle
                        v-model="zoneData.advancedSettings.antiTheft"
                        label="Anti-theft Protection"
                        class="q-mb-md"
                      />

                      <q-input
                        v-model.number="zoneData.advancedSettings.minGrassHeight"
                        label="Minimum Grass Height"
                        type="number"
                        suffix="mm"
                        outlined
                        :min="10"
                        :max="50"
                      />
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-md-6">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Zone Restrictions</div>

                      <q-select
                        v-model="zoneData.advancedSettings.accessibleMachines"
                        :options="machineOptions"
                        multiple
                        label="Accessible Machines"
                        outlined
                        class="q-mb-md"
                        hint="Leave empty for all machines"
                      />

                      <q-input
                        v-model="zoneData.advancedSettings.noiseLimit"
                        label="Noise Limit (Morning)"
                        type="time"
                        outlined
                        class="q-mb-md"
                        hint="No mowing before this time"
                      />

                      <q-input
                        v-model="zoneData.advancedSettings.quietHours"
                        label="Quiet Hours (Evening)"
                        type="time"
                        outlined
                        class="q-mb-md"
                        hint="No mowing after this time"
                      />

                      <q-toggle
                        v-model="zoneData.advancedSettings.seasonalAdjustment"
                        label="Seasonal Adjustment"
                        class="q-mb-md"
                      />

                      <q-select
                        v-model="zoneData.advancedSettings.grassType"
                        :options="grassTypeOptions"
                        label="Grass Type"
                        outlined
                      />
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <q-stepper-navigation class="q-mt-lg">
                <q-btn flat color="primary" label="Back" @click="previousStep" />
                <q-btn color="primary" label="Review" @click="nextStep" />
              </q-stepper-navigation>
            </q-step>

            <!-- Step 5: Review & Confirm -->
            <q-step
              :name="5"
              title="Review & Confirm"
              icon="check_circle"
              class="zone-create-dialog__step"
            >
              <div class="row q-col-gutter-md">
                <div class="col-12 col-lg-8">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Zone Summary</div>

                      <div class="zone-create-dialog__summary">
                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="label" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Name:</span>
                          <span class="q-ml-sm">{{ zoneData.name }}</span>
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="category" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Type:</span>
                          <span class="q-ml-sm">{{ zoneData.type?.label }}</span>
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="square_foot" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Area:</span>
                          <span class="q-ml-sm">{{ calculatedArea.toFixed(1) }} m²</span>
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="schedule" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Frequency:</span>
                          <span class="q-ml-sm">{{
                            zoneData.mowingSettings.frequency?.label
                          }}</span>
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="content_cut" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Cutting Height:</span>
                          <span class="q-ml-sm"
                            >{{ zoneData.mowingSettings.cuttingHeight }} mm</span
                          >
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="pattern" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Pattern:</span>
                          <span class="q-ml-sm">{{ zoneData.mowingSettings.pattern?.label }}</span>
                        </div>

                        <div class="zone-create-dialog__summary-item">
                          <q-icon name="palette" color="primary" class="q-mr-sm" />
                          <span class="text-weight-medium">Color:</span>
                          <q-badge :style="{ backgroundColor: zoneData.color }" class="q-ml-sm">
                            {{ zoneData.color }}
                          </q-badge>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <div class="col-12 col-lg-4">
                  <q-card flat bordered>
                    <q-card-section>
                      <div class="text-h6 q-mb-md">Preview</div>

                      <div class="zone-create-dialog__preview">
                        <!-- Zone preview would show map with zone highlighted -->
                        <div class="zone-create-dialog__preview-map">
                          <q-icon name="map" size="48px" color="grey-5" />
                          <div class="text-caption text-grey-6 q-mt-sm">Zone Preview</div>
                        </div>
                      </div>

                      <q-separator class="q-my-md" />

                      <div class="text-body2 text-grey-6">
                        <q-icon name="info" class="q-mr-sm" />
                        Review all settings before creating the zone. You can edit these settings
                        later if needed.
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <q-stepper-navigation class="q-mt-lg">
                <q-btn flat color="primary" label="Back" @click="previousStep" />
                <q-btn
                  color="primary"
                  :label="isEditing ? 'Update Zone' : 'Create Zone'"
                  :loading="saving"
                  @click="saveZone"
                />
              </q-stepper-navigation>
            </q-step>
          </q-stepper>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/* eslint-env browser */
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'

// Types
interface BoundaryPoint {
  lat: number
  lng: number
}

interface MowingSettings {
  cuttingHeight: number
  pattern: { label: string; value: string } | null
  speed: number
  overlap: number
  frequency: { label: string; value: string } | null
  preferredTime: string
  workingDays: string[]
  weatherDependent: boolean
  edgeTrimming: boolean
}

interface AdvancedSettings {
  maxSlope: number
  obstacleAvoidance: boolean
  rainSensor: boolean
  antiTheft: boolean
  minGrassHeight: number
  accessibleMachines: string[]
  noiseLimit: string
  quietHours: string
  seasonalAdjustment: boolean
  grassType: { label: string; value: string } | null
}

interface ZoneData {
  id?: string
  name: string
  description: string
  type: { label: string; value: string } | null
  priority: { label: string; value: string } | null
  area: number
  active: boolean
  autoSchedule: boolean
  color: string
  boundaries: BoundaryPoint[]
  mowingSettings: MowingSettings
  advancedSettings: AdvancedSettings
}

// Props
const props = defineProps<{
  modelValue: boolean
  zone?: ZoneData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [zone: ZoneData]
}>()

// Composables
const $q = useQuasar()

// Local state
const currentStep = ref(1)
const saving = ref(false)
const drawingMode = ref<'polygon' | 'rectangle' | 'circle'>('polygon')
const mapContainer = ref()
const stepper = ref()

// Default zone data
const defaultZoneData: ZoneData = {
  name: '',
  description: '',
  type: null,
  priority: { label: 'Normal', value: 'normal' },
  area: 0,
  active: true,
  autoSchedule: true,
  color: '#4CAF50',
  boundaries: [],
  mowingSettings: {
    cuttingHeight: 30,
    pattern: { label: 'Parallel Lines', value: 'parallel' },
    speed: 15,
    overlap: 20,
    frequency: { label: 'Every 2 days', value: 'every_2_days' },
    preferredTime: '08:00',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    weatherDependent: true,
    edgeTrimming: true
  },
  advancedSettings: {
    maxSlope: 20,
    obstacleAvoidance: true,
    rainSensor: true,
    antiTheft: true,
    minGrassHeight: 15,
    accessibleMachines: [],
    noiseLimit: '08:00',
    quietHours: '20:00',
    seasonalAdjustment: true,
    grassType: { label: 'Mixed Grass', value: 'mixed' }
  }
}

const zoneData = ref<ZoneData>({ ...defaultZoneData })

// Options
const zoneTypeOptions = [
  { label: 'Main Lawn', value: 'main' },
  { label: 'Front Yard', value: 'front' },
  { label: 'Back Yard', value: 'back' },
  { label: 'Side Area', value: 'side' },
  { label: 'Garden Border', value: 'border' },
  { label: 'Flower Bed Edge', value: 'flower_edge' },
  { label: 'Custom Area', value: 'custom' }
]

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' }
]

const mowingPatternOptions = [
  { label: 'Parallel Lines', value: 'parallel' },
  { label: 'Random', value: 'random' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Checkerboard', value: 'checkerboard' },
  { label: 'Border First', value: 'border_first' }
]

const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Every 2 days', value: 'every_2_days' },
  { label: 'Every 3 days', value: 'every_3_days' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'bi_weekly' },
  { label: 'Custom', value: 'custom' }
]

const dayOptions = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' }
]

const machineOptions = [
  { label: 'YardRover Pro', value: 'yardrover_pro' },
  { label: 'YardRover Standard', value: 'yardrover_std' },
  { label: 'YardRover Compact', value: 'yardrover_compact' }
]

const grassTypeOptions = [
  { label: 'Bermuda Grass', value: 'bermuda' },
  { label: 'Kentucky Bluegrass', value: 'kentucky_blue' },
  { label: 'Zoysia', value: 'zoysia' },
  { label: 'St. Augustine', value: 'st_augustine' },
  { label: 'Mixed Grass', value: 'mixed' },
  { label: 'Other', value: 'other' }
]

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const isEditing = computed(() => !!props.zone?.id)

const isStep1Valid = computed(() => {
  return !!(zoneData.value.name && zoneData.value.type)
})

const isStep2Valid = computed(() => {
  return zoneData.value.boundaries.length >= 3
})

const calculatedArea = computed(() => {
  if (zoneData.value.boundaries.length < 3) return 0

  // Simple polygon area calculation (this would be more sophisticated in real app)
  let area = 0
  const points = zoneData.value.boundaries

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].lat * points[j].lng
    area -= points[j].lat * points[i].lng
  }

  return Math.abs(area / 2) * 111000 * 111000 // Rough conversion to m²
})

// Methods
const loadZoneData = () => {
  if (props.zone) {
    zoneData.value = { ...props.zone }
  } else {
    zoneData.value = { ...defaultZoneData }
  }
}

const nextStep = () => {
  if (currentStep.value < 5) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const setDrawingMode = (mode: 'polygon' | 'rectangle' | 'circle') => {
  drawingMode.value = mode
  // In real app, this would update the map drawing tools
}

const clearBoundaries = () => {
  zoneData.value.boundaries = []
  zoneData.value.area = 0
}

const undoLastPoint = () => {
  if (zoneData.value.boundaries.length > 0) {
    zoneData.value.boundaries.pop()
  }
}

const removeBoundaryPoint = (index: number) => {
  zoneData.value.boundaries.splice(index, 1)
}

const useCurrentLocation = () => {
  $q.notify({
    type: 'info',
    message: 'Current location feature would be implemented here'
  })
}

const importBoundaries = () => {
  $q.notify({
    type: 'info',
    message: 'File import feature would be implemented here'
  })
}

const copyFromZone = () => {
  $q.notify({
    type: 'info',
    message: 'Copy from existing zone feature would be implemented here'
  })
}

const saveZone = async () => {
  saving.value = true

  try {
    // Update calculated area
    zoneData.value.area = calculatedArea.value

    emit('save', { ...zoneData.value })

    $q.notify({
      type: 'positive',
      message: isEditing.value ? 'Zone updated successfully' : 'Zone created successfully'
    })

    closeDialog()
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Failed to save zone'
    })
  } finally {
    saving.value = false
  }
}

const closeDialog = () => {
  showDialog.value = false
  currentStep.value = 1
  // Reset form data when closing
  // Use nextTick instead of setTimeout for better reactivity
  loadZoneData()
}

// Watchers
watch(
  () => props.zone,
  () => {
    loadZoneData()
  }
)

watch(
  () => props.modelValue,
  newValue => {
    if (newValue) {
      loadZoneData()
    }
  }
)

watch(calculatedArea, newArea => {
  zoneData.value.area = newArea
})

// Lifecycle
onMounted(() => {
  loadZoneData()
})
</script>

<style lang="scss" scoped>
.zone-create-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.zone-create-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: var(--q-grey-1);
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-bottom-color: var(--q-grey-7);
  }
}

.zone-create-dialog__title-section {
  display: flex;
  align-items: center;
}

.zone-create-dialog__content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.zone-create-dialog__form {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.zone-create-dialog__stepper {
  flex: 1;

  :deep(.q-stepper__content) {
    overflow-y: auto;
  }
}

.zone-create-dialog__step {
  padding: 24px;
}

.zone-create-dialog__color-picker {
  width: 100%;
  max-width: 200px;
}

.zone-create-dialog__map-container {
  position: relative;
  width: 100%;
  height: 400px;
  border: 2px dashed var(--q-grey-4);
  border-radius: 8px;
  overflow: hidden;
}

.zone-create-dialog__map {
  width: 100%;
  height: 100%;
  background: var(--q-grey-2);

  .body--dark & {
    background: var(--q-grey-8);
  }
}

.zone-create-dialog__map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.zone-create-dialog__map-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zone-create-dialog__boundary-list {
  max-height: 300px;
  overflow-y: auto;
}

.zone-create-dialog__boundary-item {
  border-radius: 4px;
  margin-bottom: 4px;

  &:hover {
    background: var(--q-grey-2);

    .body--dark & {
      background: var(--q-grey-8);
    }
  }
}

.zone-create-dialog__area-info {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--q-primary-1);
  border-radius: 4px;

  .body--dark & {
    background: var(--q-primary-9);
  }
}

.zone-create-dialog__summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-create-dialog__summary-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    border-bottom-color: var(--q-grey-7);
  }

  &:last-child {
    border-bottom: none;
  }
}

.zone-create-dialog__preview {
  width: 100%;
  height: 200px;
  border: 1px solid var(--q-grey-4);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--q-grey-2);

  .body--dark & {
    background: var(--q-grey-8);
    border-color: var(--q-grey-6);
  }
}

.zone-create-dialog__preview-map {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .zone-create-dialog__header {
    padding: 16px;
  }

  .zone-create-dialog__step {
    padding: 16px;
  }

  .zone-create-dialog__map-container {
    height: 300px;
  }
}

@media (max-width: 599px) {
  .zone-create-dialog__header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .zone-create-dialog__title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .zone-create-dialog__map-controls {
    flex-direction: column;
    align-items: stretch;

    .q-btn-group {
      align-self: center;
    }
  }
}
</style>
