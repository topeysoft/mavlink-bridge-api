<script setup lang="ts">
interface Props {
  isRecording: boolean
  isPaused: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  pause: []
  resume: []
  stop: []
}>()
</script>

<template>
  <div class="recording-controls">
    <button
      v-if="!isPaused"
      class="btn btn-secondary"
      @click="emit('pause')"
    >
      ⏸ Pause
    </button>

    <button
      v-else
      class="btn btn-primary"
      @click="emit('resume')"
    >
      ▶️ Resume
    </button>

    <button
      class="btn btn-accent"
      @click="emit('stop')"
    >
      ⏹ Stop Recording
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.recording-controls {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;

  .btn {
    min-width: 150px;
  }
}
</style>
