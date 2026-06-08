import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';
import { resolve } from 'path';

/**
 * Two build modes — controlled by --mode flag:
 *
 *   npm run dev           → Vite dev server (SPA, hot-reload)
 *   npm run build         → Standalone SPA → dist-app/ (deploy to /custom-dashboard/)
 *   npm run build:lib     → npm package    → dist/      (share ให้ทีมอื่น install)
 */
export default defineConfig(({ mode }) => {
  // ── Library mode (npm package) ────────────────────────────────────────────
  if (mode === 'lib') {
    return {
      plugins: [
        react(),
        // Inject scoped CSS directly into JS bundle
        // → ทีมที่ install ไม่ต้อง import CSS แยก
        cssInjectedByJs(),
      ],
      build: {
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/index.js'),
          name: 'DashboardBuilder',
        },
        rollupOptions: {
          // React/ReactDOM มาจาก host app ไม่ต้อง bundle ซ้ำ
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: [
            {
              format: 'es',
              entryFileNames: 'dashboard-builder.es.js',
              // inline ทุก chunk → ไฟล์เดียว ง่ายต่อการ distribute
              inlineDynamicImports: true,
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'react/jsx-runtime': 'ReactJSXRuntime',
              },
            },
            {
              format: 'cjs',
              entryFileNames: 'dashboard-builder.cjs.js',
              inlineDynamicImports: true,
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'react/jsx-runtime': 'ReactJSXRuntime',
              },
            },
          ],
        },
        sourcemap: true,
        // ไม่แยก CSS chunk — ให้ cssInjectedByJs จัดการแทน
        cssCodeSplit: false,
      },
      define: {
        // ป้องกัน "import.meta.env is not defined" ในเวลา build library
        'import.meta.env.VITE_API_BASE_URL': 'undefined',
        'import.meta.env.VITE_USE_SAMPLE_DATA': 'undefined',
        'import.meta.env.VITE_SPARK_CONCURRENCY': 'undefined',
      },
    };
  }

  // ── Standalone SPA mode (default) ────────────────────────────────────────
  return {
    base: '/custom-dashboard/',
    plugins: [react()],
    build: {
      outDir: 'dist-app',
    },
  };
});
