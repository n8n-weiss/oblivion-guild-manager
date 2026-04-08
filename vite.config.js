import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/oblivion-guild-manager/',
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) return 'firebase'
          if (id.includes('node_modules/recharts/')) return 'recharts'
          if (id.includes('node_modules/framer-motion/')) return 'motion'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react'
        }
      }
    }
  }
})