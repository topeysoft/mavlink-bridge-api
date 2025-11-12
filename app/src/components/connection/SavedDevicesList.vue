<template>
  <div class="saved-devices-list">
    <div v-if="devices.length === 0" class="text-center q-py-xl">
      <q-icon name="bookmark_border" size="64px" color="grey-5" class="q-mb-md" />
      <p class="text-body1 text-grey-7">
        No saved devices yet. Discover and save devices for quick access.
      </p>
    </div>
    
    <div v-else>
      <!-- Export/Import Actions -->
      <div v-if="!hideActions" class="row justify-end q-mb-md">
        <q-btn
          flat
          icon="file_download"
          label="Export"
          @click="exportDevices"
          class="q-mr-sm"
        />
        <q-btn
          flat
          icon="file_upload"
          label="Import"
          @click="importDevices"
        />
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileImport"
        />
      </div>
      
      <!-- Device List -->
      <q-list separator>
        <q-item
          v-for="device in devices"
          :key="device.ip"
          clickable
          @click="$emit('connect', device)"
          class="saved-device-item"
        >
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white" icon="router" />
          </q-item-section>
          
          <q-item-section>
            <q-item-label>
              {{ device.nickname || device.name || 'YardRover' }}
              <q-icon
                v-if="device.favorite"
                name="star"
                color="amber"
                size="sm"
                class="q-ml-xs"
              />
            </q-item-label>
            <q-item-label caption>{{ device.ip }}</q-item-label>
            <q-item-label caption>
              Last seen: {{ formatDate(device.lastSeen) }}
            </q-item-label>
          </q-item-section>
          
          <q-item-section side v-if="!hideActions">
            <div class="row q-gutter-xs">
              <q-btn
                flat
                round
                dense
                :icon="device.favorite ? 'star' : 'star_border'"
                :color="device.favorite ? 'amber' : 'grey-6'"
                @click.stop="$emit('toggle-favorite', device.ip)"
              >
                <q-tooltip>
                  {{ device.favorite ? 'Remove from favorites' : 'Add to favorites' }}
                </q-tooltip>
              </q-btn>
              
              <q-btn
                flat
                round
                dense
                icon="edit"
                color="grey-6"
                @click.stop="editNickname(device)"
              >
                <q-tooltip>Edit nickname</q-tooltip>
              </q-btn>
              
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click.stop="confirmRemove(device)"
              >
                <q-tooltip>Remove device</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useDevicesStore } from '@/stores/devices';
import type { SavedDevice } from '@/stores/devices';
import type { MAVLinkBridgeDevice } from '@mavlinkbridge/api-client';
import { format } from 'date-fns';

const props = defineProps<{
  devices: SavedDevice[];
  hideActions?: boolean;
}>();

const emit = defineEmits<{
  connect: [device: MAVLinkBridgeDevice];
  remove: [ip: string];
  'toggle-favorite': [ip: string];
  'update-nickname': [ip: string, nickname: string];
}>();

const $q = useQuasar();
const devicesStore = useDevicesStore();
const fileInput = ref<HTMLInputElement>();

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy HH:mm');
}

function editNickname(device: SavedDevice) {
  $q.dialog({
    title: 'Edit Device Nickname',
    message: 'Enter a new nickname for this device',
    prompt: {
      model: device.nickname || '',
      type: 'text',
      placeholder: device.name || 'YardRover'
    },
    cancel: true
  }).onOk((nickname) => {
    $emit('update-nickname', device.ip, nickname);
  });
}

function confirmRemove(device: SavedDevice) {
  $q.dialog({
    title: 'Remove Device',
    message: `Are you sure you want to remove "${device.nickname || device.name || device.ip}" from saved devices?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    $emit('remove', device.ip);
    
    $q.notify({
      type: 'positive',
      message: 'Device removed'
    });
  });
}

function exportDevices() {
  devicesStore.exportDevices();
  
  $q.notify({
    type: 'positive',
    message: 'Devices exported successfully'
  });
}

function importDevices() {
  fileInput.value?.click();
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    await devicesStore.importDevices(file);
    
    $q.notify({
      type: 'positive',
      message: 'Devices imported successfully'
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Import failed: ${(error as Error).message}`
    });
  }
  
  // Reset file input
  target.value = '';
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.saved-device-item {
  &:hover {
    background-color: rgba($primary, 0.05);
  }
}
</style>