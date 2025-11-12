// Export all stores
export { useAppStore } from './app';
export { useConnectionStore } from './connection';
export { useDevicesStore } from './devices';
export { useUserPreferencesStore } from './user-preferences';

import { store } from 'quasar/wrappers';
import { createPinia } from 'pinia';

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default store((/* { ssrContext } */) => {
    const pinia = createPinia();

    // You can add Pinia plugins here
    // pinia.use(SomePiniaPlugin)

    return pinia;
});
