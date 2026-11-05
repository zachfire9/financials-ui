import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // local-only; use `npm run dev:network` to expose on the LAN
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_FINANCIALS_API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
