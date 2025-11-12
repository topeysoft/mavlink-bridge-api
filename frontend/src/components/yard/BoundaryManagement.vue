<template>
  <div class="boundary-management">
    <!-- Header Controls -->
    <div class="boundary-management__header">
      <div class="boundary-management__search">
        <q-input v-model="searchQuery" placeholder="Search boundaries..." outlined dense clearable>
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <div class="boundary-management__filters">
        <q-select
          v-model="typeFilter"
          :options="boundaryTypeOptions"
          label="Type"
          outlined
          dense
          style="min-width: 120px"
        />

        <q-select
          v-model="statusFilter"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          style="min-width: 100px"
        />
      </div>

      <div class="boundary-management__actions">
        <q-btn
          color="primary"
          icon="add"
          label="Create Boundary"
          @click="$emit('boundary-create', {})"
        />
      </div>
    </div>

    <!-- Boundary List -->
    <div class="boundary-management__list">
      <q-list separator>
        <q-item
          v-for="boundary in filteredBoundaries"
          :key="boundary.id"
          class="boundary-management__item"
        >
          <q-item-section avatar>
            <q-avatar
              :style="{ backgroundColor: boundary.color }"
              text-color="white"
              :icon="getBoundaryTypeIcon(boundary.type)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="boundary-management__boundary-name">
              {{ boundary.name }}
            </q-item-label>

            <q-item-label caption>
              Type: {{ formatBoundaryType(boundary.type) }} • Length: {{ boundary.length }}m •
              Height: {{ boundary.height }}m
            </q-item-label>

            <q-item-label caption>
              Wire: {{ boundary.wireType }} • Signal: {{ boundary.signalStrength }}% • Voltage:
              {{ boundary.voltage }}V
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="boundary-management__boundary-status">
              <q-chip
                :color="getBoundaryStatusColor(boundary.status)"
                text-color="white"
                :label="formatBoundaryStatus(boundary.status)"
                size="sm"
              />
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="boundary-management__boundary-controls">
              <q-btn
                :icon="boundary.enabled ? 'pause' : 'play_arrow'"
                :color="boundary.enabled ? 'warning' : 'positive'"
                size="sm"
                round
                dense
                @click="$emit('boundary-toggle', boundary)"
              >
                <q-tooltip>
                  {{ boundary.enabled ? 'Disable Boundary' : 'Enable Boundary' }}
                </q-tooltip>
              </q-btn>

              <q-btn icon="more_vert" size="sm" round dense flat>
                <q-menu>
                  <q-list>
                    <q-item v-close-popup clickable @click="$emit('boundary-edit', boundary)">
                      <q-item-section avatar>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>Edit Boundary</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="testBoundary(boundary)">
                      <q-item-section avatar>
                        <q-icon name="electrical_services" />
                      </q-item-section>
                      <q-item-section>Test Signal</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="showBoundaryDetails(boundary)">
                      <q-item-section avatar>
                        <q-icon name="info" />
                      </q-item-section>
                      <q-item-section>Details</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="calibrateBoundary(boundary)">
                      <q-item-section avatar>
                        <q-icon name="tune" />
                      </q-item-section>
                      <q-item-section>Calibrate</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      v-close-popup
                      clickable
                      class="text-negative"
                      @click="$emit('boundary-delete', boundary)"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>Delete</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Empty State -->
      <div v-if="filteredBoundaries.length === 0" class="boundary-management__empty">
        <q-icon name="border_all" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{
            searchQuery || hasActiveFilters
              ? 'No boundaries match your filters'
              : 'No boundaries configured'
          }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-sm">
          {{
            searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Set up boundary wires to define your yard perimeter'
          }}
        </div>

        <q-btn
          v-if="!searchQuery && !hasActiveFilters"
          color="primary"
          label="Create First Boundary"
          class="q-mt-md"
          @click="$emit('boundary-create', {})"
        />
      </div>
    </div>

    <!-- Boundary Details Dialog -->
    <q-dialog v-model="showDetailsDialog" position="right">
      <q-card style="width: 400px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Boundary Details</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section v-if="selectedBoundaryDetails">
          <div class="boundary-management__details-content">
            <div class="boundary-management__detail-header">
              <q-avatar
                :style="{ backgroundColor: selectedBoundaryDetails.color }"
                text-color="white"
                :icon="getBoundaryTypeIcon(selectedBoundaryDetails.type)"
                size="48px"
              />
              <div class="boundary-management__detail-title">
                <div class="text-h6">{{ selectedBoundaryDetails.name }}</div>
                <div class="text-caption text-grey-6">
                  {{ formatBoundaryType(selectedBoundaryDetails.type) }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="boundary-management__detail-grid">
              <div class="boundary-management__detail-item">
                <div class="boundary-management__detail-label">Length</div>
                <div class="boundary-management__detail-value">
                  {{ selectedBoundaryDetails.length }}m
                </div>
              </div>

              <div class="boundary-management__detail-item">
                <div class="boundary-management__detail-label">Height</div>
                <div class="boundary-management__detail-value">
                  {{ selectedBoundaryDetails.height }}m
                </div>
              </div>

              <div class="boundary-management__detail-item">
                <div class="boundary-management__detail-label">Status</div>
                <q-chip
                  :color="getBoundaryStatusColor(selectedBoundaryDetails.status)"
                  text-color="white"
                  :label="formatBoundaryStatus(selectedBoundaryDetails.status)"
                  size="sm"
                />
              </div>

              <div class="boundary-management__detail-item">
                <div class="boundary-management__detail-label">Points</div>
                <div class="boundary-management__detail-value">
                  {{ selectedBoundaryDetails.coordinates.length }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="text-subtitle2 q-mb-sm">Wire Configuration</div>
            <div class="boundary-management__wire-grid">
              <div class="boundary-management__wire-item">
                <div class="boundary-management__wire-label">Wire Type</div>
                <div class="boundary-management__wire-value">
                  {{ selectedBoundaryDetails.wireType }}
                </div>
              </div>

              <div class="boundary-management__wire-item">
                <div class="boundary-management__wire-label">Signal Strength</div>
                <div class="boundary-management__wire-value">
                  <q-linear-progress
                    :value="selectedBoundaryDetails.signalStrength / 100"
                    color="positive"
                    size="md"
                    class="q-mr-sm"
                    style="width: 80px; display: inline-block"
                  />
                  {{ selectedBoundaryDetails.signalStrength }}%
                </div>
              </div>

              <div class="boundary-management__wire-item">
                <div class="boundary-management__wire-label">Voltage</div>
                <div class="boundary-management__wire-value">
                  {{ selectedBoundaryDetails.voltage }}V
                </div>
              </div>

              <div class="boundary-management__wire-item">
                <div class="boundary-management__wire-label">Frequency</div>
                <div class="boundary-management__wire-value">
                  {{ selectedBoundaryDetails.frequency }}Hz
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div class="boundary-management__timestamps">
              <div class="text-caption text-grey-6">
                Created: {{ formatDateTime(selectedBoundaryDetails.createdAt) }}
              </div>
              <div class="text-caption text-grey-6">
                Updated: {{ formatDateTime(selectedBoundaryDetails.updatedAt) }}
              </div>
              <div class="text-caption text-grey-6">
                Last Test: {{ formatDateTime(selectedBoundaryDetails.lastTest) }}
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Test Signal Dialog -->
    <q-dialog v-model="showTestDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Test Boundary Signal</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div v-if="testBoundaryItem" class="boundary-management__test-content">
            <div class="boundary-management__test-header">
              <q-avatar
                :style="{ backgroundColor: testBoundaryItem.color }"
                text-color="white"
                :icon="getBoundaryTypeIcon(testBoundaryItem.type)"
              />
              <div class="q-ml-md">
                <div class="text-subtitle1">{{ testBoundaryItem.name }}</div>
                <div class="text-caption text-grey-6">
                  {{ formatBoundaryType(testBoundaryItem.type) }}
                </div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <div v-if="testInProgress" class="boundary-management__test-progress">
              <q-circular-progress indeterminate size="50px" color="primary" class="q-mb-md" />
              <div class="text-body2">Testing boundary signal...</div>
              <div class="text-caption text-grey-6">This may take a few moments</div>
            </div>

            <div v-else-if="testResults" class="boundary-management__test-results">
              <div class="boundary-management__test-result" :class="`test-${testResults.overall}`">
                <q-icon
                  :name="
                    testResults.overall === 'success'
                      ? 'check_circle'
                      : testResults.overall === 'warning'
                        ? 'warning'
                        : 'error'
                  "
                  :color="
                    testResults.overall === 'success'
                      ? 'positive'
                      : testResults.overall === 'warning'
                        ? 'warning'
                        : 'negative'
                  "
                  size="24px"
                />
                <div class="q-ml-sm">
                  <div class="text-subtitle2">
                    {{
                      testResults.overall === 'success'
                        ? 'Signal OK'
                        : testResults.overall === 'warning'
                          ? 'Signal Weak'
                          : 'Signal Failed'
                    }}
                  </div>
                  <div class="text-caption text-grey-6">
                    {{ testResults.message }}
                  </div>
                </div>
              </div>

              <div class="boundary-management__test-metrics">
                <div class="boundary-management__test-metric">
                  <div class="boundary-management__test-metric-label">Signal Strength</div>
                  <div class="boundary-management__test-metric-value">
                    {{ testResults.signalStrength }}%
                  </div>
                </div>

                <div class="boundary-management__test-metric">
                  <div class="boundary-management__test-metric-label">Voltage</div>
                  <div class="boundary-management__test-metric-value">
                    {{ testResults.voltage }}V
                  </div>
                </div>

                <div class="boundary-management__test-metric">
                  <div class="boundary-management__test-metric-label">Continuity</div>
                  <div class="boundary-management__test-metric-value">
                    {{ testResults.continuity ? 'OK' : 'BROKEN' }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="boundary-management__test-ready">
              <div class="text-body2 text-center q-mb-md">Ready to test boundary signal</div>
              <div class="text-caption text-grey-6 text-center">
                This will check the wire continuity and signal strength
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" color="grey" />
          <q-btn
            v-if="!testInProgress && !testResults"
            label="Start Test"
            color="primary"
            @click="runBoundaryTest"
          />
          <q-btn v-if="testResults" label="Test Again" color="primary" @click="runBoundaryTest" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar, date } from 'quasar'

// Props
interface Boundary {
  id: string
  name: string
  type: 'perimeter' | 'guide' | 'exclusion'
  coordinates: Array<{ lat: number; lng: number }>
  length: number
  height: number
  enabled: boolean
  status: 'active' | 'inactive' | 'error'
  wireType: string
  signalStrength: number
  voltage: number
  frequency: number
  color: string
  createdAt: string
  updatedAt: string
  lastTest: string
}

interface TestResult {
  overall: 'success' | 'warning' | 'error'
  message: string
  signalStrength: number
  voltage: number
  continuity: boolean
}

const props = defineProps<{
  boundaries: Boundary[]
}>()

// Emits
const emit = defineEmits<{
  'boundary-create': [boundary: Partial<Boundary>]
  'boundary-edit': [boundary: Boundary]
  'boundary-delete': [boundary: Boundary]
  'boundary-toggle': [boundary: Boundary]
}>()

// Composables
const $q = useQuasar()

// Local state
const searchQuery = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const showDetailsDialog = ref(false)
const selectedBoundaryDetails = ref<Boundary | null>(null)
const showTestDialog = ref(false)
const testBoundaryItem = ref<Boundary | null>(null)
const testInProgress = ref(false)
const testResults = ref<TestResult | null>(null)

// Filter options
const boundaryTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Perimeter', value: 'perimeter' },
  { label: 'Guide Wire', value: 'guide' },
  { label: 'Exclusion', value: 'exclusion' }
]

const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Error', value: 'error' }
]

