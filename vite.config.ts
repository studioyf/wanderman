import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The app installs on the home screen and works with no signal: the app itself is stored by the
// service worker (the small background helper the browser keeps for an installed app); the map's pieces
// from OpenFreeMap are kept in a cache of their own, read by the map itself (src/mapcache.ts).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-180.png', 'icon.svg'],
      manifest: {
        name: 'WanderMan',
        short_name: 'WanderMan',
        description: 'Plan loosely, wander offline, come home with a journal.',
        theme_color: '#f4f1ea',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Place photos from Wikimedia, kept once seen so the cards keep their picture with no signal.
        runtimeCaching: [{
          urlPattern: /^https:\/\/(upload|thumb|commons)\.wiki(media|pedia)\.org\//,
          handler: 'CacheFirst',
          options: { cacheName: 'wm-photos', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
  test: { environment: 'node' },
} as any);
