import { ref, watch, onMounted } from 'vue'
import { defineStore } from 'pinia'
import type { Theme } from '@/types'

type ThemeMode = 'manual' | 'auto' | 'time-based'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('yardrover_theme') as Theme) || 'light')
  const themeMode = ref<ThemeMode>((localStorage.getItem('yardrover_theme_mode') as ThemeMode) || 'manual')

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    themeMode.value = 'manual'
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    themeMode.value = 'manual'
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
    localStorage.setItem('yardrover_theme_mode', mode)
    updateThemeBasedOnMode()
  }

  function updateThemeBasedOnMode() {
    if (themeMode.value === 'auto') {
      // Follow system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    } else if (themeMode.value === 'time-based') {
      // Switch based on time (dark from 6 PM to 6 AM)
      const hour = new Date().getHours()
      theme.value = (hour >= 18 || hour < 6) ? 'dark' : 'light'
    }
    // If manual, theme stays as is
  }

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (themeMode.value === 'auto') {
        updateThemeBasedOnMode()
      }
    })

    // Check time-based theme every minute
    if (themeMode.value === 'time-based') {
      setInterval(() => {
        if (themeMode.value === 'time-based') {
          updateThemeBasedOnMode()
        }
      }, 60000) // Check every minute
    }
  }

  // Persist theme changes and update document
  watch(theme, (newTheme) => {
    localStorage.setItem('yardrover_theme', newTheme)
    document.body.setAttribute('data-theme', newTheme)
  }, { immediate: true })

  // Initialize theme based on mode
  watch(themeMode, (newMode) => {
    localStorage.setItem('yardrover_theme_mode', newMode)
    updateThemeBasedOnMode()
  }, { immediate: true })

  return {
    theme,
    themeMode,
    toggleTheme,
    setTheme,
    setThemeMode
  }
})