// Computed
const filteredBoundaries = computed(() => {
  let filtered = [...props.boundaries]

  // Apply type filter
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(boundary => boundary.type === typeFilter.value)
  }

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(boundary => boundary.status === statusFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      boundary =>
        boundary.name.toLowerCase().includes(query) || boundary.type.toLowerCase().includes(query)
    )
  }

  return filtered
})

const hasActiveFilters = computed(() => {
  return typeFilter.value !== 'all' || statusFilter.value !== 'all'
})

// Methods
const getBoundaryTypeIcon = (type: string) => {
  switch (type) {
    case 'perimeter':
      return 'border_all'
    case 'guide':
      return 'timeline'
    case 'exclusion':
      return 'block'
    default:
      return 'border_all'
  }
}

const formatBoundaryType = (type: string) => {
  switch (type) {
    case 'perimeter':
      return 'Perimeter'
    case 'guide':
      return 'Guide Wire'
    case 'exclusion':
      return 'Exclusion'
    default:
      return type
  }
}

const getBoundaryStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'positive'
    case 'inactive':
      return 'grey-5'
    case 'error':
      return 'negative'
    default:
      return 'grey-5'
  }
}

const formatBoundaryStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDateTime = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'MMM D, YYYY h:mm A')
}

const showBoundaryDetails = (boundary: Boundary) => {
  selectedBoundaryDetails.value = boundary
  showDetailsDialog.value = true
}

