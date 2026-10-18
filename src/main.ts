import { createApp } from 'vue'

import App from './App.vue'
import { ensureTeleportTarget, installLauncherUi } from './launcher-ui/install'
import './styles/main.css'
import './styles/launcher.scss'

/**
 * 样式加载顺序是硬约束：
 *   1. main.css —— Tailwind 指令 + WemZone 自己的设计令牌
 *   2. launcher.scss —— vendor 启动器样式（omorphia 的变量/组件类）
 * 后者必须在前者之后，这样启动器的 `--surface-*` / `--color-*` 定义
 * 才能覆盖 WemZone 的同名令牌，保证「启动器组件与启动器像素级一致」。
 */

// vendor 组件大量使用 <Teleport to="#teleports">，目标节点要先存在。
ensureTeleportTarget()

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
installLauncherUi(app)
app.mount('#app')
