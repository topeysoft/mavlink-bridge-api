import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

// MapLibre GL CSS (used by the 3D WebGL map renderer)
import 'maplibre-gl/dist/maplibre-gl.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

app.mount('#app')
