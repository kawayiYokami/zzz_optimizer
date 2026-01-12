import './style.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

console.log('[DEBUG] 初始化应用')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

console.log('[DEBUG] 应用初始化完成')
