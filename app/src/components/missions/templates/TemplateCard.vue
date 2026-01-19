<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import Badge from '@/components/common/Badge.vue'
import { useFeaturesStore } from '@/stores/features'
import { useMissionTemplatesStore } from '@/stores/missionTemplates'
import type { MissionTemplateSummary } from '@client'

interface Props {
  template: MissionTemplateSummary
  showCategory?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCategory: false
})

const emit = defineEmits<{
  select: [templateId: string]
}>()

const featuresStore = useFeaturesStore()
const templatesStore = useMissionTemplatesStore()

const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')

const displayName = computed(() =>
  templatesStore.getTemplateName(props.template)
)

const displayDescription = computed(() =>
  templatesStore.getTemplateDescription(props.template)
)

const estimatedTimeLabel = computed(() => {
  const mins = props.template.estimated_time_per_acre
  if (isConsumerMode.value) {
    return `About ${mins} min/acre`
  }
  return `~${mins} min/acre`
})

function handleSelect() {
  emit('select', props.template.id)
}
</script>

<template>
  <Card
    :class="[
      'template-card',
      { 'consumer-card': isConsumerMode, 'unavailable': !template.available }
    ]"
    @click="handleSelect"
  >
    <div class="template-content" :class="{ 'consumer-layout': isConsumerMode }">
      <div class="template-header" :class="{ 'consumer-header': isConsumerMode }">
        <span class="template-emoji">{{ template.emoji }}</span>
        <h3 class="template-name">{{ displayName }}</h3>
      </div>

      <p class="template-description">{{ displayDescription }}</p>

      <div class="template-meta">
        <div class="time-estimate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{{ estimatedTimeLabel }}</span>
        </div>

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

      <Button
        variant="primary"
        full-width
        :disabled="!template.available"
        @click.stop="handleSelect"
      >
        {{ isConsumerMode ? 'Choose This' : 'Use Template' }}
      </Button>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.template-card {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.unavailable) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }

  &.unavailable {
    opacity: 0.7;
    cursor: not-allowed;
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
</style>
