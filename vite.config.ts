import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // vendor 进来的启动器样式（omorphia.scss）用的是 legacy @import 语法
        silenceDeprecations: ['import'],
      },
    },
  },
  build: {
    // 大图与视频直接作为文件产出，不内联为 base64
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
})
