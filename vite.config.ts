/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode=preview: ملف HTML واحد ببيانات تجريبية للمعاينة على الجوال
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  build: { target: 'es2022', sourcemap: false, outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
