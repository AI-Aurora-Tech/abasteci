import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['fuel.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'abasteci — gestão de veículos',
        short_name: 'abasteci',
        description: 'Controle de abastecimentos, despesas, manutenções e lembretes do seu veículo.',
        lang: 'pt-BR',
        theme_color: '#0ea5e9',
        background_color: '#0ea5e9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Não intercepta a API do Supabase — apenas os assets do app.
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: {
        // Permite testar a instalação também com "npm run dev".
        enabled: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
