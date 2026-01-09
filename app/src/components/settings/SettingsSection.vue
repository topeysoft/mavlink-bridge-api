<script setup lang="ts">
interface Props {
  title: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <div class="settings-section">
    <div v-if="title || $slots.actions" class="section-header">
      <div class="section-text">
        <h3 class="section-title">{{ title }}</h3>
        <p v-if="description" class="section-description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="section-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.settings-section {
  // No padding - parent component handles spacing
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}

.section-text {
  flex: 1;
}

.section-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.section-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.section-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-actions {
    width: 100%;
  }
}
</style>
