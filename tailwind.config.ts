import type { Config } from 'tailwindcss'

import preset from './src/vendor/tooling/tailwind-preset'

/**
 * WemZone 的 Tailwind 配置
 *
 * 用 Tailwind 3.4.19（与 Celestial Launcher 同源），而不是 Celestial-Web 的 v4。
 * 原因：启动器的 preset / omorphia.scss / classes.scss 的 11 处 @apply 都是 v3 写的。
 *
 * preset 是 vendor 自 `@modrinth/tooling-config/tailwind/tailwind-preset.ts` 的原文
 * （仅改了 import 路径）。它提供启动器那 ~200 行颜色令牌（surface-1..5、
 * 五色系 × 11 档、brand/button/tooltip/banner… 全部指向 CSS 变量），
 * 令牌的具体取值来自 vendor 进来的 assets/styles/variables.scss。
 *
 * **preset 带 `corePlugins: { preflight: false }`** —— 这是上游刻意的：
 * 它不用 Tailwind 的 preflight，改用 omorphia 自己的 reset/normalize。
 * 所以 `@tailwind base` 在这里几乎不产出东西，基础样式由 omorphia.scss 负责。
 */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts,js}',
    /**
     * vendor 目录**必须**显式覆盖，且这条最容易漏。
     * 症状是「DOM 结构对、但完全没样式」——因为 Tailwind 只扫描 content 里
     * 出现过的类名来生成 CSS，vendor 组件里的 `bg-surface-3` `text-primary`
     * 这类类名若不在扫描范围，就不会产出对应的规则。
     * `src/**` 理论上已覆盖 `src/vendor/**`，这里显式再写一遍是为了：
     * ① 文档化这条依赖；② 将来若把 content 收窄成具体子目录时不会静默失效。
     */
    './src/vendor/**/*.{vue,ts,js}',
  ],
  presets: [preset],
} satisfies Config
