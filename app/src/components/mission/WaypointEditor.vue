<template>
  <q-card style="min-width: 350px">
    <q-card-section>
      <div class="text-h6">Edit Waypoint</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-select
        v-model="editableWaypoint.type"
        :options="typeOptions"
        label="Waypoint Type"
        emit-value
        map-options
        class="q-mb-md"
      />

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-6">
          <q-input
            v-model.number="editableWaypoint.lat"
            label="Latitude"
            type="number"
            step="any"
          />
        </div>
        <div class="col-6">
          <q-input
            v-model.number="editableWaypoint.lng"
            label="Longitude"
            type="number"
            step="any"
          />
        </div>
      </div>

      <q-input
        v-model.number="editableWaypoint.alt"
        label="Altitude (m)"
        type="number"
        min="0"
        class="q-mb-md"
      />

      <q-input
        v-model.number="editableWaypoint.speed"
        label="Speed (m/s)"
        type="number"
        min="0.1"
        step="0.1"
        class="q-mb-md"
      />

      <q-input
        v-model.number="editableWaypoint.delay"
        label="Delay (seconds)"
        type="number"
        min="0"
      />
    </q-card-section>

    <q-card-actions align="right">
      <q-btn flat label="Cancel" @click="$emit('cancel')" />
      <q-btn
        label="Save"
        color="primary"
        @click="save"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Waypoint } from '../../stores/mission'

const props = defineProps<{
  waypoint?: Waypoint
}>()
const emit = defineEmits<{
  save: [waypoint: Waypoint]
  cancel: []
}>()

const editableWaypoint = ref<Waypoint>({
  lat: 0,
  lng: 0,
  alt: 10,
  type: 'waypoint'
})

const typeOptions = [
  { label: 'Waypoint', value: 'waypoint' },
  { label: 'Takeoff', value: 'takeoff' },
  { label: 'Landing', value: 'land' },
  { label: 'Loiter', value: 'loiter' }
]

watch(() => props.waypoint, (newWaypoint) => {
  if (newWaypoint) {
    editableWaypoint.value = { ...newWaypoint }
  }
}, { immediate: true })

function save() {
  emit('save', { ...editableWaypoint.value })
}
</script>