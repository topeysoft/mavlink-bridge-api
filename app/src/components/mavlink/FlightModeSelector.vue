<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 q-mb-md">Flight Mode</div>

      <q-select
        v-model="selectedMode"
        :options="modeOptions"
        label="Select flight mode"
        emit-value
        map-options
        :disable="isArmed && !allowModeChangeWhileArmed"
      >
        <template v-slot:prepend>
          <q-icon name="mdi-airplane-cog" />
        </template>
        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section>
              <q-item-label>{{ scope.opt.label }}</q-item-label>
              <q-item-label caption>{{ scope.opt.description }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>

      <q-banner
        v-if="isArmed && !allowModeChangeWhileArmed"
        class="bg-warning text-white q-mt-md"
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="warning" />
        </template>
        Disarm vehicle before changing flight mode
      </q-banner>

      <div class="q-mt-md" v-if="selectedModeInfo">
        <div class="text-subtitle2">{{ selectedModeInfo.label }}</div>
        <div class="text-caption text-grey-7">
          {{ selectedModeInfo.description }}
        </div>
        <div class="q-mt-sm" v-if="selectedModeInfo.requirements">
          <div class="text-caption text-weight-bold">Requirements:</div>
          <ul class="q-pl-md q-my-xs">
            <li
              v-for="req in selectedModeInfo.requirements"
              :key="req"
              class="text-caption"
            >
              {{ req }}
            </li>
          </ul>
        </div>
      </div>

      <div class="q-mt-lg row justify-end q-gutter-sm">
        <q-btn
          flat
          label="Cancel"
          @click="selectedMode = currentMode"
          :disable="selectedMode === currentMode"
        />
        <q-btn
          label="Change Mode"
          color="primary"
          @click="changeMode"
          :disable="selectedMode === currentMode || (isArmed && !allowModeChangeWhileArmed)"
          :loading="changingMode"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useMAVLinkStore } from '../../stores/mavlink'

const $q = useQuasar()
const mavlinkStore = useMAVLinkStore()

const selectedMode = ref('')
const changingMode = ref(false)
const allowModeChangeWhileArmed = ref(false)

const isArmed = computed(() => mavlinkStore.vehicleState.armed)
const currentMode = computed(() => mavlinkStore.vehicleState.mode || '')

const modeOptions = [
  {
    label: 'Manual',
    value: 'MANUAL',
    description: 'Direct manual control',
    requirements: ['RC connected']
  },
  {
    label: 'Guided',
    value: 'GUIDED',
    description: 'Controlled by ground station or companion computer',
    requirements: ['GPS lock', 'Good telemetry link']
  },
  {
    label: 'Auto',
    value: 'AUTO',
    description: 'Follows pre-programmed mission',
    requirements: ['GPS lock', 'Valid mission uploaded']
  },
  {
    label: 'Hold',
    value: 'HOLD',
    description: 'Maintains current position',
    requirements: ['GPS lock']
  },
  {
    label: 'Return to Launch',
    value: 'RTL',
    description: 'Returns to home position',
    requirements: ['GPS lock', 'Home position set']
  },
  {
    label: 'Smart RTL',
    value: 'SMART_RTL',
    description: 'Returns via recorded path',
    requirements: ['GPS lock', 'Path recorded']
  },
  {
    label: 'Acro',
    value: 'ACRO',
    description: 'Acrobatic mode for experienced pilots',
    requirements: ['RC connected', 'Experience required']
  }
]

const selectedModeInfo = computed(() => 
  modeOptions.find(m => m.value === selectedMode.value)
)

// Initialize with current mode
watch(currentMode, (mode) => {
  selectedMode.value = mode
}, { immediate: true })

function changeMode() {
  if (selectedMode.value === currentMode.value) return

  $q.dialog({
    title: 'Change Flight Mode',
    message: `Change flight mode to ${selectedModeInfo.value?.label}?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      changingMode.value = true
    
    try {
      await mavlinkStore.setFlightMode(selectedMode.value)
      
      $q.notify({
        type: 'positive',
        message: `Flight mode changed to ${selectedModeInfo.value?.label}`,
        position: 'top'
      })
    } catch (error: unknown) {
      $q.notify({
        type: 'negative',
        message: 'Failed to change flight mode',
        caption: error instanceof Error ? error.message : 'Unknown error',
        position: 'top'
      })
      
      // Reset to current mode
      selectedMode.value = currentMode.value
    } finally {
      changingMode.value = false
    }
    })()
  })
}
</script>