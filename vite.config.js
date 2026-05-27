// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🎯 FIX: This must match the exact name of your GitHub repository!
  base: '/starium-app/'
})