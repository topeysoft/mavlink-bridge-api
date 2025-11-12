import { setup } from '@storybook/vue3';
import { Quasar, Notify, Dialog } from 'quasar';
import { createPinia } from 'pinia';

// Import Quasar css first
import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';

// Import custom styles after Quasar
import '../src/assets/styles/main.scss';

// Setup Quasar and Pinia with custom brand colors
setup((app) => {
  app.use(createPinia());
  app.use(Quasar, {
    plugins: {
      Notify,
      Dialog,
    },
    config: {
      brand: {
        primary: '#2C5F2D',     // Forest Green
        secondary: '#87CEEB',   // Sky Blue
        accent: '#FF6B35',      // Sunset Orange
        positive: '#21BA45',    // Success Green
        negative: '#C10015',    // Error Red
        info: '#31CCEC',        // Info Blue
        warning: '#F2C037',     // Warning Yellow
        dark: '#3E2723',        // Dark Earth
        'dark-page': '#2C2C2C'
      }
    }
  });
});

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F5F5DC' }, // Soft Beige from theme
        { name: 'white', value: '#FFFFFF' },
        { name: 'dark', value: '#3E2723' }, // Dark Earth from theme
      ],
    },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="padding: 20px; min-height: 100vh;">
          <story />
        </div>
      `,
    }),
  ],
};