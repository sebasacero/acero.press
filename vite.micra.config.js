import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La app Micra para Android e iOS (Capacitor): solo micra.html y lo que importa,
// en dist-micra/ con el nombre index.html que espera Capacitor. Sin public/: los
// videos y fotos del sitio no viajan dentro de la app.
function asIndex() {
  return {
    name: 'micra-as-index',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['micra.html']
      if (!page) this.error('micra.html no salió en el build')
      page.fileName = 'index.html'
    },
  }
}

export default defineConfig({
  plugins: [react(), asIndex()],
  publicDir: false,
  worker: { format: 'es' },
  build: {
    outDir: 'dist-micra',
    emptyOutDir: true,
    rollupOptions: { input: 'micra.html' },
    // Va dentro de la app, no por la red: MapLibre (1 MB, cargado aparte) no pesa en la descarga de cada vez
    chunkSizeWarningLimit: 1200,
  },
})
