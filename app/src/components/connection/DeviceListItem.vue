<template>
  <q-item clickable :disable="disable" @click="$emit('connect', device)">
    <q-item-section avatar>
      <q-avatar color="primary" text-color="white">
        <q-icon name="mdi-robot-mower" />
      </q-avatar>
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ device.name }}</q-item-label>
      <q-item-label caption>
        {{ device.ip }}:{{ device.port }}
      </q-item-label>
      <q-item-label caption v-if="lastSeenText">
        {{ lastSeenText }}
      </q-item-label>
    </q-item-section>

    <q-item-section side>
      <div class="text-grey-8 q-gutter-xs">
        <q-btn
          flat
          dense
          round
          icon="mdi-connection"
          :disable="disable"
          @click.stop="$emit('connect', device)"
        >
          <q-tooltip>Connect</q-tooltip>
        </q-btn>
        <q-btn
          v-if="showDelete"
          flat
          dense
          round
          icon="delete"
          :disable="disable"
          @click.stop="$emit('delete', device)"
        >
          <q-tooltip>Remove</q-tooltip>
        </q-btn>
      </div>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoveredDevice } from '../../services/DeviceDiscovery'

interface Props {
  device: DiscoveredDevice
  showDelete?: boolean
  disable?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  connect: [device: DiscoveredDevice]
  delete: [device: DiscoveredDevice]
}>()

const lastSeenText = computed(() => {
  if (!props.device.lastSeen) return null
  
  const diff = Date.now() - props.device.lastSeen
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
})
</script>