<template>
  <div class="saved-devices">
    <div class="text-h6 q-mb-md">Saved Devices</div>
    
    <!-- Loading State -->
    <div v-if="isLoading" class="q-py-md">
      <q-list separator>
        <q-skeleton-item 
          v-for="n in 2" 
          :key="n"
          class="q-pa-md"
        >
          <div class="row items-center">
            <q-skeleton type="QAvatar" size="40px" class="q-mr-md" />
            <div class="col">
              <q-skeleton type="text" width="60%" />
              <q-skeleton type="text" width="40%" />
            </div>
            <div class="row q-gutter-xs">
              <q-skeleton type="QBtn" />
              <q-skeleton type="QBtn" />
            </div>
          </div>
        </q-skeleton-item>
      </q-list>
    </div>
    
    <q-list separator v-else-if="savedDevices.length > 0">
      <DeviceListItem
        v-for="device in savedDevices"
        :key="device.ip"
        :device="device"
        :show-delete="true"
        :disable="isConnecting"
        @connect="$emit('connect', device)"
        @delete="handleDelete"
      />
    </q-list>

    <q-banner v-else class="bg-grey-2">
      <template v-slot:avatar>
        <q-icon name="mdi-bookmark-off" />
      </template>
      No saved devices. Connected devices will appear here automatically.
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { deviceDiscovery } from '../../services/DeviceDiscovery'
import DeviceListItem from './DeviceListItem.vue'
import type { DiscoveredDevice } from '../../services/DeviceDiscovery'

interface Props {
  isConnecting: boolean
}

defineProps<Props>()

defineEmits<{
  connect: [device: DiscoveredDevice]
}>()

const isLoading = ref(true)
const savedDevices = computed(() => deviceDiscovery.getSavedDevices())

function handleDelete(device: DiscoveredDevice) {
  const saved = deviceDiscovery.getSavedDevices()
  const filtered = saved.filter((d: DiscoveredDevice) => d.ip !== device.ip)
  localStorage.setItem('yardrover-saved-devices', JSON.stringify(filtered))
}

onMounted(async () => {
  // Simulate loading saved devices from localStorage
  await new Promise(resolve => setTimeout(resolve, 600))
  isLoading.value = false
})
</script>