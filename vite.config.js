import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appManifest = {
  name: 'RootFacts - AI Vegetable Fun Facts',
  short_name: 'RootFacts',
  description: 'Aplikasi PWA untuk mengenali sayuran dengan TensorFlow.js dan membuat fakta menarik menggunakan Transformers.js.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#ffffff',
  theme_color: '#10b981',
  categories: ['education', 'productivity', 'utilities'],
  icons: [
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifestFilename: 'manifest.json',
      manifest: appManifest,
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
        globPatterns: ['**/*.{html,js,css,ico,png,svg,json,bin,webmanifest,wasm}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://huggingface.co'
              || url.hostname.endsWith('huggingface.co')
              || url.hostname.endsWith('hf.co')
              || url.hostname.endsWith('cdn-lfs.huggingface.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-xenova-model-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('jsdelivr.net')
              || url.hostname.endsWith('unpkg.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ai-runtime-cdn-cache',
              expiration: {
                maxEntries: 40,
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
