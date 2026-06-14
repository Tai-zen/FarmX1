import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Prevents Vite from bundling two separate copies of React (one for the app,
    // one inside react-leaflet), which causes the "render2 is not a function" error
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Force Vite to pre-bundle leaflet and react-leaflet together so they share
    // the same React context — fixes the "Rendering <Context> directly" error
    include: ['leaflet', 'react-leaflet'],
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  // Removed the stale GOOGLE_MAPS_PLATFORM_KEY define — we use OpenStreetMap now
})
