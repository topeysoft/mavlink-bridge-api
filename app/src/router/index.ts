import { route } from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router';
import routes, { RouteMeta } from './routes';

declare module 'vue-router' {
  interface RouteMeta extends RouteMeta {}
}

export default route(function ({ store }) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory);

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE)
  });

  // Add route guards
  Router.beforeEach(async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ) => {
    // Import stores dynamically to avoid circular dependencies
    const { useUserStore } = await import('@/stores/user');
    const { useConnectionStore } = await import('@/stores/connection');
    
    const userStore = useUserStore(store);
    const connectionStore = useConnectionStore(store);

    // Update document title
    if (to.meta?.title) {
      document.title = `${to.meta.title} - YardRover Control`;
    } else {
      document.title = 'YardRover Control';
    }

    // Check authentication
    if (to.meta?.requiresAuth && !userStore.isAuthenticated) {
      // Redirect to login with return URL
      return next({ 
        name: 'login', 
        query: { redirect: to.fullPath } 
      });
    }

    // Check connection requirement
    if (to.meta?.requiresConnection && !connectionStore.isConnected) {
      // Show notification and redirect to connection page
      const { Notify } = await import('quasar');
      Notify.create({
        type: 'warning',
        message: 'Device connection required',
        caption: 'Please connect to a device first',
        position: 'top'
      });
      return next({ name: 'connection' });
    }
    
    next();
  });

  // Add route transition animations
  Router.afterEach((to) => {
    if (to.meta?.transition) {
      document.documentElement.setAttribute('data-route-transition', to.meta.transition);
    }
  });

  return Router;
});

export { routes };