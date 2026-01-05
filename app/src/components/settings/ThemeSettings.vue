<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import Card from '@/components/common/Card.vue'

const themeStore = useThemeStore()

const themeModes = [
  {
    value: 'manual' as const,
    label: 'Manual',
    description: 'Manually toggle between light and dark themes',
    icon: 'hand'
  },
  {
    value: 'auto' as const,
    label: 'Auto (System)',
    description: 'Follow your system\'s dark mode preference',
    icon: 'monitor'
  },
  {
    value: 'time-based' as const,
    label: 'Time-Based',
    description: 'Dark mode from 6 PM to 6 AM',
    icon: 'clock'
  }
]
</script>

<template>
  <Card title="Theme & Appearance" subtitle="Customize the look and feel of YardRover">
    <div class="theme-settings">
      <div class="theme-mode-options">
        <div
          v-for="mode in themeModes"
          :key="mode.value"
          class="mode-option"
          :class="{ active: themeStore.themeMode === mode.value }"
          @click="themeStore.setThemeMode(mode.value)"
        >
          <div class="mode-icon">
            <svg v-if="mode.icon === 'hand'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
            </svg>
            <svg v-else-if="mode.icon === 'monitor'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <svg v-else-if="mode.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="mode-content">
            <div class="mode-header">
              <span class="mode-label">{{ mode.label }}</span>
              <div v-if="themeStore.themeMode === mode.value" class="mode-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <p class="mode-description">{{ mode.description }}</p>
          </div>
        </div>
      </div>

      <div v-if="themeStore.themeMode === 'manual'" class="theme-preview">
        <h4>Current Theme</h4>
        <div class="preview-options">
          <button
            class="preview-option"
            :class="{ active: themeStore.theme === 'light' }"
            @click="themeStore.setTheme('light')"
          >
            <div class="preview-sample light">
              <div class="sample-bar"></div>
              <div class="sample-content">
                <div class="sample-card"></div>
                <div class="sample-card"></div>
              </div>
            </div>
            <span class="preview-label">Light</span>
          </button>
          <button
            class="preview-option"
            :class="{ active: themeStore.theme === 'dark' }"
            @click="themeStore.setTheme('dark')"
          >
            <div class="preview-sample dark">
              <div class="sample-bar"></div>
              <div class="sample-content">
                <div class="sample-card"></div>
                <div class="sample-card"></div>
              </div>
            </div>
            <span class="preview-label">Dark</span>
          </button>
        </div>
      </div>

      <div v-else class="info-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <strong>{{ themeStore.themeMode === 'auto' ? 'System Preference Active' : 'Time-Based Switching Active' }}</strong>
          <p v-if="themeStore.themeMode === 'auto'">
            Theme will automatically match your operating system's dark mode setting
          </p>
          <p v-else>
            Dark mode active from 6:00 PM to 6:00 AM, light mode during the day
          </p>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.theme-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.theme-mode-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.mode-option {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
    transform: translateX(4px);
  }

  &.active {
    border-color: var(--primary-green);
    background: rgba(44, 95, 45, 0.1);

    .mode-icon {
      background: var(--primary-green);
      color: white;
    }
  }
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius);
  background: var(--bg-primary);
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: all 0.2s;

  svg {
    width: 24px;
    height: 24px;
  }
}

.mode-content {
  flex: 1;
}

.mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
}

.mode-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.mode-check {
  color: var(--primary-green);

  svg {
    width: 20px;
    height: 20px;
  }
}

.mode-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.theme-preview {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);

  h4 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-primary);
  }
}

.preview-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.preview-option {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: none;
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--primary-green);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--primary-green);
    box-shadow: 0 0 0 3px rgba(44, 95, 45, 0.1);
  }
}

.preview-sample {
  height: 100px;
  border-radius: var(--border-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.light {
    background: #f5f5f5;

    .sample-bar {
      background: white;
      border-bottom: 1px solid #e0e0e0;
    }

    .sample-card {
      background: white;
      border: 1px solid #e0e0e0;
    }
  }

  &.dark {
    background: #1a1a1a;

    .sample-bar {
      background: #2d2d2d;
      border-bottom: 1px solid #404040;
    }

    .sample-card {
      background: #2d2d2d;
      border: 1px solid #404040;
    }
  }
}

.sample-bar {
  height: 20px;
}

.sample-content {
  flex: 1;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.sample-card {
  flex: 1;
  border-radius: 4px;
}

.preview-label {
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.info-box {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(135, 206, 235, 0.1);
  border: 1px solid var(--sky-blue);
  border-radius: var(--border-radius-lg);
  color: var(--text-primary);

  svg {
    width: 24px;
    height: 24px;
    color: var(--sky-blue);
    flex-shrink: 0;
  }

  strong {
    display: block;
    margin-bottom: var(--spacing-xs);
  }

  p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}
</style>
