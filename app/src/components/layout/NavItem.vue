<template>
  <q-item
    :to="path"
    clickable
    v-ripple
    active-class="nav-item-active"
    class="nav-item"
  >
    <q-item-section avatar>
      <q-icon :name="icon" :color="color" />
    </q-item-section>
    
    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  icon: string;
  path: string;
  color?: string;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables';

.nav-item {
  border-radius: $radius-md;
  margin: 2px $spacing-xs;
  transition: $transition-fast;
  
  &:hover {
    background-color: rgba($primary, 0.1);
  }
  
  &.nav-item-active {
    background-color: rgba($primary, 0.2);
    border-left: 4px solid $primary;
  }
}
</style>