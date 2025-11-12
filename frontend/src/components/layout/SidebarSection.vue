<template>
  <div class="sidebar-section">
    <!-- Section header (collapsible) -->
    <q-item
      v-if="!mini"
      v-ripple
      clickable
      class="sidebar-section__header"
      @click="$emit('toggle')"
    >
      <q-item-section avatar class="sidebar-section__icon">
        <q-icon :name="icon" size="18px" />
      </q-item-section>

      <q-item-section class="sidebar-section__title">
        <q-item-label header class="text-uppercase text-grey-7">
          {{ title }}
        </q-item-label>
      </q-item-section>

      <q-item-section side class="sidebar-section__expand">
        <q-icon :name="expanded ? 'expand_less' : 'expand_more'" size="20px" class="text-grey-6" />
      </q-item-section>
    </q-item>

    <!-- Section divider for mini mode -->
    <q-separator v-if="mini" class="sidebar-section__divider" />

    <!-- Section content -->
    <q-slide-transition>
      <div v-show="expanded || mini" class="sidebar-section__content">
        <slot />
      </div>
    </q-slide-transition>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  title: string
  icon: string
  expanded: boolean
  mini?: boolean
}

defineProps<Props>()

// Emits
defineEmits<{
  toggle: []
}>()
</script>

<style lang="scss" scoped>
.sidebar-section {
  margin: 8px 0;
}

.sidebar-section__header {
  border-radius: 6px;
  padding: 8px 12px;
  transition: background-color 0.2s ease;
  min-height: 40px;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);

    .body--dark & {
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
}

.sidebar-section__icon {
  min-width: 32px;
}

.sidebar-section__title {
  .q-item-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    line-height: 1.2;

    .body--dark & {
      color: rgba(255, 255, 255, 0.6);
    }
  }
}

.sidebar-section__expand {
  min-width: unset;
}

.sidebar-section__divider {
  margin: 12px 16px;
  opacity: 0.3;
}

.sidebar-section__content {
  padding-left: 0;
}

// Focus styles for accessibility
.sidebar-section__header:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

// Animation adjustments
.q-slide-transition-enter-active,
.q-slide-transition-leave-active {
  transition: all 0.3s ease;
}
</style>
