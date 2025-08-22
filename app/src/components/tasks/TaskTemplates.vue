<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">Task Templates</div>
          <div class="text-caption text-grey-7">
            Choose from predefined task templates
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            icon="add"
            @click="showCreateDialog = true"
          >
            <q-tooltip>Create custom template</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Template Categories -->
      <q-tabs
        v-model="selectedCategory"
        dense
        active-color="primary"
        indicator-color="primary"
        align="left"
        class="q-mb-md"
      >
        <q-tab
          v-for="category in categories"
          :key="category.value"
          :name="category.value"
          :label="category.label"
          :icon="category.icon"
        />
      </q-tabs>

      <!-- Template Grid -->
      <div class="row q-col-gutter-md">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="col-12 col-sm-6 col-md-4"
        >
          <q-card
            flat
            bordered
            class="template-card cursor-pointer"
            @click="selectTemplate(template)"
          >
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon
                  :name="template.icon"
                  :color="template.color"
                  size="24px"
                  class="q-mr-sm"
                />
                <div class="text-subtitle2">{{ template.name }}</div>
              </div>
              
              <div class="text-caption text-grey-7 q-mb-md">
                {{ template.description }}
              </div>

              <q-chip
                v-for="tag in template.tags"
                :key="tag"
                size="sm"
                dense
                class="q-mr-xs q-mb-xs"
              >
                {{ tag }}
              </q-chip>

              <div class="row items-center q-mt-md">
                <div class="col">
                  <div class="text-caption text-grey-7">
                    Est. {{ template.estimatedDuration }}min
                  </div>
                </div>
                <div class="col-auto">
                  <q-rating
                    v-model="template.difficulty"
                    max="3"
                    size="12px"
                    color="orange"
                    readonly
                  />
                </div>
              </div>
            </q-card-section>

            <q-card-actions align="right">
              <q-btn
                flat
                size="sm"
                label="Use Template"
                color="primary"
                @click.stop="useTemplate(template)"
              />
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="mdi-information"
                @click.stop="showTemplateInfo(template)"
              />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </q-card-section>

    <!-- Template Info Dialog -->
    <q-dialog v-model="showInfoDialog">
      <q-card style="min-width: 400px">
        <q-card-section v-if="selectedTemplateInfo">
          <div class="text-h6">{{ selectedTemplateInfo.name }}</div>
          <div class="text-caption text-grey-7">
            {{ selectedTemplateInfo.category }} • {{ selectedTemplateInfo.estimatedDuration }}min
          </div>
        </q-card-section>

        <q-card-section v-if="selectedTemplateInfo">
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Description</div>
            <div>{{ selectedTemplateInfo.description }}</div>
          </div>

          <div class="q-mb-md" v-if="selectedTemplateInfo.requirements">
            <div class="text-subtitle2 q-mb-sm">Requirements</div>
            <q-list dense>
              <q-item
                v-for="req in selectedTemplateInfo.requirements"
                :key="req"
                dense
              >
                <q-item-section avatar>
                  <q-icon name="mdi-check" color="positive" size="16px" />
                </q-item-section>
                <q-item-section>{{ req }}</q-item-section>
              </q-item>
            </q-list>
          </div>

          <div v-if="selectedTemplateInfo.parameters">
            <div class="text-subtitle2 q-mb-sm">Default Parameters</div>
            <q-markup-table flat>
              <tbody>
                <tr v-for="(value, key) in selectedTemplateInfo.parameters" :key="key">
                  <td class="text-left">{{ key }}</td>
                  <td class="text-right">{{ value }}</td>
                </tr>
              </tbody>
            </q-markup-table>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
          <q-btn
            flat
            label="Use Template"
            color="primary"
            @click="useTemplate(selectedTemplateInfo!)"
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create Template Dialog -->
    <q-dialog v-model="showCreateDialog">
      <TaskTemplateCreator
        @created="onTemplateCreated"
        @cancel="showCreateDialog = false"
      />
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TaskTemplate } from '../../stores/types'
import TaskTemplateCreator from './TaskTemplateCreator.vue'

// TaskTemplate interface moved to types.ts

const emit = defineEmits<{
  templateSelected: [template: TaskTemplate]
}>()

// const taskStore = useTaskStore() // Commented out as it's not used

