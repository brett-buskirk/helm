import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Set by the Tauri CLI during `tauri dev` / `tauri build`. When unset we're
// doing a plain web build (the Cloudflare Pages deploy), so nothing below
// changes the existing web output.
const isTauri = !!process.env.TAURI_ENV_PLATFORM
const host = process.env.TAURI_DEV_HOST

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

  // ── Tauri integration ────────────────────────────────────────────────────
  // Quieter output and a fixed dev port the Tauri webview connects to.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    // Don't let Vite watch the Rust crate.
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  // Build targets only apply under Tauri; the web build keeps Vite's defaults.
  build: isTauri
    ? {
        // Windows uses Edge WebView2 (Chromium); macOS/Linux use WebKit.
        target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
        minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
    : undefined,
})
