<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
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

const displayedTemplates = computed(() => {
  let templates = templatesStore.filteredTemplates

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
