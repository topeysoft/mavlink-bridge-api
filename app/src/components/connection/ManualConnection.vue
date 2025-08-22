<template>
  <div class="manual-connection">
    <q-form @submit="handleSubmit" class="q-gutter-md">
      <div class="text-h6 q-mb-md">Manual Connection</div>
      
      <q-input
        v-model="formData.ip"
        label="Device IP Address"
        hint="e.g., 192.168.4.1"
        :rules="[
          val => !!val || 'IP address is required',
          val => isValidIp(val) || 'Invalid IP address'
        ]"
        :disable="isConnecting"
      >
        <template v-slot:prepend>
          <q-icon name="mdi-ip-network" />
        </template>
      </q-input>

      <q-input
        v-model.number="formData.port"
        label="Port"
        type="number"
        hint="Default: 80"
        :rules="[
          val => val > 0 && val < 65536 || 'Invalid port'
        ]"
        :disable="isConnecting"
      >
        <template v-slot:prepend>
          <q-icon name="mdi-ethernet-cable" />
        </template>
      </q-input>

      <q-input
        v-model="formData.name"
        label="Device Name (Optional)"
        hint="A friendly name for this device"
        :disable="isConnecting"
      >
        <template v-slot:prepend>
          <q-icon name="mdi-robot-mower" />
        </template>
      </q-input>

      <div class="q-mt-lg">
        <q-btn
          type="submit"
          label="Connect"
          color="primary"
          size="lg"
          class="full-width"
          :loading="isConnecting"
          :disable="isConnecting"
        />
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DiscoveredDevice } from '../../services/DeviceDiscovery'

interface Props {
  isConnecting: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  connect: [device: DiscoveredDevice]
}>()

const formData = ref({
  ip: '192.168.4.1',
  port: 80,
  name: ''
})

function isValidIp(ip: string): boolean {
  const regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!regex.test(ip)) return false
  
  const parts = ip.split('.')
  return parts.every(part => {
    const num = parseInt(part)
    return num >= 0 && num <= 255
  })
}

function handleSubmit() {
  const device: DiscoveredDevice = {
    name: formData.value.name || `Device at ${formData.value.ip}`,
    hostname: formData.value.ip,
    ip: formData.value.ip,
    port: formData.value.port,
    lastSeen: Date.now()
  }
  
  emit('connect', device)
}
</script>