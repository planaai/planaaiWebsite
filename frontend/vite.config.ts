import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.plan4ai.fyi',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://api.plan4ai.fyi',
        changeOrigin: true,
      },
    },
  },
})
