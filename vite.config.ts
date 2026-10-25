import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

function buildVersion(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  let buildNum = 1;
  try {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const count = parseInt(
      execSync(`git rev-list --count HEAD --since="${midnight.toISOString()}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim(),
    );
    if (count > 0) buildNum = count;
  } catch {
    // fallback to 1
  }

  return `v10${yy}${mm}${dd}${String(buildNum).padStart(3, '0')}`;
}

const appVersion = buildVersion();

// Sub-path deploy (https://dhruvnagpal.in/botroom). Same env name as the khlaas app.
// Normalised to "/botroom/" (leading + trailing slash) or "/" when unset.
const rawBase = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
const basePath = rawBase ? `/${rawBase}/` : '/';

export default defineConfig({
  base: basePath,
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'robots.txt'],
      manifest: {
        name: 'Botroom – AI Case Solver',
        short_name: 'Botroom',
        description: 'Work through a business case with an AI analyst and reviewer',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: `${basePath}icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/\/api\//],
      },
    }),
  ],
});