const testBoundary = (boundary: Boundary) => {
  testBoundaryItem.value = boundary
  testInProgress.value = false
  testResults.value = null
  showTestDialog.value = true
}

const runBoundaryTest = async () => {
  testInProgress.value = true
  testResults.value = null

  // Simulate test duration
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Simulate test results
  const mockResults: TestResult = {
    overall: Math.random() > 0.7 ? 'success' : Math.random() > 0.5 ? 'warning' : 'error',
    message: '',
    signalStrength: Math.floor(Math.random() * 40) + 60,
    voltage: Math.floor(Math.random() * 2) + 11,
    continuity: Math.random() > 0.2
  }

  if (mockResults.overall === 'success') {
    mockResults.message = 'All boundary systems functioning normally'
  } else if (mockResults.overall === 'warning') {
    mockResults.message = 'Signal detected but may need attention'
  } else {
    mockResults.message = 'Signal issues detected - check wire connections'
  }

  testInProgress.value = false
  testResults.value = mockResults

  $q.notify({
    type:
      mockResults.overall === 'success'
        ? 'positive'
        : mockResults.overall === 'warning'
          ? 'warning'
          : 'negative',
    message: `Boundary test ${
      mockResults.overall === 'success'
        ? 'passed'
        : mockResults.overall === 'warning'
          ? 'completed with warnings'
          : 'failed'
    }`
  })
}

