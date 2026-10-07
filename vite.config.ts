/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split long-lived vendor code from app code so returning visitors
        // only re-download what changed. Map geometry gets its own chunk
        // because it is the largest asset and changes least often.
        manualChunks(id) {
          if (id.includes('countries-50m')) return 'geo-50m';
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
