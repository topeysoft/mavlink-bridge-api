import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Notify, Dialog, Loading } from 'quasar'
import { createRouter, createWebHistory } from 'vue-router'

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css'
import '@quasar/extras/material-icons-outlined/material-icons-outlined.css'
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css'

// Import Quasar css
import 'quasar/src/css/index.sass'

// Import custom styles
import './styles/main.scss'

import App from './App.vue'
import { routes } from './router/routes'

const router = createRouter({
    history: createWebHistory(),
    routes
})

const pinia = createPinia()

const app = createApp(App)

app.use(Quasar, {
    plugins: {
        Notify,
        Dialog,
        Loading
    },
    config: {
        notify: {
            position: 'top-right',
            timeout: 5000,
            textColor: 'white',
            actions: [{ icon: 'close', color: 'white' }]
        }
    }
})

app.use(pinia)
app.use(router)

app.mount('#app')
