import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { UIState, Breadcrumb } from './types';

export const useUIStore = defineStore('ui', () => {
    // State
    const state = ref<UIState>({
        sidebar: {
            open: true,
            mini: false,
        },
        modals: {},
        dialogs: {},
        loading: {},
        theme: 'light',
        breadcrumbs: [],
        pageTitle: 'YardRover Dashboard',
    });

    // Getters
    const isSidebarOpen = computed(() => state.value.sidebar.open);
    const isSidebarMini = computed(() => state.value.sidebar.mini);
    const currentTheme = computed(() => state.value.theme);
    const pageTitle = computed(() => state.value.pageTitle);
    const breadcrumbs = computed(() => state.value.breadcrumbs);

    const isAnyModalOpen = computed(() =>
        Object.values(state.value.modals).some(isOpen => isOpen)
    );

    const isAnyDialogOpen = computed(() =>
        Object.values(state.value.dialogs).some(isOpen => isOpen)
    );

    const isAnyLoading = computed(() =>
        Object.values(state.value.loading).some(isLoading => isLoading)
    );

    const getModal = (modalName: string) => computed(() =>
        state.value.modals[modalName] || false
    );

    const getDialog = (dialogName: string) => computed(() =>
        state.value.dialogs[dialogName] || false
    );

    const getLoading = (componentName: string) => computed(() =>
        state.value.loading[componentName] || false
    );

    // Actions
    const toggleSidebar = () => {
        state.value.sidebar.open = !state.value.sidebar.open;
    };

    const setSidebarOpen = (open: boolean) => {
        state.value.sidebar.open = open;
    };

    const toggleSidebarMini = () => {
        state.value.sidebar.mini = !state.value.sidebar.mini;
    };

    const setSidebarMini = (mini: boolean) => {
        state.value.sidebar.mini = mini;
    };

    const setTheme = (theme: 'light' | 'dark') => {
        state.value.theme = theme;

        // Apply theme to document
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);

            // Update CSS custom properties for Quasar
            const root = document.documentElement;
            if (theme === 'dark') {
                root.style.setProperty('--q-dark', 'true');
            } else {
                root.style.setProperty('--q-dark', 'false');
            }
        }
    };

    const toggleTheme = () => {
        const newTheme = state.value.theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    };

    const setPageTitle = (title: string) => {
        state.value.pageTitle = title;

        // Update document title
        if (typeof document !== 'undefined') {
            document.title = `${title} - YardRover`;
        }
    };

    const setBreadcrumbs = (breadcrumbs: Breadcrumb[]) => {
        state.value.breadcrumbs = breadcrumbs;
    };

    const addBreadcrumb = (breadcrumb: Breadcrumb) => {
        state.value.breadcrumbs.push(breadcrumb);
    };

    const clearBreadcrumbs = () => {
        state.value.breadcrumbs = [];
    };

    // Modal management
    const openModal = (modalName: string) => {
        state.value.modals[modalName] = true;
    };

    const closeModal = (modalName: string) => {
        state.value.modals[modalName] = false;
    };

    const toggleModal = (modalName: string) => {
        state.value.modals[modalName] = !state.value.modals[modalName];
    };

    const closeAllModals = () => {
        Object.keys(state.value.modals).forEach(modalName => {
            state.value.modals[modalName] = false;
        });
    };

    // Dialog management
    const openDialog = (dialogName: string) => {
        state.value.dialogs[dialogName] = true;
    };

    const closeDialog = (dialogName: string) => {
        state.value.dialogs[dialogName] = false;
    };

    const toggleDialog = (dialogName: string) => {
        state.value.dialogs[dialogName] = !state.value.dialogs[dialogName];
    };

    const closeAllDialogs = () => {
        Object.keys(state.value.dialogs).forEach(dialogName => {
            state.value.dialogs[dialogName] = false;
        });
    };

    // Loading state management
    const setLoading = (componentName: string, loading: boolean) => {
        if (loading) {
            state.value.loading[componentName] = true;
        } else {
            delete state.value.loading[componentName];
        }
    };

    const startLoading = (componentName: string) => {
        setLoading(componentName, true);
    };

    const stopLoading = (componentName: string) => {
        setLoading(componentName, false);
    };

    const clearAllLoading = () => {
        state.value.loading = {};
    };

    // Responsive utilities
    const setResponsiveLayout = (breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
        switch (breakpoint) {
            case 'xs':
            case 'sm':
                // Mobile layout
                setSidebarOpen(false);
                setSidebarMini(false);
                break;
            case 'md':
                // Tablet layout
                setSidebarOpen(true);
                setSidebarMini(true);
                break;
            case 'lg':
            case 'xl':
                // Desktop layout
                setSidebarOpen(true);
                setSidebarMini(false);
                break;
        }
    };

    // Keyboard shortcuts
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
        // Ctrl/Cmd + B: Toggle sidebar
        if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
            event.preventDefault();
            toggleSidebar();
        }

        // Ctrl/Cmd + Shift + T: Toggle theme
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
            event.preventDefault();
            toggleTheme();
        }

        // Escape: Close modals and dialogs
        if (event.key === 'Escape') {
            if (isAnyModalOpen.value) {
                closeAllModals();
            } else if (isAnyDialogOpen.value) {
                closeAllDialogs();
            }
        }
    };

    // Animation utilities
    const slideIn = (element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left') => {
        const transforms = {
            left: 'translateX(-100%)',
            right: 'translateX(100%)',
            up: 'translateY(-100%)',
            down: 'translateY(100%)',
        };

        element.style.transform = transforms[direction];
        element.style.transition = 'transform 0.3s ease-in-out';

        // Trigger animation
        requestAnimationFrame(() => {
            element.style.transform = 'translate(0, 0)';
        });
    };

    const fadeIn = (element: HTMLElement, duration = 300) => {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms ease-in-out`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });
    };

    const slideOut = (element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'left') => {
        const transforms = {
            left: 'translateX(-100%)',
            right: 'translateX(100%)',
            up: 'translateY(-100%)',
            down: 'translateY(100%)',
        };

        element.style.transition = 'transform 0.3s ease-in-out';
        element.style.transform = transforms[direction];
    };

    const fadeOut = (element: HTMLElement, duration = 300) => {
        element.style.transition = `opacity ${duration}ms ease-in-out`;
        element.style.opacity = '0';
    };

    // Screen orientation and size utilities
    const getScreenInfo = () => {
        if (typeof window === 'undefined') {
            return {
                width: 1920,
                height: 1080,
                orientation: 'landscape',
                isMobile: false,
                isTablet: false,
                isDesktop: true,
            };
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        const orientation = width > height ? 'landscape' : 'portrait';

        return {
            width,
            height,
            orientation,
            isMobile: width < 768,
            isTablet: width >= 768 && width < 1024,
            isDesktop: width >= 1024,
        };
    };

    // Notification position utilities
    const getNotificationPosition = () => {
        const screenInfo = getScreenInfo();

        if (screenInfo.isMobile) {
            return { position: 'top', alignment: 'center' };
        } else {
            return { position: 'top-right', alignment: 'right' };
        }
    };

    // Fullscreen utilities
    const enterFullscreen = async (element?: HTMLElement) => {
        if (typeof document === 'undefined') return false;

        const targetElement = element || document.documentElement;

        try {
            if (targetElement.requestFullscreen) {
                await targetElement.requestFullscreen();
                return true;
            }
        } catch (error) {
            return false;
        }

        return false;
    };

    const exitFullscreen = async () => {
        if (typeof document === 'undefined') return false;

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
                return true;
            }
        } catch (error) {
            return false;
        }

        return false;
    };

    const isFullscreen = computed(() => {
        if (typeof document === 'undefined') return false;
        return !!document.fullscreenElement;
    });

    // Initialize theme from system preference or localStorage
    const initializeTheme = () => {
        if (typeof window === 'undefined') return;

        // Check localStorage first
        const savedTheme = localStorage.getItem('yardrover-theme') as 'light' | 'dark';
        if (savedTheme) {
            setTheme(savedTheme);
            return;
        }

        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    };

    // Save theme to localStorage when it changes
    const saveTheme = () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('yardrover-theme', state.value.theme);
        }
    };

    // Reset store state
    const $reset = () => {
        state.value = {
            sidebar: {
                open: true,
                mini: false,
            },
            modals: {},
            dialogs: {},
            loading: {},
            theme: 'light',
            breadcrumbs: [],
            pageTitle: 'YardRover Dashboard',
        };
    };

    return {
        // State
        state: computed(() => state.value),

        // Getters
        isSidebarOpen,
        isSidebarMini,
        currentTheme,
        pageTitle,
        breadcrumbs,
        isAnyModalOpen,
        isAnyDialogOpen,
        isAnyLoading,
        isFullscreen,
        getModal,
        getDialog,
        getLoading,

        // Sidebar actions
        toggleSidebar,
        setSidebarOpen,
        toggleSidebarMini,
        setSidebarMini,

        // Theme actions
        setTheme,
        toggleTheme,
        initializeTheme,
        saveTheme,

        // Navigation actions
        setPageTitle,
        setBreadcrumbs,
        addBreadcrumb,
        clearBreadcrumbs,

        // Modal actions
        openModal,
        closeModal,
        toggleModal,
        closeAllModals,

        // Dialog actions
        openDialog,
        closeDialog,
        toggleDialog,
        closeAllDialogs,

        // Loading actions
        setLoading,
        startLoading,
        stopLoading,
        clearAllLoading,

        // Responsive utilities
        setResponsiveLayout,
        getScreenInfo,
        getNotificationPosition,

        // Keyboard shortcuts
        handleKeyboardShortcut,

        // Animation utilities
        slideIn,
        fadeIn,
        slideOut,
        fadeOut,

        // Fullscreen utilities
        enterFullscreen,
        exitFullscreen,

        // Reset
        $reset,
    };
});
