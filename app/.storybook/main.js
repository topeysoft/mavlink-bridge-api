const { join, dirname } = require('path');

/**
 * This function is used to resolve the absolute path of a package.
 */
function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}

module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)'],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/vue3-vite'),
    options: {},
  },
  viteFinal: async (config, { configType }) => {
    const { mergeConfig } = await import('vite');
    const vue = await import('@vitejs/plugin-vue');
    const path = require('path');
    
    return mergeConfig(config, {
      plugins: [vue.default()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
        },
      },
      define: {
        global: 'globalThis',
      },
      css: {
        preprocessorOptions: {
          scss: {
            additionalData: `@import "@/assets/styles/variables";`,
          },
        },
      },
      server: {
        fs: {
          allow: ['..'],
        },
      },
    });
  },
  staticDirs: ['../public'],
};