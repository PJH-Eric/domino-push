import { defineConfig } from 'vite'

// GitHub Pages 專案頁需要子路徑；以 VITE_BASE 覆寫（預設 './' 相對路徑，本機與 Pages 皆可用）
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  server: { port: 3110, host: true, strictPort: true },
  preview: { port: 3111, host: true },
  // Rapier 的 wasm 內嵌約 2 MB，獨立成一個快取友善的 chunk
  build: { target: 'es2022', chunkSizeWarningLimit: 2400, rollupOptions: { output: { manualChunks: { rapier: ['@dimforge/rapier3d-compat'], three: ['three'] } } } },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
})
