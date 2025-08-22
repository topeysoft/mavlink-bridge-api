<template>
  <q-expansion-item
    :icon="icon"
    :label="label"
    :caption="caption"
    :default-opened="defaultOpened"
    header-class="text-primary"
    class="config-section"
  >
    <q-card>
      <q-card-section>
        <div v-if="loading" class="row justify-center q-py-lg">
          <q-spinner-dots color="primary" size="40px" />
        </div>
        
        <div v-else-if="error" class="text-negative">
          <q-icon name="error" size="24px" class="q-mr-sm" />
          {{ error }}
        </div>
        
        <div v-else>
          <slot />
        </div>
      </q-card-section>
      
      <q-separator v-if="showActions" />
      
      <q-card-actions v-if="showActions" align="right">
        <q-btn
          flat
          label="Reset"
          color="negative"
          @click="$emit('reset')"
          :disable="!isDirty"
        />
        <q-btn
          flat
          label="Save"
          color="primary"
          @click="$emit('save')"
          :loading="saving"
          :disable="!isDirty || hasErrors"
        />
      </q-card-actions>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
interface Props {
  label: string
  caption?: string
  icon?: string
  defaultOpened?: boolean
  loading?: boolean
  saving?: boolean
  error?: string | null
  isDirty?: boolean
  hasErrors?: boolean
  showActions?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: 'settings',
  defaultOpened: false,
  loading: false,
  saving: false,
  isDirty: false,
  hasErrors: false,
  showActions: true
})

defineEmits<{
  save: []
  reset: []
}>()
</script>

<style lang="scss" scoped>
.config-section {
  margin-bottom: 16px;
  
  :deep(.q-expansion-item__container) {
    .q-item {
      background: $grey-1;
      
      .body--dark & {
        background: $grey-9;
      }
    }
  }
}
</style>