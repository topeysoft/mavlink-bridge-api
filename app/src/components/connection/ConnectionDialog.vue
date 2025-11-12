<template>
  <q-card style="min-width: 400px">
    <q-card-section>
      <div class="text-h6">Manual Connection</div>
      <p class="text-body2 text-grey-7">
        Enter the IP address or URL of your YardRover device
      </p>
    </q-card-section>
    
    <q-separator />
    
    <q-card-section>
      <q-form @submit="onSubmit" class="q-gutter-md">
        <q-input
          v-model="connectionUrl"
          label="Device URL or IP Address"
          placeholder="192.168.1.100 or http://192.168.1.100"
          outlined
          :rules="[validateUrl]"
          autofocus
        >
          <template v-slot:prepend>
            <q-icon name="link" />
          </template>
        </q-input>
        
        <div class="text-caption text-grey-7">
          Examples:
          <br>• 192.168.1.100
          <br>• http://192.168.4.1
          <br>• yardrover.local
        </div>
      </q-form>
    </q-card-section>
    
    <q-separator />
    
    <q-card-actions align="right">
      <q-btn flat label="Cancel" v-close-popup />
      <q-btn
        unelevated
        color="primary"
        label="Connect"
        @click="onSubmit"
        :loading="isConnecting"
        :disable="!isValidUrl"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const emit = defineEmits<{
  connect: [url: string];
}>();

const connectionUrl = ref('');
const isConnecting = ref(false);

const isValidUrl = computed(() => {
  return validateUrl(connectionUrl.value) === true;
});

function validateUrl(value: string): boolean | string {
  if (!value) return 'URL is required';
  
  // Allow IP addresses
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(value)) {
    const parts = value.split('.');
    const validParts = parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
    return validParts || 'Invalid IP address';
  }
  
  // Allow hostnames
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (hostnameRegex.test(value)) {
    return true;
  }
  
  // Allow full URLs
  try {
    const url = new URL(value.startsWith('http') ? value : `http://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:' || 'Only HTTP/HTTPS URLs are supported';
  } catch {
    return 'Invalid URL format';
  }
}

function normalizeUrl(url: string): string {
  // If it's just an IP or hostname, add http://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `http://${url}`;
  }
  return url;
}

async function onSubmit() {
  if (!isValidUrl.value) return;
  
  isConnecting.value = true;
  
  try {
    const normalizedUrl = normalizeUrl(connectionUrl.value);
    emit('connect', normalizedUrl);
  } finally {
    isConnecting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 8px;
}
</style>