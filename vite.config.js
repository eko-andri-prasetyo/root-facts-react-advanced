import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
        'model/metadata.json',
        'model/model.json',
        'model/weights.bin',
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ['**/*.{html,js,css,ico,png,svg,json,bin,wasm}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://huggingface.co'
              || url.hostname.endsWith('huggingface.co')
              || url.hostname.endsWith('hf.co')
              || url.hostname.endsWith('cdn-lfs.huggingface.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-model-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    host: true,
  },
});
