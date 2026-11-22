import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import '@unocss/reset/tailwind.css'
import 'uno.css'
import AuthWrapper from './AuthWrapper.vue'
import { useAuthStore } from './stores/auth'
import { registerSW } from 'virtual:pwa-register'
import router from './router'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(AuthWrapper)
app.use(pinia)
app.use(router)

// Initialize Firebase auth
const authStore = useAuthStore()
authStore.initAuth()

// Register PWA Service Worker
const updateSW = registerSW({
     onNeedRefresh() {
          // Show a prompt to the user to refresh the app
          if (confirm('New content available. Reload to update?')) {
               updateSW(true)
          }
     },
     onOfflineReady() {
          console.log('App ready to work offline')
     },
})

app.mount('#app')
