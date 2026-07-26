// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Base path defaults to '/starium-app/' for GitHub Pages.
// Set VITE_BASE_PATH=/ to build for Firebase Hosting (root deployment).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/starium-app/'
})