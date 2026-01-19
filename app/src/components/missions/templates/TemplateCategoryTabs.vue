<script setup lang="ts">
import { computed } from 'vue'
import { useFeaturesStore } from '@/stores/features'
import type { TemplateCategory, TemplateCategoryInfo } from '@client'

interface Props {
  selectedCategory: TemplateCategory | null
  categories: TemplateCategoryInfo[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  change: [category: TemplateCategory | null]
}>()

const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const allLabel = computed(() => isConsumerMode.value ? 'All Jobs' : 'All')

function getCategoryLabel(category: TemplateCategoryInfo): string {
  return isConsumerMode.value ? category.consumer_name : category.name
}

function handleCategoryClick(category: TemplateCategory | null) {
  emit('change', category)
}

function isSelected(category: TemplateCategory | null): boolean {
  return props.selectedCategory === category
}
</script>

<template>
  <div class="category-tabs" :class="{ 'consumer-tabs': isConsumerMode }">
    <button
      class="category-tab"
      :class="{ 'active': isSelected(null) }"
      @click="handleCategoryClick(null)"
    >
      <span class="tab-emoji">📋</span>
      <span class="tab-label">{{ allLabel }}</span>
    </button>

    <button
      v-for="cat in categories"
      :key="cat.category"
      class="category-tab"
      :class="{ 'active': isSelected(cat.category) }"
      @click="handleCategoryClick(cat.category)"
    >
      <span class="tab-emoji">{{ cat.emoji }}</span>
      <span class="tab-label">{{ getCategoryLabel(cat) }}</span>
      <span v-if="cat.template_count" class="tab-count">{{ cat.template_count }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-color);
}

.consumer-tabs {
  gap: var(--spacing-sm);
  justify-content: center;
  padding: var(--spacing-md) 0;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: var(--bg-secondary);
    border-color: var(--primary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary);
    border-color: var(--primary);
    color: white;

    .tab-count {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
  }
}

.consumer-tabs .category-tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-base);
  border-radius: var(--radius-lg);
}

.tab-emoji {
  font-size: 16px;
  flex-shrink: 0;
}

.consumer-tabs .tab-emoji {
  font-size: 20px;
}

.tab-label {
  font-weight: 500;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--spacing-xs);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .category-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: var(--spacing-md);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .category-tab {
    flex-shrink: 0;
  }
}
</style>
