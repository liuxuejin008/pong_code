import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

// 与后端 app.py 保持一致：PORT 环境变量可覆盖后端端口，代理目标跟随
const apiTarget = `http://127.0.0.1:${process.env.PORT || '5001'}`

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: false,
      resolvers: [
        ElementPlusResolver({
          directives: true,
          importStyle: 'css',
        }),
      ],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/static': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/healthz': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
