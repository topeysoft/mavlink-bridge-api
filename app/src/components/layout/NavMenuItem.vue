<template>
  <q-item
    clickable
    v-ripple
    :to="path"
    :active="isActive"
    active-class="bg-primary text-white"
    class="nav-item"
  >
    <q-item-section avatar>
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ label }}</q-item-label>
      <q-item-label caption v-if="description">
        {{ description }}
      </q-item-label>
    </q-item-section>

    <q-item-section side v-if="badge">
      <q-badge :color="badge.color" :label="badge.label" />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface Props {
  label: string
  icon: string
  path: string
  description?: string
  badge?: {
    label: string
    color: string
  }
}

const props = defineProps<Props>()
const route = useRoute()

const isActive = computed(() => {
  return route.path === props.path || 
         (props.path !== '/' && route.path.startsWith(props.path))
})
</script>

<style lang="scss" scoped>
.nav-item {
  margin: 4px 8px;
  border-radius: 8px;
  
  &.bg-primary {
    .q-item__section--avatar {
      color: white;
    }
  }
}
</style>