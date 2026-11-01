import { createApp } from 'vue'

import App from './App.vue'
import './styles/main.css'

/**
 * **启动器组件库（vendor）不在这里加载。**
 *
 * 它是 Phase 6「启动器小窗」才需要的东西，而 vendor 的 UI barrel 会把整
 * 个组件库拉进首屏（实测让入口 JS 从 ~250KB 涨到 1.07MB、CSS 多出 300KB），
 * 对现在的页面完全是无用负担 —— 全站目前没有任何地方渲染 vendor 组件。
 *
 * 需要时（Phase 6）动态加载 `@/launcher-ui/install`：
 *   const { installLauncherUi } = await import('@/launcher-ui/install')
 *   installLauncherUi(app)
 *
 * 样式顺序仍然是硬约束：`launcher.scss` 由 install.ts 引入，动态加载时
 * 一定排在 `main.css` 之后，启动器的 `--surface-*` / `--color-*` 才能覆盖
 * WemZone 的同名令牌。
 */

/**
 * 主题 class 挂在 <html> 上。
 *
 * vendor 的 `assets/styles/variables.scss` 里，`html` 默认套 `.light-properties`，
 * 只有 `.dark-mode` / `.dark` / `:root[data-theme='dark']` 才会切到暗色令牌。
 * WemZone 是暗色站，所以必须显式挂 `dark-mode`，否则启动器组件会拿到浅色
 * 的 `--surface-*` / `--color-text-*`，表现为「组件结构对但颜色全反」。
 *
 * 注意：这条**不是** WemZone 自己的主题系统（那是 main.css 里的 --brand-hue）。
 * 它只决定启动器组件取哪一套令牌。
 */
document.documentElement.classList.add('dark-mode')

const app = createApp(App)
app.mount('#app')
