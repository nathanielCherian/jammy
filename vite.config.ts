import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    proxy: {
      '/sessions':  'http://127.0.0.1:3001',
      '/uploads':   'http://127.0.0.1:3001',
      // wss: true because the dev server is now HTTPS/WSS
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true },
    },
  },
})
