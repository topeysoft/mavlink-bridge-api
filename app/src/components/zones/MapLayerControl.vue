<script setup lang="ts">
import { ref } from 'vue'
import type { MapLayerType } from '@/composables/useLeafletMap'

interface Props {
  currentLayer: MapLayerType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'change', layerType: MapLayerType): void
}>()

const isOpen = ref(false)

const layerOptions = [
  {
    type: 'streets' as MapLayerType,
    label: 'Streets',
    icon: '🗺️',
    description: 'Standard street map'
  },
  {
    type: 'satellite' as MapLayerType,
    label: 'Satellite',
    icon: '🛰️',
    description: 'Satellite imagery'
  },
  {
    type: 'terrain' as MapLayerType,
    label: 'Terrain',
    icon: '⛰️',
    description: 'Topographic map'
  },
  {
    type: 'dark' as MapLayerType,
    label: 'Dark',
    icon: '🌙',
    description: 'Dark theme'
  }
]

const handleLayerSelect = (layerType: MapLayerType) => {
  emit('change', layerType)
  isOpen.value = false
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.layer-control')) {
    closeDropdown()
  }
}

// Add global click listener when dropdown is open
import { onMounted, onUnmounted, watch } from 'vue'

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const currentLayerOption = layerOptions.find(opt => opt.type === props.currentLayer) || layerOptions[0]
</script>

<template>
  <div class="layer-control">
    <button
      class="layer-control-button"
      @click.stop="toggleDropdown"
      :title="`Current layer: ${currentLayerOption.label}`"
    >
      <span class="layer-icon">{{ currentLayerOption.icon }}</span>
      <span class="layer-label">{{ currentLayerOption.label }}</span>
      <svg
        class="dropdown-icon"
        :class="{ rotated: isOpen }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <transition name="dropdown">
      <div v-if="isOpen" class="layer-dropdown">
        <button
          v-for="option in layerOptions"
          :key="option.type"
          class="layer-option"
          :class="{ active: option.type === currentLayer }"
          @click="handleLayerSelect(option.type)"
        >
          <span class="option-icon">{{ option.icon }}</span>
          <div class="option-content">
            <div class="option-label">{{ option.label }}</div>
            <div class="option-description">{{ option.description }}</div>
          </div>
          <svg
            v-if="option.type === currentLayer"
            class="check-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.layer-control {
  position: relative;
  z-index: 1000;
}

.layer-control-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);

  &:hover {
    background: var(--bg-tertiary);
    box-shadow: var(--shadow-md);
  }

  .layer-icon {
    font-size: 18px;
  }

  .layer-label {
    min-width: 70px;
    text-align: left;
  }

  .dropdown-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.layer-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1001;
}

.layer-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.active {
    background: var(--bg-tertiary);
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }

  .option-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .option-content {
    flex: 1;
  }

  .option-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .option-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .check-icon {
    width: 18px;
    height: 18px;
    color: var(--primary-green);
    flex-shrink: 0;
  }
}

// Dropdown animations
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
