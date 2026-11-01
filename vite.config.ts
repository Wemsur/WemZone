import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * B 站投稿的本地代理
 *
 * 浏览器直连 B 站接口会被 CORS 与风控挡住（需要 WBI 签名 + `buvid3` cookie
 * + 浏览器指纹参数），所以签名与请求都在 Node 侧做。开发服务器挂一个
 * `/api/bilibili/videos`，前端优先请求它；失败时退回 `src/data/videos.json`
 * 这份构建时快照。
 *
 * 生产环境对应 `api/bilibili/videos.ts`（Vercel Serverless），逻辑同源。
 */
function bilibiliProxy(): {
  name: string
  configureServer: (server: import('vite').ViteDevServer) => void
} {
  return {
    name: 'wemzone-bilibili-proxy',
    configureServer(server) {
      server.middlewares.use('/api/bilibili/videos', (_req, res) => {
        void (async () => {
          try {
            // @ts-expect-error 纯 JS 模块，没有类型声明
            const mod = await import('./scripts/fetch-bilibili.mjs')
            const data = await mod.fetchVideos('1826712095', 1)
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=600')
            res.end(JSON.stringify(data))
          } catch {
            // 风控 / 离线：返回快照，前台永远不会空
            try {
              const { readFile } = await import('node:fs/promises')
              const raw = await readFile(r('./src/data/videos.json'), 'utf8')
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(raw)
            } catch {
              res.statusCode = 502
              res.end(JSON.stringify({ error: 'bilibili unavailable' }))
            }
          }
        })()
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    bilibiliProxy(),
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
      /**
       * 启动器前端（`src/launcher-app/`，从 CelestialLauncher/apps/app-frontend
       * 原样复制）依赖 Tauri 的 IPC。这里把每个 `@tauri-apps/*` 模块换成
       * `src/launcher-app-mock/` 下的替身：数据来自硬编码样例，
       * 窗口/文件/对话框之类做空操作。**必须放在最前面**（精确匹配）。
       */
      { find: /^@tauri-apps\/api\/core$/, replacement: r('./src/launcher-app-mock/core.ts') },
      { find: /^@tauri-apps\/api\/event$/, replacement: r('./src/launcher-app-mock/event.ts') },
      { find: /^@tauri-apps\/api\/app$/, replacement: r('./src/launcher-app-mock/app.ts') },
      { find: /^@tauri-apps\/api\/window$/, replacement: r('./src/launcher-app-mock/window.ts') },
      { find: /^@tauri-apps\/api\/webview$/, replacement: r('./src/launcher-app-mock/webview.ts') },
      { find: /^@tauri-apps\/plugin-dialog$/, replacement: r('./src/launcher-app-mock/dialog.ts') },
      { find: /^@tauri-apps\/plugin-fs$/, replacement: r('./src/launcher-app-mock/fs.ts') },
      { find: /^@tauri-apps\/plugin-http$/, replacement: r('./src/launcher-app-mock/http.ts') },
      { find: /^@tauri-apps\/plugin-opener$/, replacement: r('./src/launcher-app-mock/opener.ts') },
      { find: /^@tauri-apps\/plugin-os$/, replacement: r('./src/launcher-app-mock/os.ts') },
      {
        find: /^@tauri-apps\/plugin-window-state$/,
        replacement: r('./src/launcher-app-mock/window-state.ts'),
      },
      // 复制过来的启动器源码：它内部的 `@/` 已改写成 `@launcher/`
      { find: '@launcher', replacement: r('./src/launcher-app') },
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
