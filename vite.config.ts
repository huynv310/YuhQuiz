import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách Supabase
          'supabase-vendor': ['@supabase/supabase-js'],
          // Tách GSAP
          'gsap-vendor': ['gsap', '@gsap/react'],
        },
      },
    },
  },
});
