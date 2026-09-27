import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // AmbientScene (Three.js) ~884KB là chunk lazy lớn nhất, không nằm trên đường tải ban đầu
    // (xem AmbientBackground.tsx). Đặt sát ngưỡng đó để vẫn cảnh báo nếu chunk EAGER phình to.
    chunkSizeWarningLimit: 900,
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
