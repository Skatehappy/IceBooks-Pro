import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';

export default defineConfig({
  base: '/IceBooks-Pro/',
  plugins: [
    react(),
    {
      name: 'copy-config',
      closeBundle() {
        if (existsSync('config.js')) {
          copyFileSync('config.js', 'dist/config.js');
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
