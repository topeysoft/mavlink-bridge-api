<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import TemplateCard from './TemplateCard.vue'
import TemplateCategoryTabs from './TemplateCategoryTabs.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useMissionTemplatesStore } from '@/stores/missionTemplates'
import { useFeaturesStore } from '@/stores/features'
import type { TemplateCategory } from '@client'

interface Props {
  showUnavailable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showUnavailable: true
})

const emit = defineEmits<{
  select: [templateId: string]
}>()

const templatesStore = useMissionTemplatesStore()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
const searchQuery = ref('')

const displayedTemplates = computed(() => {
  let templates = templatesStore.filteredTemplates

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.consumer_name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    )
  }

  if (!props.showUnavailable) {
    templates = templates.filter(t => t.available)
  }

  return templates
})

const hasTemplates = computed(() => displayedTemplates.value.length > 0)

const emptyStateMessage = computed(() => {
  if (templatesStore.selectedCategory) {
    return isConsumerMode.value
      ? 'No jobs available in this category'
      : 'No templates in this category'
  }
  return isConsumerMode.value
    ? 'No jobs available'
    : 'No templates available'
})

const emptyStateDescription = computed(() => {
  if (!props.showUnavailable) {
    return isConsumerMode.value
      ? 'Some jobs require equipment that isn\'t connected'
      : 'Some templates require peripherals that aren\'t available'
  }
  return isConsumerMode.value
    ? 'Check your equipment connections'
    : 'Check peripheral availability'
})

function handleCategoryChange(category: TemplateCategory | null) {
  templatesStore.setSelectedCategory(category)
}

function handleTemplateSelect(templateId: string) {
  emit('select', templateId)
}

onMounted(() => {
  if (templatesStore.templates.length === 0) {
    templatesStore.loadTemplates()
  }
})

// Reload templates when user mode changes
watch(() => featuresStore.userMode, () => {
  templatesStore.loadTemplates()
})
</script>

<template>
  <div class="template-selector" :class="{ 'consumer-selector': isConsumerMode }">
    <div class="selector-header">
      <h2 class="selector-title">
        {{ isConsumerMode ? 'Choose a Job' : 'Select Template' }}
      </h2>
      <p class="selector-subtitle">
        {{ isConsumerMode
          ? 'Pick what you\'d like your rover to do'
          : 'Choose a mission template to customize'
        }}
      </p>
    </div>

    <div class="search-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="isConsumerMode ? 'Search jobs...' : 'Search templates...'"
        />
        <button
          v-if="searchQuery"
          class="clear-search"
          @click="searchQuery = ''"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <TemplateCategoryTabs
      :selected-category="templatesStore.selectedCategory"
      :categories="templatesStore.categories"
      @change="handleCategoryChange"
    />

    <div v-if="templatesStore.isLoading" class="loading-container">
      <LoadingSpinner size="large" />
      <p class="loading-text">
        {{ isConsumerMode ? 'Loading jobs...' : 'Loading templates...' }}
      </p>
    </div>

    <div v-else-if="templatesStore.error" class="error-container">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ templatesStore.error }}</p>
      <button class="btn btn-primary" @click="templatesStore.loadTemplates()">
        Try Again
      </button>
    </div>

    <EmptyState
      v-else-if="!hasTemplates"
      :title="emptyStateMessage"
      :description="emptyStateDescription"
      icon="📋"
    />

    <div v-else class="template-grid" :class="{ 'consumer-grid': isConsumerMode }">
      <TemplateCard
        v-for="template in displayedTemplates"
        :key="template.id"
        :template="template"
        @select="handleTemplateSelect"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-selector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
}

.consumer-selector {
  padding: var(--spacing-lg);
}

.selector-header {
  text-align: center;
  margin-bottom: var(--spacing-md);
}

.selector-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-selector .selector-title {
  font-size: var(--font-size-2xl);
}

.selector-subtitle {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.consumer-selector .selector-subtitle {
  font-size: var(--font-size-lg);
}

.search-container {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-md);
}

.search-input-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-left: calc(var(--spacing-sm) + 24px);
  padding-right: calc(var(--spacing-sm) + 28px);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: var(--text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
  }
}

.consumer-selector .search-input {
  font-size: var(--font-size-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  padding-left: calc(var(--spacing-md) + 28px);
  padding-right: calc(var(--spacing-md) + 32px);
}

.consumer-selector .search-icon {
  left: var(--spacing-md);
  width: 20px;
  height: 20px;
}

.clear-search {
  position: absolute;
  right: var(--spacing-xs);
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  padding: var(--spacing-xs);
  cursor: pointer;
  color: var(--text-tertiary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-md);
}

.loading-text {
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-md);
  text-align: center;
}

.error-icon {
  font-size: 48px;
}

.error-message {
  color: var(--negative);
  font-size: var(--font-size-base);
  max-width: 400px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.consumer-grid {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

@media (max-width: 768px) {
  .template-grid,
  .consumer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
