<template>
  <div class="app-logo" :class="{ 'animate-sway': animated }">
    <q-icon 
      name="grass" 
      :size="size"
      :color="color"
      class="logo-icon"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: string;
  color?: string;
  animated?: boolean;
}

withDefaults(defineProps<Props>(), {
  size: '32px',
  color: 'white',
  animated: false
});
</script>

<style lang="scss" scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  .logo-icon {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }
}
</style>