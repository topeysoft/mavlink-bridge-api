import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  // State
  const counter = ref(0)

  // Getters (computed)
  const doubleCount = computed(() => counter.value * 2)

  // Actions
  function increment() {
    counter.value++
  }

  function decrement() {
    counter.value--
  }

  function reset() {
    counter.value = 0
  }

  return {
    // State
    counter,
    
    // Getters
    doubleCount,
    
    // Actions
    increment,
    decrement,
    reset
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCounterStore, import.meta.hot))
}
