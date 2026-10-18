import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    /**
     * svgLoader 的 svgoConfig 必须与 Celestial Launcher 逐字节相同。
     * 关掉这两项是硬要求：
     *  - removeViewBox: false —— 去掉 viewBox 后 SVG 不能随容器缩放（图标会撑成原尺寸）
     *  - cleanupIds.minify: false —— id 被压缩重编号后，同页多个图标会撞 id，
     *    `<use>` / clipPath / mask 全部指错，表现为「图标串味」
     */
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
                cleanupIds: {
                  minify: false,
                },
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    /**
     * alias 顺序有语义：@rollup/plugin-alias 的字符串 find 会匹配
     * `importee === find` 或 `importee.startsWith(find + '/')`，所以更长的前缀
     * 必须排在更短的前面（`@modrinth/ui/src` 在 `@modrinth/ui` 之前）。
     * 这里统一用正则，避免 `@modrinth/ui/src/x` 被当成 `@modrinth/ui` 的子路径。
     */
    alias: [
      // vendor 进来的启动器包
      { find: /^#ui\/(.*)$/, replacement: r('./src/vendor/ui/$1') },
      { find: /^@modrinth\/ui\/src\/(.*)$/, replacement: r('./src/vendor/ui/$1') },
      { find: /^@modrinth\/ui$/, replacement: r('./src/vendor/ui/index.ts') },
      { find: /^@modrinth\/assets\/(.*)$/, replacement: r('./src/vendor/assets/$1') },
      { find: /^@modrinth\/assets$/, replacement: r('./src/vendor/assets/index.ts') },
      { find: /^@modrinth\/utils\/(.*)$/, replacement: r('./src/vendor/utils/$1') },
      { find: /^@modrinth\/utils$/, replacement: r('./src/vendor/utils/index.ts') },
      { find: /^@modrinth\/api-client$/, replacement: r('./src/vendor/api-client/index.ts') },
      { find: /^@modrinth\/blog\/changelog$/, replacement: r('./src/vendor/blog/changelog.ts') },
      // WemZone 自己的源码
      { find: '@', replacement: r('./src') },
    ],
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
