import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Workers como módulos ES: el de MapLibre (mapa real del Piloto) lo es
  worker: { format: 'es' },
  // En local, la API de Acero (FastAPI) corre aparte con `npm run api`
  server: {
    proxy: { '/api/v1': 'http://127.0.0.1:8000' },
  },
})
