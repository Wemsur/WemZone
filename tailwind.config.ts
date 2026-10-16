import type { Config } from 'tailwindcss'

/**
 * WemZone 的 Tailwind 配置
 *
 * 用 Tailwind 3.4.19（与 Celestial Launcher 同源），而不是 Celestial-Web 的 v4。
 * 原因：启动器的 UI 组件库与 `omorphia.scss` 都是 v3 写的，v3 的 preset、
 * `@apply`、`classes.scss` 才能原样复用 —— 这是「复刻界面与启动器完全相同」
 * 这条铁律的前提。Phase 1.5 vendor 启动器组件时会 import 它的 preset。
 *
 * 颜色令牌目前只放 WemZone 自己的最小集；启动器那 200 行 colors 会在
 * vendor 时由 `@modrinth/tooling-config/tailwind/tailwind-preset.ts` 提供。
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        surface: {
          1: 'var(--surface-1)',
          1.5: 'var(--surface-1-5)',
          2: 'var(--surface-2)',
          2.5: 'var(--surface-2-5)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
          5: 'var(--surface-5)',
        },
        contrast: 'var(--color-text-primary)',
        primary: 'var(--color-text-default)',
        secondary: 'var(--color-text-tertiary)',
        brand: 'var(--color-brand)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
} satisfies Config