const calibrateBoundary = (boundary: Boundary) => {
  $q.notify({
    type: 'info',
    message: `Starting calibration for ${boundary.name}`,
    timeout: 2000
  })
}
</script>

<style lang="scss" scoped>
.boundary-management {
  min-height: 400px;
}

.boundary-management__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--q-grey-1);
  border-bottom: 1px solid var(--q-grey-3);

  .body--dark & {
    background: var(--q-grey-9);
    border-bottom-color: var(--q-grey-7);
  }
}

.boundary-management__search {
  flex: 1;
  max-width: 300px;
}

.boundary-management__filters {
  display: flex;
  gap: 12px;
  margin: 0 16px;
}

.boundary-management__actions {
  flex-shrink: 0;
}

.boundary-management__list {
  background: white;
  min-height: 300px;

  .body--dark & {
    background: var(--q-dark);
  }
}

.boundary-management__item {
  padding: 16px 24px;
  border-bottom: 1px solid var(--q-grey-2);

  .body--dark & {
    border-bottom-color: var(--q-grey-8);
  }
}

.boundary-management__boundary-name {
  font-weight: 500;
  font-size: 1rem;
}

.boundary-management__boundary-status {
  margin-bottom: 8px;
}

.boundary-management__boundary-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.boundary-management__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.boundary-management__details-content {
  display: flex;
  flex-direction: column;
}

.boundary-management__detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.boundary-management__detail-title {
  flex: 1;
}

.boundary-management__detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.boundary-management__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.boundary-management__detail-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.boundary-management__detail-value {
  font-size: 0.9rem;
}

.boundary-management__wire-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.boundary-management__wire-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--q-grey-1);
  border-radius: 4px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.boundary-management__wire-label {
  font-weight: 500;
  color: var(--q-grey-7);
  font-size: 0.875rem;
}

.boundary-management__wire-value {
  font-size: 0.875rem;
  color: var(--q-dark);
  display: flex;
  align-items: center;

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.boundary-management__timestamps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.boundary-management__test-content {
  display: flex;
  flex-direction: column;
}

.boundary-management__test-header {
  display: flex;
  align-items: center;
}

.boundary-management__test-progress {
  text-align: center;
  padding: 24px;
}

.boundary-management__test-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.boundary-management__test-result {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;

  &.test-success {
    background: rgba(76, 175, 80, 0.1);
  }

  &.test-warning {
    background: rgba(255, 152, 0, 0.1);
  }

  &.test-error {
    background: rgba(244, 67, 54, 0.1);
  }
}

.boundary-management__test-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.boundary-management__test-metric {
  text-align: center;
  padding: 8px;
  border: 1px solid var(--q-grey-3);
  border-radius: 4px;

  .body--dark & {
    border-color: var(--q-grey-7);
  }
}

.boundary-management__test-metric-label {
  font-size: 0.75rem;
  color: var(--q-grey-7);
  margin-bottom: 4px;
}

.boundary-management__test-metric-value {
  font-weight: 500;
}

.boundary-management__test-ready {
  text-align: center;
  padding: 24px;
}

// Responsive adjustments
@media (max-width: 1023px) {
  .boundary-management__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .boundary-management__search {
    max-width: none;
  }

  .boundary-management__filters {
    margin: 0;
    justify-content: center;
  }
}

@media (max-width: 599px) {
  .boundary-management__header {
    padding: 12px 16px;
  }

  .boundary-management__item {
    padding: 12px 16px;
  }

  .boundary-management__filters {
    flex-direction: column;
    gap: 8px;
  }

  .boundary-management__detail-grid {
    grid-template-columns: 1fr;
  }

  .boundary-management__test-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
