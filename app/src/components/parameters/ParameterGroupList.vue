<script setup lang="ts">
import { ref } from 'vue'
import type { ParameterGroup } from '@/types/parameter'
import ParameterItem from './ParameterItem.vue'

defineProps<{
  groups: ParameterGroup[]
}>()

const expandedGroups = ref<Set<string>>(new Set())

function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

function isExpanded(groupName: string) {
  return expandedGroups.value.has(groupName)
}
</script>

<template>
  <div class="parameter-group-list">
    <div v-for="group in groups" :key="group.name" class="parameter-group">
      <div class="group-header" @click="toggleGroup(group.name)">
        <div class="header-left">
          <svg v-if="group.icon" viewBox="0 0 24 24" fill="currentColor" class="group-icon">
            <path
              v-if="group.icon === 'settings'"
              d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
            />
            <path
              v-else-if="group.icon === 'navigation'"
              d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"
            />
            <path v-else d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <div>
            <div class="group-name">{{ group.displayName }}</div>
            <div class="group-description">{{ group.description }}</div>
          </div>
        </div>
        <div class="header-right">
          <span class="param-count">{{ group.parameters.length }}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="chevron"
            :class="{ expanded: isExpanded(group.name) }"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div v-if="isExpanded(group.name)" class="group-content">
        <ParameterItem
          v-for="param in group.parameters"
          :key="param.name"
          :parameter="param"
        />
      </div>
    </div>

    <div v-if="groups.length === 0" class="no-results">
      <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2" />
        <line x1="11" y1="8" x2="11" y2="14" stroke="white" stroke-width="2" />
        <line x1="8" y1="11" x2="14" y2="11" stroke="white" stroke-width="2" />
      </svg>
      <p>No parameters match your filters</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.parameter-group-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.parameter-group {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: darken(#f5f5f5, 3%);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);

    .group-icon {
      width: 24px;
      height: 24px;
      color: var(--primary-green);
      flex-shrink: 0;
    }

    .group-name {
      font-weight: 600;
      color: var(--text-primary);
      font-size: var(--font-size-base);
    }

    .group-description {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin-top: 2px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);

    .param-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      background: var(--bg-primary);
      color: var(--text-secondary);
      border-radius: 12px;
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .chevron {
      width: 20px;
      height: 20px;
      color: var(--text-secondary);
      transition: transform 0.2s;

      &.expanded {
        transform: rotate(180deg);
      }
    }
  }
}

.group-content {
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: calc(var(--spacing-xl) * 2);
  text-align: center;

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-tertiary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }
}
</style>
