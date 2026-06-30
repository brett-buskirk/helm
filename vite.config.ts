import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['helm-icon.svg'],
      workbox: {
        // recharts + @react-pdf/renderer push the bundle over the 2 MB default;
        // code-split in Phase 5 when upgrading recharts to v3
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Helm',
        short_name: 'Helm',
        description: 'Your consulting practice operating system',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          {
            src: 'helm-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
})
