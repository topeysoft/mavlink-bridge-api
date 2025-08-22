<template>
  <div class="row q-col-gutter-md">
    <div
      v-for="(item, index) in items"
      :key="index"
      :class="colClasses"
    >
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  items: unknown[]
  cols?: {
    xs?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  cols: () => ({
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3,
    xl: 3
  })
})

const colClasses = computed(() => {
  const classes = []
  const { cols } = props
  
  if (cols.xs) classes.push(`col-xs-${cols.xs}`)
  if (cols.sm) classes.push(`col-sm-${cols.sm}`)
  if (cols.md) classes.push(`col-md-${cols.md}`)
  if (cols.lg) classes.push(`col-lg-${cols.lg}`)
  if (cols.xl) classes.push(`col-xl-${cols.xl}`)
  
  return classes.join(' ')
})
</script>