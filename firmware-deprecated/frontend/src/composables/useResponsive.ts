import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface Breakpoints {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface ScreenInfo {
  width: number
  height: number
  breakpoint: keyof Breakpoints
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  orientation: 'portrait' | 'landscape'
  devicePixelRatio: number
  touchSupported: boolean
}

export function useResponsive(customBreakpoints?: Partial<Breakpoints>) {
  // Default breakpoints (matching Quasar)
  const defaultBreakpoints: Breakpoints = {
    xs: 0,
    sm: 600,
    md: 1024,
    lg: 1440,
    xl: 1920,
    xxl: 2560
  }
  
  const breakpoints = ref<Breakpoints>({
    ...defaultBreakpoints,
    ...customBreakpoints
  })
  
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 768)
  const resizeObserver = ref<ResizeObserver | null>(null)
  const mediaQueryListeners = ref<Map<string, MediaQueryList>>(new Map())
  
  // Computed properties
  const currentBreakpoint = computed((): keyof Breakpoints => {
    const width = windowWidth.value
    const bp = breakpoints.value
    
    if (width >= bp.xxl) return 'xxl'
    if (width >= bp.xl) return 'xl'
    if (width >= bp.lg) return 'lg'
    if (width >= bp.md) return 'md'
    if (width >= bp.sm) return 'sm'
    return 'xs'
  })
  
  const screenInfo = computed((): ScreenInfo => {
    const width = windowWidth.value
    const height = windowHeight.value
    const breakpoint = currentBreakpoint.value
    
    return {
      width,
      height,
      breakpoint,
      isMobile: breakpoint === 'xs',
      isTablet: breakpoint === 'sm' || breakpoint === 'md',
      isDesktop: ['lg', 'xl', 'xxl'].includes(breakpoint),
      orientation: width > height ? 'landscape' : 'portrait',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      touchSupported: typeof window !== 'undefined' ? 'ontouchstart' in window : false
    }
  })
  
  // Breakpoint checks
  const isXs = computed(() => currentBreakpoint.value === 'xs')
  const isSm = computed(() => currentBreakpoint.value === 'sm')
  const isMd = computed(() => currentBreakpoint.value === 'md')
  const isLg = computed(() => currentBreakpoint.value === 'lg')
  const isXl = computed(() => currentBreakpoint.value === 'xl')
  const isXxl = computed(() => currentBreakpoint.value === 'xxl')
  
  // Range checks
  const isSmAndUp = computed(() => windowWidth.value >= breakpoints.value.sm)
  const isMdAndUp = computed(() => windowWidth.value >= breakpoints.value.md)
  const isLgAndUp = computed(() => windowWidth.value >= breakpoints.value.lg)
  const isXlAndUp = computed(() => windowWidth.value >= breakpoints.value.xl)
  
  const isSmAndDown = computed(() => windowWidth.value < breakpoints.value.md)
  const isMdAndDown = computed(() => windowWidth.value < breakpoints.value.lg)
  const isLgAndDown = computed(() => windowWidth.value < breakpoints.value.xl)
  
  // Device type checks
  const isMobile = computed(() => screenInfo.value.isMobile)
  const isTablet = computed(() => screenInfo.value.isTablet)
  const isDesktop = computed(() => screenInfo.value.isDesktop)
  const isTouch = computed(() => screenInfo.value.touchSupported)
  
  // Orientation
  const isPortrait = computed(() => screenInfo.value.orientation === 'portrait')
  const isLandscape = computed(() => screenInfo.value.orientation === 'landscape')
  
  // Utility methods
  function matchBreakpoint(breakpoint: keyof Breakpoints): boolean {
    return currentBreakpoint.value === breakpoint
  }
  
  function matchBreakpoints(breakpoints: Array<keyof Breakpoints>): boolean {
    return breakpoints.includes(currentBreakpoint.value)
  }
  
  function greaterThan(breakpoint: keyof Breakpoints): boolean {
    const currentWidth = windowWidth.value
    const breakpointWidth = breakpoints.value[breakpoint]
    return currentWidth > breakpointWidth
  }
  
  function lessThan(breakpoint: keyof Breakpoints): boolean {
    const currentWidth = windowWidth.value
    const breakpointWidth = breakpoints.value[breakpoint]
    return currentWidth < breakpointWidth
  }
  
  function between(min: keyof Breakpoints, max: keyof Breakpoints): boolean {
    const currentWidth = windowWidth.value
    const minWidth = breakpoints.value[min]
    const maxWidth = breakpoints.value[max]
    return currentWidth >= minWidth && currentWidth < maxWidth
  }
  
  // CSS classes helper
  function getResponsiveClasses(prefix = 'screen'): Record<string, boolean> {
    return {
      [`${prefix}-xs`]: isXs.value,
      [`${prefix}-sm`]: isSm.value,
      [`${prefix}-md`]: isMd.value,
      [`${prefix}-lg`]: isLg.value,
      [`${prefix}-xl`]: isXl.value,
      [`${prefix}-xxl`]: isXxl.value,
      [`${prefix}-mobile`]: isMobile.value,
      [`${prefix}-tablet`]: isTablet.value,
      [`${prefix}-desktop`]: isDesktop.value,
      [`${prefix}-touch`]: isTouch.value,
      [`${prefix}-no-touch`]: !isTouch.value,
      [`${prefix}-portrait`]: isPortrait.value,
      [`${prefix}-landscape`]: isLandscape.value
    }
  }
  
  // Value based on breakpoint
  function getValue<T>(values: Partial<Record<keyof Breakpoints, T>>, fallback?: T): T | undefined {
    const bp = currentBreakpoint.value
    
    // Try exact match first
    if (values[bp] !== undefined) {
      return values[bp]
    }
    
    // Try to find the closest smaller breakpoint
    const bpOrder: Array<keyof Breakpoints> = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs']
    const currentIndex = bpOrder.indexOf(bp)
    
    for (let i = currentIndex + 1; i < bpOrder.length; i++) {
      const checkBp = bpOrder[i]
      if (values[checkBp] !== undefined) {
        return values[checkBp]
      }
    }
    
    return fallback
  }
  
  // Grid column calculation
  function getColumns(columns: Partial<Record<keyof Breakpoints, number>>, defaultCols = 12): number {
    return getValue(columns, defaultCols) || defaultCols
  }
  
  // Responsive spacing
  function getSpacing(spacing: Partial<Record<keyof Breakpoints, string | number>>, defaultSpacing = '16px'): string | number {
    return getValue(spacing, defaultSpacing) || defaultSpacing
  }
  
  // Custom media query matching
  function matchMedia(query: string): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  }
  
  function watchMediaQuery(query: string, callback: (matches: boolean) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {}
    }
    
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => callback(e.matches)
    
    // Initial call
    callback(mql.matches)
    
    mql.addListener(handler)
    mediaQueryListeners.value.set(query, mql)
    
    return () => {
      mql.removeListener(handler)
      mediaQueryListeners.value.delete(query)
    }
  }
  
  // Container size calculation
  function getContainerWidth(maxWidth?: keyof Breakpoints): number {
    if (!maxWidth) return windowWidth.value
    
    const maxWidthPx = breakpoints.value[maxWidth]
    return Math.min(windowWidth.value, maxWidthPx)
  }
  
  // Font size scaling
  function getScaledFontSize(baseSize: number, scaling: Partial<Record<keyof Breakpoints, number>> = {}): number {
    const scale = getValue(scaling, 1) || 1
    return baseSize * scale
  }
  
  // Component size helpers
  function getComponentSize<T extends string>(
    sizes: Partial<Record<keyof Breakpoints, T>>,
    fallback: T
  ): T {
    return getValue(sizes, fallback) || fallback
  }
  
  // Layout helpers
  function shouldStack(stackAt: keyof Breakpoints = 'md'): boolean {
    return lessThan(stackAt)
  }
  
  function shouldWrap(wrapAt: keyof Breakpoints = 'md'): boolean {
    return lessThan(wrapAt)
  }
  
  function getFlexDirection(
    directions: Partial<Record<keyof Breakpoints, 'row' | 'column'>> = {},
    defaultDirection: 'row' | 'column' = 'row'
  ): 'row' | 'column' {
    return getValue(directions, defaultDirection) || defaultDirection
  }
  
  // Visibility helpers
  function isVisible(
    visibility: Partial<Record<keyof Breakpoints, boolean>> = {}
  ): boolean {
    return getValue(visibility, true) !== false
  }
  
  function isHidden(
    visibility: Partial<Record<keyof Breakpoints, boolean>> = {}
  ): boolean {
    return !isVisible(visibility)
  }
  
  // Event handlers
  function handleResize(): void {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }
  
  // Custom breakpoint management
  function updateBreakpoints(newBreakpoints: Partial<Breakpoints>): void {
    breakpoints.value = { ...breakpoints.value, ...newBreakpoints }
  }
  
  function resetBreakpoints(): void {
    breakpoints.value = { ...defaultBreakpoints }
  }
  
  // Debug helpers
  function getDebugInfo(): Record<string, any> {
    return {
      windowSize: { width: windowWidth.value, height: windowHeight.value },
      breakpoint: currentBreakpoint.value,
      breakpoints: breakpoints.value,
      screenInfo: screenInfo.value,
      flags: {
        isMobile: isMobile.value,
        isTablet: isTablet.value,
        isDesktop: isDesktop.value,
        isTouch: isTouch.value,
        isPortrait: isPortrait.value,
        isLandscape: isLandscape.value
      }
    }
  }
  
  // Lifecycle
  onMounted(() => {
    if (typeof window !== 'undefined') {
      // Initial values
      windowWidth.value = window.innerWidth
      windowHeight.value = window.innerHeight
      
      // Add resize listener
      window.addEventListener('resize', handleResize, { passive: true })
      
      // Set up ResizeObserver if available
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver.value = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.target === document.documentElement) {
              windowWidth.value = entry.contentRect.width
              windowHeight.value = entry.contentRect.height
            }
          }
        })
        
        resizeObserver.value.observe(document.documentElement)
      }
    }
  })
  
  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize)
    }
    
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
    }
    
    // Clean up media query listeners
    mediaQueryListeners.value.clear()
  })
  
  return {
    // Screen info
    windowWidth: computed(() => windowWidth.value),
    windowHeight: computed(() => windowHeight.value),
    screenInfo,
    currentBreakpoint,
    breakpoints: computed(() => breakpoints.value),
    
    // Breakpoint checks
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl,
    
    // Range checks
    isSmAndUp,
    isMdAndUp,
    isLgAndUp,
    isXlAndUp,
    isSmAndDown,
    isMdAndDown,
    isLgAndDown,
    
    // Device checks
    isMobile,
    isTablet,
    isDesktop,
    isTouch,
    isPortrait,
    isLandscape,
    
    // Utility methods
    matchBreakpoint,
    matchBreakpoints,
    greaterThan,
    lessThan,
    between,
    getValue,
    getColumns,
    getSpacing,
    getResponsiveClasses,
    matchMedia,
    watchMediaQuery,
    getContainerWidth,
    getScaledFontSize,
    getComponentSize,
    shouldStack,
    shouldWrap,
    getFlexDirection,
    isVisible,
    isHidden,
    
    // Configuration
    updateBreakpoints,
    resetBreakpoints,
    
    // Debug
    getDebugInfo
  }
}