import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' = relative asset paths, so the build works on GitHub Pages under any repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  // pre-bundle lazily-loaded libraries so the dev server never ends up with two copies of React
  optimizeDeps: { include: ['react-leaflet', 'leaflet', '@react-three/fiber', '@react-three/drei', 'three', 'zustand'] },
  build: { chunkSizeWarningLimit: 2000 },
});
