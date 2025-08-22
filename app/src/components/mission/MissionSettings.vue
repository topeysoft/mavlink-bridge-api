<template>
  <div class="mission-settings q-pa-md">
    <div class="text-subtitle1 q-mb-md">Mission Settings</div>

    <q-input
      v-model.number="settings.defaultAltitude"
      label="Default Altitude (m)"
      type="number"
      min="1"
      class="q-mb-md"
    />

    <q-input
      v-model.number="settings.defaultSpeed"
      label="Default Speed (m/s)"
      type="number"
      min="0.1"
      step="0.1"
      class="q-mb-md"
    />

    <q-input
      v-model.number="settings.takeoffAltitude"
      label="Takeoff Altitude (m)"
      type="number"
      min="1"
      class="q-mb-md"
    />

    <q-input
      v-model.number="settings.landingSpeed"
      label="Landing Speed (m/s)"
      type="number"
      min="0.1"
      step="0.1"
      class="q-mb-md"
    />

    <q-input
      v-model.number="settings.rtlAltitude"
      label="RTL Altitude (m)"
      type="number"
      min="1"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MissionSettings as MissionSettingsType } from '../../stores/mission'

interface Props {
  modelValue: MissionSettingsType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: MissionSettingsType]
}>()

const settings = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<style lang="scss" scoped>
.mission-settings {
  max-height: 100%;
  overflow-y: auto;
}
</style>