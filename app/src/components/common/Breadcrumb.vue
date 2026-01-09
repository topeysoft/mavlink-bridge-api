<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

interface Props {
  items?: BreadcrumbItem[]
  separator?: string
}

const props = withDefaults(defineProps<Props>(), {
  separator: '/'
})

const router = useRouter()
const route = useRoute()

// Auto-generate breadcrumbs from route if items not provided
const breadcrumbs = computed(() => {
  if (props.items && props.items.length > 0) {
    return props.items
  }

  // Generate from route
  const crumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', to: '/', icon: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' }
  ]

  const routeNames: Record<string, string> = {
    peripherals: 'Peripherals',
    zones: 'Coverage Zones',
    missions: 'Missions',
    'mission-editor': 'Create Mission',
    monitoring: 'Live Monitoring',
    schedule: 'Schedule & Calendar',
    settings: 'Settings'
  }

  if (route.name && route.name !== 'dashboard') {
    const name = route.name as string
    crumbs.push({
      label: routeNames[name] || name,
      to: route.path
    })
  }

  return crumbs
})

const navigateTo = (item: BreadcrumbItem) => {
  if (item.to) {
    router.push(item.to)
  }
}

const chevronIcon = '<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>'
</script>

<template>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li
        v-for="(item, index) in breadcrumbs"
        :key="index"
        class="breadcrumb-item"
      >
        <button
          v-if="item.to"
          class="breadcrumb-link"
          :class="{ active: index === breadcrumbs.length - 1 }"
          :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined"
          @click="navigateTo(item)"
        >
          <svg
            v-if="item.icon"
            class="breadcrumb-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            v-html="item.icon"
            aria-hidden="true"
          ></svg>
          <span>{{ item.label }}</span>
        </button>
        <span v-else class="breadcrumb-text">{{ item.label }}</span>

        <svg
          v-if="index < breadcrumbs.length - 1"
          class="breadcrumb-separator"
          viewBox="0 0 24 24"
          fill="currentColor"
          v-html="chevronIcon"
          aria-hidden="true"
        ></svg>
      </li>
    </ol>
  </nav>
</template>

<style scoped lang="scss">
.breadcrumb {
  padding: var(--spacing-sm) 0;
  margin-bottom: var(--spacing-md);
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  list-style: none;
  flex-wrap: wrap;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  text-decoration: none;

  &:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
  }

  &.active {
    color: var(--text-primary);
    font-weight: 600;
    cursor: default;
    pointer-events: none;
  }
}

.breadcrumb-text {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.breadcrumb-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.breadcrumb-separator {
  width: 16px;
  height: 16px;
  color: var(--text-light);
  flex-shrink: 0;
}
</style>
