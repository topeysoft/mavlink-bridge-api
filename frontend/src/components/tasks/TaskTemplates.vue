<template>
  <div class="task-templates">
    <!-- Header Controls -->
    <div class="task-templates__header">
      <div class="task-templates__search">
        <q-input v-model="searchQuery" placeholder="Search templates..." outlined dense clearable>
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>

      <div class="task-templates__actions">
        <q-btn color="primary" icon="add" label="New Template" @click="showCreateDialog = true" />
      </div>
    </div>

    <!-- Templates Grid -->
    <div class="task-templates__grid">
      <div v-for="template in filteredTemplates" :key="template.id" class="task-templates__card">
        <q-card class="task-template-card">
          <q-card-section class="q-pb-none">
            <div class="task-template-card__header">
              <q-icon
                :name="getTemplateIcon(template.type)"
                :color="getTemplateColor(template.type)"
                size="24px"
              />

              <q-btn icon="more_vert" flat round dense size="sm">
                <q-menu>
                  <q-list>
                    <q-item v-close-popup clickable @click="$emit('template-edit', template)">
                      <q-item-section avatar>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>Edit</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="duplicateTemplate(template)">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Duplicate</q-item-section>
                    </q-item>

                    <q-item v-close-popup clickable @click="exportTemplate(template)">
                      <q-item-section avatar>
                        <q-icon name="download" />
                      </q-item-section>
                      <q-item-section>Export</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      v-close-popup
                      class="text-negative"
                      clickable
                      @click="$emit('template-delete', template)"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>Delete</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-card-section>

          <q-card-section>
            <div class="task-template-card__title">
              {{ template.name }}
            </div>

            <div class="task-template-card__description">
              {{ template.description || 'No description provided' }}
            </div>

            <div class="task-template-card__type">
              <q-chip
                :color="getTemplateColor(template.type)"
                text-color="white"
                :label="formatTemplateType(template.type)"
                size="sm"
              />
            </div>

            <div class="task-template-card__settings">
              <div class="text-caption text-grey-6 q-mb-sm">Settings Preview</div>
              <div class="task-template-card__settings-list">
                <div
                  v-for="(value, key) in getPreviewSettings(template.settings)"
                  :key="key"
                  class="task-template-card__setting"
                >
                  <span class="task-template-card__setting-key">{{ formatSettingKey(key) }}:</span>
                  <span class="task-template-card__setting-value">{{
                    formatSettingValue(value)
                  }}</span>
                </div>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="between">
            <div class="task-template-card__meta">
              <div class="text-caption text-grey-6">
                Created {{ formatRelativeTime(template.createdAt) }}
              </div>
            </div>

            <q-btn
              color="primary"
              label="Use Template"
              outline
              @click="$emit('template-use', template)"
            />
          </q-card-actions>
        </q-card>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTemplates.length === 0" class="task-templates__empty">
        <q-icon name="library_books" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">
          {{ searchQuery ? 'No templates match your search' : 'No templates available' }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-sm">
          {{
            searchQuery
              ? 'Try adjusting your search terms'
              : 'Create your first template to get started'
          }}
        </div>

        <q-btn
          v-if="!searchQuery"
          color="primary"
          label="Create Template"
          class="q-mt-md"
          @click="showCreateDialog = true"
        />
      </div>
    </div>

    <!-- Create Template Dialog -->
    <q-dialog v-model="showCreateDialog" position="right" full-height>
      <q-card style="width: 500px; max-width: 90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Create Template</div>
          <q-space />
          <q-btn v-close-popup icon="close" flat round dense />
        </q-card-section>

        <q-card-section>
          <q-form @submit="handleCreateTemplate">
            <div class="q-gutter-md">
              <q-input v-model="newTemplate.name" label="Template Name" required outlined />

              <q-input
                v-model="newTemplate.description"
                label="Description"
                type="textarea"
                rows="3"
                outlined
              />

              <q-select
                v-model="newTemplate.type"
                :options="templateTypeOptions"
                label="Template Type"
                required
                outlined
              />

              <!-- Dynamic Settings Based on Type -->
              <div class="text-subtitle2 q-mt-md">Template Settings</div>

              <div v-if="newTemplate.type === 'mowing'" class="q-gutter-md">
                <q-input
                  v-model.number="newTemplate.settings.cuttingHeight"
                  label="Cutting Height (mm)"
                  type="number"
                  min="20"
                  max="100"
                  outlined
                />

                <q-select
                  v-model="newTemplate.settings.pattern"
                  :options="mowingPatternOptions"
                  label="Mowing Pattern"
                  outlined
                />

                <q-slider
                  v-model="newTemplate.settings.speed"
                  :min="20"
                  :max="100"
                  :step="5"
                  label
                  :label-value="`${newTemplate.settings.speed}%`"
                  color="primary"
                />
                <div class="text-caption text-grey-6">Speed: {{ newTemplate.settings.speed }}%</div>
              </div>

              <div v-if="newTemplate.type === 'trimming'" class="q-gutter-md">
                <q-input
                  v-model.number="newTemplate.settings.trimHeight"
                  label="Trim Height (mm)"
                  type="number"
                  min="10"
                  max="50"
                  outlined
                />

                <q-select
                  v-model="newTemplate.settings.trimArea"
                  :options="trimAreaOptions"
                  label="Trim Area"
                  outlined
                />
              </div>

              <div v-if="newTemplate.type === 'maintenance'" class="q-gutter-md">
                <q-select
                  v-model="newTemplate.settings.maintenanceType"
                  :options="maintenanceTypeOptions"
                  label="Maintenance Type"
                  outlined
                />

                <q-input
                  v-model.number="newTemplate.settings.duration"
                  label="Duration (minutes)"
                  type="number"
                  min="5"
                  max="120"
                  outlined
                />
              </div>
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup label="Cancel" color="grey" outline />
          <q-btn label="Create Template" color="primary" @click="handleCreateTemplate" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { date, useQuasar } from 'quasar'

// Props
interface TaskTemplate {
  id: string
  name: string
  description: string
  type: string
  settings: Record<string, any>
  createdAt: string
}

const props = defineProps<{
  templates: TaskTemplate[]
}>()

// Emits
const emit = defineEmits<{
  'template-create': [template: Partial<TaskTemplate>]
  'template-edit': [template: TaskTemplate]
  'template-delete': [template: TaskTemplate]
  'template-use': [template: TaskTemplate]
}>()

// Composables
const $q = useQuasar()

// Local state
const searchQuery = ref('')
const showCreateDialog = ref(false)

const newTemplate = ref({
  name: '',
  description: '',
  type: 'mowing',
  settings: {
    cuttingHeight: 40,
    pattern: 'random',
    speed: 60,
    trimHeight: 25,
    trimArea: 'edges',
    maintenanceType: 'blade-cleaning',
    duration: 30
  }
})

// Options
const templateTypeOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Trimming', value: 'trimming' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
]

