import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import { bacaSnapshot, folderKerja } from './server/snapshot.js'

// Mode live: endpoint hanya-baca ke folder kerja Saksama. Server dev hanya listen di 127.0.0.1.
function snapshotLive() {
  return {
    name: 'saksama-snapshot',
    configureServer(server) {
      console.log(`[saksama] membaca folder kerja: ${folderKerja()}`)
      server.middlewares.use('/api/snapshot', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          return res.end()
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(bacaSnapshot()))
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Ikon nav satu warna jadi currentColor supaya ikut warna item.
    svgr({
      svgrOptions: {
        replaceAttrValues: { '#111827': 'currentColor', '#0061FF': 'currentColor' },
        svgProps: { 'aria-hidden': 'true', focusable: 'false' },
      },
    }),
    snapshotLive(),
  ],
  server: { port: 5181, strictPort: true },
})
