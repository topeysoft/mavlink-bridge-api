import { ref, computed, onMounted, onUnmounted } from 'vue'

const collapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)

// Check if viewport is mobile size
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  // Auto-close on desktop
  if (!isMobile.value) {
    mobileOpen.value = false
  }
}

export function useSidebar() {
  const toggleSidebar = () => {
    if (isMobile.value) {
      mobileOpen.value = !mobileOpen.value
    } else {
      collapsed.value = !collapsed.value
    }
  }

  const closeMobileSidebar = () => {
    if (isMobile.value) {
      mobileOpen.value = false
    }
  }

  const mainContentMargin = computed(() => {
    if (isMobile.value) {
      return '0'
    }
    return collapsed.value ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'
  })

  const mainContentWidth = computed(() => {
    if (isMobile.value) {
      return '100%'
    }
    return collapsed.value ? 'calc(100% - var(--sidebar-collapsed-width))' : 'calc(100% - var(--sidebar-width))'
  })

  // Set up resize listener
  onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
  })

  return {
    collapsed,
    mobileOpen,
    isMobile,
    toggleSidebar,
    closeMobileSidebar,
    mainContentMargin,
    mainContentWidth
  }
}