const selectedCategory = ref('mowing')
const showInfoDialog = ref(false)
const showCreateDialog = ref(false)
const selectedTemplateInfo = ref<TaskTemplate | null>(null)

const categories = [
  { label: 'Mowing', value: 'mowing', icon: 'mdi-grass' },
  { label: 'Survey', value: 'survey', icon: 'mdi-map-search' },
  { label: 'Maintenance', value: 'maintenance', icon: 'mdi-tools' },
  { label: 'Custom', value: 'custom', icon: 'mdi-puzzle' }
]

const templates: TaskTemplate[] = [
  {
    id: 'basic-mowing',
    name: 'Basic Lawn Mowing',
    description: 'Simple rectangular lawn mowing pattern',
    category: 'mowing',
    icon: 'mdi-grass',
    color: 'green',
    tags: ['beginner', 'rectangular'],
    difficulty: 1,
    estimatedDuration: 30,
    requirements: ['GPS lock', 'Battery > 80%'],
    parameters: {
      'pattern': 'parallel',
      'spacing': '2m',
      'speed': '1.5m/s',
      'height': '5cm'
    }
  },
  {
    id: 'complex-mowing',
    name: 'Complex Area Mowing',
    description: 'Advanced mowing with obstacle avoidance',
    category: 'mowing',
    icon: 'mdi-grass',
    color: 'green',
    tags: ['advanced', 'obstacles'],
    difficulty: 3,
    estimatedDuration: 60,
    requirements: ['GPS lock', 'Obstacle sensors', 'Battery > 90%'],
    parameters: {
      'pattern': 'adaptive',
      'spacing': '2m',
      'speed': '1.2m/s',
      'height': '4cm',
      'obstacles': 'detect'
    }
  },
  {
    id: 'perimeter-survey',
    name: 'Perimeter Survey',
    description: 'Survey area boundaries and mark obstacles',
    category: 'survey',
    icon: 'mdi-map-marker-path',
    color: 'blue',
    tags: ['mapping', 'boundaries'],
    difficulty: 2,
    estimatedDuration: 20,
    requirements: ['GPS lock', 'Camera'],
    parameters: {
      'altitude': '2m',
      'speed': '0.8m/s',
      'overlap': '20%',
      'resolution': 'high'
    }
  },
  {
    id: 'grid-survey',
    name: 'Grid Survey',
    description: 'Systematic grid pattern for area mapping',
    category: 'survey',
    icon: 'mdi-grid',
    color: 'blue',
    tags: ['mapping', 'systematic'],
    difficulty: 2,
    estimatedDuration: 45,
    requirements: ['GPS lock', 'Camera'],
    parameters: {
      'gridSize': '5m',
      'altitude': '3m',
      'speed': '1m/s',
      'overlap': '30%'
    }
  },
  {
    id: 'battery-check',
    name: 'Battery Health Check',
    description: 'Test battery performance under load',
    category: 'maintenance',
    icon: 'mdi-battery-check',
    color: 'orange',
    tags: ['diagnostic', 'battery'],
    difficulty: 1,
    estimatedDuration: 15,
    requirements: ['Battery > 50%'],
    parameters: {
      'testDuration': '10min',
      'loadLevel': 'medium',
      'monitoring': 'continuous'
    }
  },
  {
    id: 'sensor-calibration',
    name: 'Sensor Calibration',
    description: 'Calibrate all onboard sensors',
    category: 'maintenance',
    icon: 'mdi-tune',
    color: 'purple',
    tags: ['calibration', 'sensors'],
    difficulty: 2,
    estimatedDuration: 25,
    requirements: ['Stable surface', 'No wind'],
    parameters: {
      'sensors': ['compass', 'accelerometer', 'gyroscope'],
      'iterations': 3,
      'validation': true
    }
  }
]

const filteredTemplates = computed(() => 
  templates.filter(t => t.category === selectedCategory.value)
)

function selectTemplate(template: TaskTemplate) {
  emit('templateSelected', template)
}

function useTemplate(template: TaskTemplate) {
  emit('templateSelected', template)
}

function showTemplateInfo(template: TaskTemplate) {
  selectedTemplateInfo.value = template
  showInfoDialog.value = true
}

function onTemplateCreated(template: TaskTemplate) {
  templates.push(template)
  showCreateDialog.value = false
}
</script>

<style lang="scss" scoped>
.template-card {
  height: 100%;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
</style>