const mowingPatternOptions = [
  { label: 'Random', value: 'random' },
  { label: 'Parallel', value: 'parallel' },
  { label: 'Spiral', value: 'spiral' },
  { label: 'Checkerboard', value: 'checkerboard' }
]

const trimAreaOptions = [
  { label: 'Edges Only', value: 'edges' },
  { label: 'Around Obstacles', value: 'obstacles' },
  { label: 'Full Perimeter', value: 'perimeter' }
]

const maintenanceTypeOptions = [
  { label: 'Blade Cleaning', value: 'blade-cleaning' },
  { label: 'Sensor Calibration', value: 'sensor-calibration' },
  { label: 'Battery Check', value: 'battery-check' },
  { label: 'System Diagnostic', value: 'system-diagnostic' }
]

// Computed
const filteredTemplates = computed(() => {
  if (!searchQuery.value) {
    return props.templates
  }

  const query = searchQuery.value.toLowerCase()
  return props.templates.filter(
    template =>
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.type.toLowerCase().includes(query)
  )
})

// Methods
const getTemplateIcon = (type: string) => {
  switch (type) {
    case 'mowing':
      return 'grass'
    case 'trimming':
      return 'content_cut'
    case 'maintenance':
      return 'build'
    case 'custom':
      return 'tune'
    default:
      return 'library_books'
  }
}

