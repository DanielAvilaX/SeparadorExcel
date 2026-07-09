import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rutas relativas: sirve igual en Vercel (web) y en Electron (file://)
  base: './',
})
