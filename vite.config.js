import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rutas relativas: sirve igual en Vercel (web) y en Electron (file://)
  base: './',
  define: {
    // Version del package.json disponible en el codigo del renderer (ver src/lib/appVersion.js)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
