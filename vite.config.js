import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /escuela se manda por WhatsApp: su vista previa (título, descripción) tiene que
// ser la de la Escuela, y WhatsApp no corre JavaScript. Al compilar se copia el
// index.html ya armado con esas etiquetas cambiadas; vercel.json lo sirve en /escuela.
const SCHOOL_URL = 'https://www.aceropress.com/escuela'
const SCHOOL_TITLE = 'Escuela Acero — Aprende a ser barista con AeroPress'
const SCHOOL_DESC = 'Seis lecciones cortas y gratis para empezar como barista con una AeroPress: la receta base, medir el café, ajustar el sabor, tu barra en la calle y cuánto cobrar.'

function schoolHtml() {
  return {
    name: 'acero-escuela-html',
    apply: 'build',
    // Después de los plugins de Vite: index.html se arma en su generateBundle
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index) this.error('escuela.html: el build no trae index.html')
      const swaps = [
        [/<title>[^<]*<\/title>/, `<title>${SCHOOL_TITLE}</title>`],
        [/(<meta name="description" content=")[^"]*/, `$1${SCHOOL_DESC}`],
        [/(<link rel="canonical" href=")[^"]*/, `$1${SCHOOL_URL}`],
        [/(<meta property="og:url" content=")[^"]*/, `$1${SCHOOL_URL}`],
        [/(<meta property="og:title" content=")[^"]*/, `$1${SCHOOL_TITLE}`],
        [/(<meta property="og:description" content=")[^"]*/, `$1${SCHOOL_DESC}`],
        [/(<meta name="twitter:title" content=")[^"]*/, `$1${SCHOOL_TITLE}`],
        [/(<meta name="twitter:description" content=")[^"]*/, `$1${SCHOOL_DESC}`],
      ]
      let html = String(index.source)
      for (const [re, to] of swaps) {
        // Si index.html cambia de forma, mejor que el build falle a que la vista previa mienta
        if (!re.test(html)) this.error(`escuela.html: no encontré ${re} en index.html`)
        html = html.replace(re, to)
      }
      this.emitFile({ type: 'asset', fileName: 'escuela.html', source: html })
    },
  }
}

export default defineConfig({
  plugins: [react(), schoolHtml()],
  // Workers como módulos ES: el de MapLibre (mapa real del Piloto) lo es
  worker: { format: 'es' },
  // En local, la API de Acero (FastAPI) corre aparte con `npm run api`
  server: {
    proxy: { '/api/v1': 'http://127.0.0.1:8000' },
  },
})
