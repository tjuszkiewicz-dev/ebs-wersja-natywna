import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3011,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3010',
            changeOrigin: true,
            headers: {
              'x-internal-key': env.INTERNAL_API_KEY || '',
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react':   ['react', 'react-dom'],
              'vendor-charts':  ['recharts'],
              'vendor-icons':   ['lucide-react'],
              'vendor-ai':      ['@google/generative-ai'],
              'vendor-pdf':     ['html2pdf.js'],
            }
          }
        }
      }
    };
});
