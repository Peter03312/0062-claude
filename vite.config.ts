/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯前端离线构建：所有依赖由 node_modules 打包，不引用任何外部 CDN。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node'
  }
});
