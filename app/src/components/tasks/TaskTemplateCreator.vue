<template>
  <q-card style="min-width: 500px">
    <q-card-section>
      <div class="text-h6">Create Custom Template</div>
      <div class="text-caption text-grey-7">Define a new task template</div>
    </q-card-section>

    <q-card-section class="q-gutter-md">
      <q-input
        v-model="templateData.name"
        label="Template Name"
        :rules="[val => !!val || 'Name is required']"
      />
      
      <q-textarea
        v-model="templateData.description"
        label="Description"
        rows="3"
      />

      <q-select
        v-model="templateData.category"
        :options="categoryOptions"
        label="Category"
        emit-value
        map-options
      />

      <q-input
        v-model.number="templateData.estimatedDuration"
        label="Estimated Duration (minutes)"
        type="number"
        min="1"
      />
    </q-card-section>

    <q-card-actions align="right">
      <q-btn flat label="Cancel" @click="$emit('cancel')" />
      <q-btn
        color="primary"
        label="Create Template"
        @click="createTemplate"
        :disable="!templateData.name"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TaskTemplate } from '../../stores/types'

const emit = defineEmits<{
  created: [template: TaskTemplate]
  cancel: []
}>()

const templateData = ref({
  name: '',
  description: '',
  category: 'custom',
  estimatedDuration: 30
})

const categoryOptions = [
  { label: 'Mowing', value: 'mowing' },
  { label: 'Survey', value: 'survey' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Custom', value: 'custom' }
]

function createTemplate() {
  const newTemplate = {
    id: Date.now().toString(),
    ...templateData.value,
    icon: 'mdi-puzzle',
    color: 'grey',
    tags: ['custom'],
    difficulty: 2,
    requirements: [],
    parameters: {}
  }
  
  emit('created', newTemplate)
}
</script>