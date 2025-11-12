import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(false);
  const isDarkMode = ref(false);
  const sidebarOpen = ref(true);
  const currentTheme = ref<'summer' | 'autumn' | 'winter' | 'spring'>('summer');
  
  // Getters
  const themeClass = computed(() => `theme-${currentTheme.value}`);
  
  // Actions
  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }
  
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
    // Apply dark mode to Quasar
    document.body.classList.toggle('body--dark', isDarkMode.value);
  }
  
  function setTheme(theme: typeof currentTheme.value) {
    currentTheme.value = theme;
  }
  
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }
  
  return {
    // State
    isLoading,
    isDarkMode,
    sidebarOpen,
    currentTheme,
    
    // Getters
    themeClass,
    
    // Actions
    setLoading,
    toggleDarkMode,
    setTheme,
    toggleSidebar
  };
});