import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Nur im Dev-Server aktiv. Für Produktion brauchst du einen eigenen Endpunkt.
      '/leetcode-graphql': {
        target: 'https://leetcode.com',
        changeOrigin: true,
        rewrite: () => '/graphql',
      },
    },
  },
})
