import { createApp } from 'vue';
import { Quasar, Notify, Loading, Dialog, LoadingBar, LocalStorage, SessionStorage } from 'quasar';
import router from '@/router';
import { createPinia } from 'pinia';

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css';

// Import Quasar css
import 'quasar/src/css/index.sass';

// Import app styles
import '@/assets/styles/main.scss';

import App from './App.vue';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(Quasar, {
  plugins: {
    Notify,
    Loading,
    Dialog,
    LoadingBar,
    LocalStorage,
    SessionStorage
  }
});

app.mount('#app');