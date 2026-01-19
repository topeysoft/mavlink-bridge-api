<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TemplateCategoryTabs from '@/components/missions/templates/TemplateCategoryTabs.vue'
import { useMissionTemplatesStore } from '@/stores/missionTemplates'
import { useFeaturesStore } from '@/stores/features'
import type { MissionTemplateSummary, TemplateCategory } from '@client'

const selectedTemplateId = defineModel<string | null>('selectedTemplateId', { required: true })
const isCustomMission = defineModel<boolean>('isCustomMission', { required: true })

const emit = defineEmits<{
  proceed: []
}>()

const templatesStore = useMissionTemplatesStore()
const featuresStore = useFeaturesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
const searchQuery = ref('')

const title = computed(() => isConsumerMode.value ? 'What would you like to do?' : 'Select Mission Type')

const description = computed(() =>
  isConsumerMode.value
    ? 'Choose a job type or create something custom'
    : 'Choose a template or create a custom mission'
)

const displayedTemplates = computed(() => {
  let templates = templatesStore.filteredTemplates

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.consumer_name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    )
  }

  return templates
})

const hasTemplates = computed(() => displayedTemplates.value.length > 0)

function handleCategoryChange(category: TemplateCategory | null) {
  templatesStore.setSelectedCategory(category)
}

function selectTemplate(template: MissionTemplateSummary) {
  selectedTemplateId.value = template.id
  isCustomMission.value = false
  emit('proceed')
}

function selectCustom() {
  selectedTemplateId.value = null
  isCustomMission.value = true
  emit('proceed')
}

function isSelected(templateId: string): boolean {
  return selectedTemplateId.value === templateId && !isCustomMission.value
}

function getTemplateName(template: MissionTemplateSummary): string {
  return templatesStore.getTemplateName(template)
}

function getTemplateDescription(template: MissionTemplateSummary): string {
  return templatesStore.getTemplateDescription(template)
}

onMounted(() => {
  if (templatesStore.templates.length === 0) {
    templatesStore.loadTemplates()
  }
})

watch(() => featuresStore.userMode, () => {
  templatesStore.loadTemplates()
})
</script>

<template>
  <div class="type-selection-step" :class="{ 'consumer-step': isConsumerMode }">
    <div class="step-header">
      <h3 class="step-title">{{ title }}</h3>
      <p class="step-description">{{ description }}</p>
    </div>

    <!-- Search -->
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

    <!-- Category Tabs -->
    <TemplateCategoryTabs
      :selected-category="templatesStore.selectedCategory"
      :categories="templatesStore.categories"
      @change="handleCategoryChange"
    />

    <!-- Loading -->
    <div v-if="templatesStore.isLoading" class="loading-container">
      <LoadingSpinner size="large" />
      <p class="loading-text">
        {{ isConsumerMode ? 'Loading jobs...' : 'Loading templates...' }}
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="templatesStore.error" class="error-container">
      <div class="error-icon">&#9888;</div>
      <p class="error-message">{{ templatesStore.error }}</p>
      <Button variant="primary" @click="templatesStore.loadTemplates()">
        Try Again
      </Button>
    </div>

    <!-- Template Grid -->
    <template v-else>
      <div class="template-grid" :class="{ 'consumer-grid': isConsumerMode }">
        <!-- Custom Mission Card (always first) -->
        <div
          class="template-card custom-card"
          :class="{ 'selected': isCustomMission, 'consumer-card': isConsumerMode }"
          @click="selectCustom"
        >
          <div class="template-content" :class="{ 'consumer-layout': isConsumerMode }">
            <div class="template-header" :class="{ 'consumer-header': isConsumerMode }">
              <span class="template-emoji">&#9997;</span>
              <h4 class="template-name">
                {{ isConsumerMode ? 'Custom Job' : 'Custom Mission' }}
              </h4>
            </div>
            <p class="template-description">
              {{ isConsumerMode
                ? 'Create your own job with custom settings'
                : 'Build a mission from scratch with full control'
              }}
            </p>
            <div class="template-meta">
              <Badge variant="info" size="small">
                {{ isConsumerMode ? 'Flexible' : 'Full Control' }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Template Cards -->
        <div
          v-for="template in displayedTemplates"
          :key="template.id"
          class="template-card"
          :class="{
            'selected': isSelected(template.id),
            'unavailable': !template.available,
            'consumer-card': isConsumerMode
          }"
          @click="template.available && selectTemplate(template)"
        >
          <div class="template-content" :class="{ 'consumer-layout': isConsumerMode }">
            <div class="template-header" :class="{ 'consumer-header': isConsumerMode }">
              <span class="template-emoji">{{ template.emoji }}</span>
              <h4 class="template-name">{{ getTemplateName(template) }}</h4>
            </div>
            <p class="template-description">{{ getTemplateDescription(template) }}</p>
            <div class="template-meta">
              <span class="time-estimate">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {{ isConsumerMode ? `About ${template.estimated_time_per_acre} min/acre` : `~${template.estimated_time_per_acre} min/acre` }}
              </span>
              <Badge
                v-if="!template.available"
                variant="warning"
                size="small"
              >
                {{ isConsumerMode ? 'Equipment needed' : 'Missing peripherals' }}
              </Badge>
            </div>
            <div v-if="template.unavailable_reason" class="unavailable-reason">
              {{ template.unavailable_reason }}
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!hasTemplates && !templatesStore.isLoading" class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <p class="empty-message">
          {{ isConsumerMode
            ? 'No jobs match your search. Try a different search or create a custom job.'
            : 'No templates found. Try a different search or create a custom mission.'
          }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.type-selection-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.step-header {
  text-align: center;
}

.consumer-step .step-header {
  padding: var(--spacing-md) 0;
}

.step-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
}

.consumer-step .step-title {
  font-size: var(--font-size-xl);
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}

.search-container {
  display: flex;
  justify-content: center;
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

.consumer-step .search-input {
  font-size: var(--font-size-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  padding-left: calc(var(--spacing-md) + 28px);
  padding-right: calc(var(--spacing-md) + 32px);
}

.consumer-step .search-icon {
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

.template-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  padding: var(--spacing-md);

  &:hover:not(.unavailable) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    border-color: var(--primary);
  }

  &.selected {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.05);
  }

  &.unavailable {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.custom-card {
  border-style: dashed;
  border-color: var(--border-color);

  &:hover {
    border-style: solid;
  }

  &.selected {
    border-style: solid;
  }
}

.template-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.consumer-layout {
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
}

.template-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.consumer-header {
  flex-direction: column;
  text-align: center;
  padding: var(--spacing-md) 0;
}

.template-emoji {
  font-size: 32px;
  flex-shrink: 0;
}

.consumer-card .template-emoji {
  font-size: 48px;
}

.template-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.consumer-layout .template-name {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.template-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.consumer-layout .template-description {
  font-size: var(--font-size-base);
  text-align: center;
  min-height: 3em;
}

.template-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.time-estimate {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);

  svg {
    width: 16px;
    height: 16px;
  }
}

.consumer-layout .time-estimate {
  justify-content: center;
  width: 100%;
  font-size: var(--font-size-base);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.unavailable-reason {
  font-size: var(--font-size-xs);
  color: var(--warning);
  text-align: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(var(--warning-rgb), 0.1);
  border-radius: var(--radius-sm);
}

.consumer-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(.unavailable) {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2xl);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
}

.empty-message {
  color: var(--text-secondary);
  max-width: 400px;
}
</style>
