<template>
  <q-item
    v-ripple
    clickable
    :to="to"
    exact-active-class="sidebar-item--active"
    class="sidebar-item"
    :class="{
      'sidebar-item--mini': mini,
      'sidebar-item--indent': indent
    }"
  >
    <q-item-section avatar class="sidebar-item__icon">
      <q-icon :name="icon" size="20px" />
    </q-item-section>

    <q-item-section v-if="!mini" class="sidebar-item__label">
      <q-item-label>{{ label }}</q-item-label>
    </q-item-section>

    <q-item-section v-if="!mini && badge" side class="sidebar-item__badge">
      <q-badge :label="badge" color="primary" rounded />
    </q-item-section>

    <!-- Tooltip for mini mode -->
    <q-tooltip
      v-if="mini"
      anchor="center right"
      self="center left"
      :offset="[10, 0]"
      class="bg-dark text-white"
    >
      {{ label }}
      <q-badge v-if="badge" :label="badge" color="primary" rounded class="q-ml-sm" />
    </q-tooltip>
  </q-item>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// Props
interface Props {
  to: RouteLocationRaw
  icon: string
  label: string
  mini?: boolean
  indent?: boolean
  badge?: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.sidebar-item {
  border-radius: 8px;
  margin: 2px 0;
  transition: all 0.2s ease;
  min-height: 44px;

  &:hover {
    background-color: rgba(var(--q-primary-rgb), 0.1);
  }

  &--active {
    background-color: rgba(var(--q-primary-rgb), 0.15);
    color: var(--q-primary);

    .sidebar-item__icon .q-icon {
      color: var(--q-primary);
    }
  }

  &--mini {
    justify-content: center;

    .sidebar-item__icon {
      min-width: unset;
    }
  }

  &--indent {
    margin-left: 16px;

    &.sidebar-item--mini {
      margin-left: 0;
    }
  }
}

.sidebar-item__icon {
  min-width: 40px;

  .q-icon {
    transition: color 0.2s ease;
  }
}

.sidebar-item__label {
  .q-item-label {
    font-weight: 500;
    font-size: 0.875rem;
  }
}

.sidebar-item__badge {
  min-width: unset;
}

// Dark mode adjustments
.body--dark {
  .sidebar-item {
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &--active {
      background-color: rgba(var(--q-primary-rgb), 0.2);
    }
  }
}

// Focus styles for accessibility
.sidebar-item:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
