import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  server: {
    port: 8522,
  },
})
