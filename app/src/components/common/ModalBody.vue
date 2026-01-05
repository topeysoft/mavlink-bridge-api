<template>
  <div class="modal-body" :class="{ 'no-padding': noPadding }">
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  noPadding?: boolean
}

withDefaults(defineProps<Props>(), {
  noPadding: false
})
</script>

<style scoped lang="scss">
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);

  &.no-padding {
    padding: 0;
  }
}
</style>
