/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The flat map is the default view, but its chunks are only discovered when
 * React first renders the lazy WorldMap. Preloading them lets the browser fetch
 * and compile them while index.js runs, without executing them early (so the
 * shell still paints first). The globe and the detail geometry stay on demand.
 */
function preloadMapChunks(): Plugin {
  let base = '/';
  return {
    name: 'atlas:preload-map-chunks',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        return Object.values(ctx.bundle)
          .filter((c) => c.type === 'chunk' && !c.isEntry && ['WorldMap', 'd3', 'geo'].includes(c.name))
          .map((c) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: base + c.fileName }, injectTo: 'head' as const }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadMapChunks()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split long-lived vendor code from app code so returning visitors
        // only re-download what changed. The 110m map geometry gets its own
        // chunk because it changes least often; the 1:50m geometry is a plain
        // hashed JSON asset fetched on zoom (see lib/geo.ts).
        manualChunks(id) {
          if (id.includes('world-atlas') || id.includes('/src/data/geo/')) return 'geo';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/d3-') || id.includes('node_modules/topojson')) return 'd3';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
