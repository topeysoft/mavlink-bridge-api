<template>
  <div class="waypoint-list">
    <div class="q-pa-md">
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-subtitle1">Waypoints</div>
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            dense
            icon="add"
            @click="addWaypoint"
          >
            <q-tooltip>Add waypoint</q-tooltip>
          </q-btn>
        </div>
      </div>

      <q-list separator v-if="waypoints.length > 0">
        <draggable
          v-model="waypointsCopy"
          item-key="id"
          @end="handleReorder"
        >
          <template #item="{ element: waypoint, index }">
            <q-item
              clickable
              :active="index === selectedIndex"
              @click="$emit('select', index)"
              class="waypoint-item"
            >
              <q-item-section avatar>
                <q-avatar
                  :color="getWaypointColor(waypoint.type)"
                  text-color="white"
                  size="sm"
                >
                  {{ index + 1 }}
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  {{ getWaypointTypeLabel(waypoint.type) }}
                </q-item-label>
                <q-item-label caption>
                  {{ formatCoordinates(waypoint) }}
                </q-item-label>
                <q-item-label caption>
                  Alt: {{ waypoint.alt }}m
                  <span v-if="waypoint.speed">
                    • Speed: {{ waypoint.speed }}m/s
                  </span>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <div class="q-gutter-xs">
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="edit"
                    @click.stop="editWaypoint(index)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="delete"
                    @click.stop="$emit('delete', index)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </draggable>
      </q-list>

      <div v-else class="text-center text-grey-6 q-py-xl">
        <q-icon name="mdi-map-marker-off" size="48px" />
        <div class="q-mt-md">No waypoints</div>
        <div class="text-caption">Click on the map to add waypoints</div>
      </div>
    </div>

    <!-- Waypoint Editor Dialog -->
    <q-dialog v-model="showEditDialog">
      <WaypointEditor
        v-if="editingWaypoint"
        :waypoint="editingWaypoint"
        @save="saveWaypoint"
        @cancel="showEditDialog = false"
      />
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import draggable from 'vuedraggable'
import WaypointEditor from './WaypointEditor.vue'
import type { Waypoint } from '../../stores/mission'

const props = defineProps<{
  waypoints: Waypoint[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [index: number]
  update: [index: number, waypoint: Waypoint]
  delete: [index: number]
  reorder: [from: number, to: number]
}>()

const showEditDialog = ref(false)
const editingWaypoint = ref<Waypoint>()
const editingIndex = ref(-1)

const waypointsCopy = computed({
  get: () => props.waypoints.map((wp, index) => ({ ...wp, id: index })),
  set: () => {
    // Handle reordering through draggable
  }
})

function getWaypointColor(type: string): string {
  const colors: Record<string, string> = {
    takeoff: 'positive',
    waypoint: 'primary',
    loiter: 'warning',
    land: 'negative'
  }
  return colors[type] || 'grey'
}

function getWaypointTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    takeoff: 'Takeoff',
    waypoint: 'Waypoint',
    loiter: 'Loiter',
    land: 'Landing'
  }
  return labels[type] || 'Unknown'
}

function formatCoordinates(waypoint: Waypoint): string {
  return `${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}`
}

function addWaypoint() {
  // Emit event to add waypoint at map center or last position
  const newWaypoint: Waypoint = {
    lat: 40.7128, // Default center
    lng: -74.0060,
    alt: 10,
    type: 'waypoint'
  }
  emit('update', -1, newWaypoint)
}

function editWaypoint(index: number) {
  const waypoint = props.waypoints[index]
  if (waypoint) {
    editingWaypoint.value = { ...waypoint }
    editingIndex.value = index
    showEditDialog.value = true
  }
}

function saveWaypoint(waypoint: Waypoint) {
  if (editingIndex.value >= 0) {
    emit('update', editingIndex.value, waypoint)
  }
  showEditDialog.value = false
}

function handleReorder(event: { oldIndex: number; newIndex: number }) {
  if (event.oldIndex !== event.newIndex) {
    emit('reorder', event.oldIndex, event.newIndex)
  }
}
</script>

<style lang="scss" scoped>
.waypoint-list {
  height: 100%;
  overflow-y: auto;
}

.waypoint-item {
  &.q-item--active {
    background: rgba(25, 118, 210, 0.1);
  }
}
</style>