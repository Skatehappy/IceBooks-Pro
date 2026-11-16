import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works under https://<user>.github.io/IceBooks-Pro/ and on any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.js', 'src/**/*.test.jsx', 'tests/**/*.test.js', 'supabase/functions/**/*.test.ts'] },
});
