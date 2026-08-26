import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'xyflow',
              test: /node_modules[\\/]@xyflow[\\/]/,
              priority: 3,
            },
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|zustand)[\\/]/,
              priority: 2,
            },
            {
              name: 'icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
});
