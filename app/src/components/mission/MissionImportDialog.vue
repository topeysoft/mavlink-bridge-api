<template>
  <q-card style="min-width: 400px">
    <q-card-section>
      <div class="text-h6">Import Mission</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-file
        v-model="selectedFile"
        label="Select mission file"
        outlined
        accept=".json"
        @update:model-value="loadFile"
      >
        <template v-slot:prepend>
          <q-icon name="attach_file" />
        </template>
      </q-file>

      <div v-if="missionData" class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Mission Preview:</div>
        <div class="text-body2">
          <div>Waypoints: {{ (missionData as any)?.waypoints?.length || 0 }}</div>
          <div v-if="(missionData as any)?.metadata">
            Distance: {{ (missionData as any)?.metadata?.totalDistance?.toFixed(0) || 0 }}m
          </div>
          <div v-if="(missionData as any)?.metadata">
            Created: {{ formatDate((missionData as any).metadata.created) }}
          </div>
        </div>
      </div>
    </q-card-section>

    <q-card-actions align="right">
      <q-btn flat label="Cancel" @click="$emit('close')" />
      <q-btn
        label="Import"
        color="primary"
        :disable="!missionData"
        @click="importMission"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { MissionData } from '../../stores/mission'

const emit = defineEmits<{
  import: [data: MissionData]
  close: []
}>()

const selectedFile = ref(null)
const missionData = ref(null)

function loadFile(file: File | null) {
  if (!file) {
    missionData.value = null
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      missionData.value = data
    } catch (error) {
      console.error('Failed to parse mission file:', error)
      missionData.value = null
    }
  }
  reader.readAsText(file)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

function importMission() {
  if (missionData.value) {
    emit('import', missionData.value)
  }
}
</script>