const getTemplateColor = (type: string) => {
  switch (type) {
    case 'mowing':
      return 'green-6'
    case 'trimming':
      return 'orange-6'
    case 'maintenance':
      return 'blue-6'
    case 'custom':
      return 'purple-6'
    default:
      return 'grey-6'
  }
}

const formatTemplateType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const getPreviewSettings = (settings: Record<string, any>) => {
  // Return first 3 settings for preview
  const entries = Object.entries(settings)
  return Object.fromEntries(entries.slice(0, 3))
}

const formatSettingKey = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

const formatSettingValue = (value: any) => {
  if (typeof value === 'number') {
    return value.toString()
  }
  if (typeof value === 'string') {
    return value.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  }
  return String(value)
}

const formatRelativeTime = (dateString: string) => {
  const now = new Date()
  const createdDate = new Date(dateString)
  const diffInHours = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) {
    return 'just now'
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  } else {
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }
}

const duplicateTemplate = (template: TaskTemplate) => {
  const duplicated = {
    ...template,
    name: `${template.name} (Copy)`,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  }

  emit('template-create', duplicated)

  $q.notify({
    type: 'positive',
    message: 'Template duplicated successfully'
  })
}

const exportTemplate = (template: TaskTemplate) => {
  const dataStr = JSON.stringify(template, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${template.name.replace(/\s+/g, '_')}_template.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  $q.notify({
    type: 'positive',
    message: 'Template exported successfully'
  })
}

const handleCreateTemplate = () => {
  if (!newTemplate.value.name.trim()) {
    $q.notify({
      type: 'negative',
      message: 'Template name is required'
    })
    return
  }

  const templateData = {
    ...newTemplate.value,
    createdAt: new Date().toISOString()
  }

  emit('template-create', templateData)

  // Reset form
  newTemplate.value = {
    name: '',
    description: '',
    type: 'mowing',
    settings: {
      cuttingHeight: 40,
      pattern: 'random',
      speed: 60,
      trimHeight: 25,
      trimArea: 'edges',
      maintenanceType: 'blade-cleaning',
      duration: 30
    }
  }

  showCreateDialog.value = false
}
</script>

<style lang="scss" scoped>
.task-templates {
  min-height: 400px;
  padding: 24px;
}

.task-templates__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.task-templates__search {
  flex: 1;
  max-width: 400px;
}

.task-templates__actions {
  margin-left: 16px;
}

.task-templates__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.task-templates__card {
  height: fit-content;
}

.task-template-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.task-template-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-template-card__title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.task-template-card__description {
  font-size: 0.875rem;
  color: var(--q-grey-6);
  margin-bottom: 12px;
  line-height: 1.4;
}

.task-template-card__type {
  margin-bottom: 16px;
}

.task-template-card__settings {
  background: var(--q-grey-1);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;

  .body--dark & {
    background: var(--q-grey-9);
  }
}

.task-template-card__settings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-template-card__setting {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.task-template-card__setting-key {
  color: var(--q-grey-7);
  font-weight: 500;
}

.task-template-card__setting-value {
  color: var(--q-dark);

  .body--dark & {
    color: var(--q-dark-page-text);
  }
}

.task-template-card__meta {
  flex: 1;
}

.task-templates__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  background: white;
  border-radius: 8px;
  border: 2px dashed var(--q-grey-4);

  .body--dark & {
    background: var(--q-dark);
    border-color: var(--q-grey-7);
  }
}

// Responsive adjustments
@media (max-width: 1023px) {
  .task-templates {
    padding: 16px;
  }

  .task-templates__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .task-templates__search {
    max-width: none;
  }

  .task-templates__actions {
    margin-left: 0;
    display: flex;
    justify-content: flex-end;
  }

  .task-templates__grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 599px) {
  .task-templates {
    padding: 12px;
  }

  .task-templates__grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .task-template-card__setting {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
