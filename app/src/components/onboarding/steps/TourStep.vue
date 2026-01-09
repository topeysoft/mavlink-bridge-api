<script setup lang="ts">
import { ref, computed } from 'vue'
import type { UserType } from '@/stores/onboarding'

interface Props {
  userType: UserType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'complete': []
  'skip': []
}>()

const currentSlide = ref(0)

const isConsumerMode = computed(() => props.userType === 'consumer')

const slides = computed(() => {
  if (isConsumerMode.value) {
    return [
      {
        emoji: '🎯',
        title: 'Easy Task Management',
        description: 'Create jobs with just a few clicks using our step-by-step wizard'
      },
      {
        emoji: '🗺️',
        title: 'Simple Area Setup',
        description: 'Define where your YardRover should work with easy map tools'
      },
      {
        emoji: '📅',
        title: 'Smart Scheduling',
        description: 'Set up one-time or recurring jobs that run automatically'
      },
      {
        emoji: '🎮',
        title: 'Stay in Control',
        description: 'Monitor status and stop operations anytime with the Emergency Stop button'
      }
    ]
  } else {
    return [
      {
        emoji: '📊',
        title: 'Real-Time Monitoring',
        description: 'Track telemetry, system health, and vehicle status in real-time'
      },
      {
        emoji: '🎛️',
        title: 'Advanced Controls',
        description: 'Direct vehicle control, flight modes, and MAVLink command access'
      },
      {
        emoji: '⚙️',
        title: 'Configuration',
        description: 'Adjust parameters, calibration settings, and system configuration'
      },
      {
        emoji: '🔍',
        title: 'Diagnostics',
        description: 'Access logs, activity timeline, and detailed system diagnostics'
      }
    ]
  }
})

function nextSlide() {
  if (currentSlide.value < slides.value.length - 1) {
    currentSlide.value++
  } else {
    emit('complete')
  }
}

function previousSlide() {
  if (currentSlide.value > 0) {
    currentSlide.value--
  }
}

function skipTour() {
  emit('skip')
}
</script>

<template>
  <div class="tour-step">
    <div class="step-container">
      <div class="step-header">
        <h2>{{ isConsumerMode ? 'Quick Tour' : 'Feature Overview' }}</h2>
        <p class="step-description">
          {{ isConsumerMode 
            ? 'Let\'s show you around - it\'ll just take a minute!' 
            : 'A quick overview of key features and capabilities'
          }}
        </p>
      </div>

      <div class="tour-content">
        <!-- Progress Dots -->
        <div class="slide-indicators">
          <div
            v-for="(slide, index) in slides"
            :key="index"
            class="indicator"
            :class="{ active: index === currentSlide }"
          ></div>
        </div>

        <!-- Current Slide -->
        <Transition name="slide" mode="out-in">
          <div :key="currentSlide" class="slide">
            <div class="slide-emoji">{{ slides[currentSlide].emoji }}</div>
            <h3 class="slide-title">{{ slides[currentSlide].title }}</h3>
            <p class="slide-description">{{ slides[currentSlide].description }}</p>
          </div>
        </Transition>

        <!-- Navigation -->
        <div class="tour-navigation">
          <button
            v-if="currentSlide > 0"
            class="btn btn-outline"
            @click="previousSlide"
          >
            ← Back
          </button>
          <button
            class="btn btn-text"
            @click="skipTour"
          >
            Skip Tour
          </button>
          <button
            class="btn btn-primary"
            @click="nextSlide"
          >
            {{ currentSlide < slides.length - 1 ? 'Next →' : 'Get Started!' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.tour-step {
  padding: var(--spacing-2xl);
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.step-container {
  flex: 1;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.step-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);

  h2 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md);
  }

  .step-description {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
  }
}

.tour-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.slide-indicators {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-2xl);
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
  transition: all 0.3s;

  &.active {
    width: 32px;
    border-radius: 4px;
    background: $primary;
  }
}

.slide {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-2xl);
}

.slide-emoji {
  font-size: 96px;
  line-height: 1;
  margin-bottom: var(--spacing-xl);
}

.slide-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-md);
}

.slide-description {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  max-width: 500px;
}

.tour-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding-top: var(--spacing-xl);
}

// Slide Transition
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

// Responsive
@media (max-width: 768px) {
  .tour-step {
    padding: var(--spacing-lg);
  }

  .slide-emoji {
    font-size: 72px;
  }

  .slide-title {
    font-size: var(--font-size-xl);
  }

  .slide-description {
    font-size: var(--font-size-base);
  }

  .tour-navigation {
    flex-wrap: wrap;

    .btn {
      flex: 1;
      min-width: 100px;
    }
  }
}
</style>
