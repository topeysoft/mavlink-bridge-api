import { createPinia } from 'pinia';
import { markRaw } from 'vue';
import type { Router } from 'vue-router';

// Store plugins
import { persistencePlugin } from './plugins/persistence';
import { websocketPlugin } from './plugins/websocket';
import { devtoolsPlugin } from './plugins/devtools';

// Create Pinia instance
export const pinia = createPinia();

// Plugin to add router to all stores
export function routerPlugin (router: Router) {
    return ({ store }: any) => {
        store.router = markRaw(router);
    };
}

// Setup store plugins
export function setupStorePlugins (router: Router) {
    // Add router to stores
    pinia.use(routerPlugin(router));

    // Add persistence plugin
    pinia.use(persistencePlugin);

    // Add WebSocket plugin
    pinia.use(websocketPlugin);

    // Add devtools plugin in development
    if (import.meta.env.DEV) {
        pinia.use(devtoolsPlugin);
    }
}

// Export all stores
export * from './auth';
export * from './machine';
export * from './tasks';
export * from './yard';
export * from './settings';
export * from './notifications';
export * from './websocket';
export * from './ui';

// Export store composition helpers
export * from './composables/useStores';
export * from './composables/useRealTime';

// Export store types
export * from './types';

export default pinia;
