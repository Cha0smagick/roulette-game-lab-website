// defineConfig comes from vitest/config, not vite, so the `test` block below is
// type-checked. Importing from 'vite' would make the key silently untyped.
import { defineConfig } from 'vitest/config';

// No framework on purpose. Every kilobyte of framework is slower first paint on a
// mid-range Android phone, and a slower first paint loses the session before a
// single ad slot becomes viewable. That lost session is lost revenue.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Hard budget. CI fails the deploy when gzipped output exceeds this.
    // See PLAN.md section 1.
    reportCompressedSize: true,
// Multipage, not a single-page app. Four HTML entries mean the browser can
    // navigate, reload, bookmark and back-button each page, and there is no
    // client router to misroute a deep link. Listing a file here that does not
    // exist fails the build, which is why each page is created first.
    rollupOptions: {
      input: {
        index: 'index.html',
        simulator: 'simulator.html',
        analysis: 'analysis.html',
        encyclopedia: 'encyclopedia.html',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});