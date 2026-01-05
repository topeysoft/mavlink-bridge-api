<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
import { useFeaturesStore } from '@/stores/features'

interface MissionTemplate {
  id: number
  name: string
  emoji: string
  description: string
  estimatedTime: string
}

interface Props {
  template: MissionTemplate
}

defineProps<Props>()

const emit = defineEmits<{
  use: [id: number]
}>()

const featuresStore = useFeaturesStore()
const isConsumerMode = computed(() => featuresStore.userMode === 'consumer')
</script>

<template>
  <Card :class="{ 'consumer-card': isConsumerMode }">
    <div class="template-content" :class="{ 'consumer-layout': isConsumerMode }">
      <div class="template-header" :class="{ 'consumer-header': isConsumerMode }">
        <span class="template-emoji">{{ template.emoji }}</span>
        <h3 class="template-name">{{ template.name }}</h3>
      </div>
      <p class="template-description">{{ template.description }}</p>
      <div class="template-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>{{ template.estimatedTime }}</span>
      </div>
      <Button variant="primary" full-width @click="emit('use', template.id)">
        {{ isConsumerMode ? 'Start This Job' : 'Use Template' }}
      </Button>
    </div>
  </Card>
</template>

<style scoped lang="scss">
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
  font-size: 56px;
}

.template-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.consumer-layout .template-name {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.template-description {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.consumer-layout .template-description {
  font-size: var(--font-size-base);
  text-align: center;
  min-height: 3em;
}

.template-meta {
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

.consumer-layout .template-meta {
  justify-content: center;
  font-size: var(--font-size-base);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.consumer-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  }
}
</style>
