import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served at the root of https://app.sk8happy.com (custom domain on GitHub Pages).
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.js', 'src/**/*.test.jsx', 'tests/**/*.test.js', 'supabase/functions/**/*.test.ts'] },
});
