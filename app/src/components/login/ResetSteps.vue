<template>
  <ol class="reset-steps">
    <li>{{ step1 }}</li>
    <li>{{ step2 }}</li>
    <li>
      <p>{{ step3 }}</p>
      <CopyBlock :value="step3Filename" :copy-label="copyLabel" :copied-label="copiedLabel" />
    </li>
    <li>{{ step4 }}</li>
  </ol>
</template>

<script setup lang="ts">
import CopyBlock from './CopyBlock.vue'

defineProps<{
  step1: string
  step2: string
  step3: string
  step3Filename: string
  step4: string
  copyLabel: string
  copiedLabel: string
}>()
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.reset-steps {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  li {
    font-size: 0.9rem;
    line-height: 1.5;
    color: $dark;

    p {
      margin: 0 0 0.5rem;
    }
  }
}
</style>
