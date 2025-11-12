<template>
  <div class="loading-spinner" :class="{ 'full-screen': fullScreen }">
    <q-spinner-ios
      :color="color"
      :size="size"
      :thickness="thickness"
    />
    <div v-if="message" class="loading-message q-mt-md">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: string;
  color?: string;
  thickness?: number;
  message?: string;
  fullScreen?: boolean;
}

withDefaults(defineProps<Props>(), {
  size: '50px',
  color: 'primary',
  thickness: 5,
  fullScreen: false
});
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  &.full-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba($background, 0.9);
    z-index: 9999;
  }
}

.loading-message {
  color: $text-secondary;
  font-size: 14px;
  text-align: center;
}
</style>