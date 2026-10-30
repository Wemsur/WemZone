import { describe, expect, it } from 'vitest'

/**
 * 空闲晃动的幅度约束
 *
 * 这个测试读 `src/styles/main.css` 里的 `@keyframes drift-*` 定义，
 * 校验幅度落在「轻微但看得见」的区间里。
 *
 * 为什么值得单独测：晃动的幅度**不能凭直觉写**。它在透视容器内部，
 * 会被投影放大（内容距眼仅 34rem，缩放系数 P/(P−z) ≈ 3.5），
 * 而且平移与旋转的放大倍率还不一样。实测踩过的坑：
 *  - 平移 0.85rem 放进透视容器 → 屏幕偏移 153px（约视口 10%），完全失控
 *  - 旋转 1.4° → 屏幕跨度 64px（约视口 4%），仍然过大
 * 所以这里的数值是按实测反推的，改动时必须同步更新这个测试。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('../styles/main.css', import.meta.url)),
  'utf-8',
)

/** 从 CSS 里抓某个 keyframes 块的正文。 */
function keyframes(name: string): string {
  const re = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const m = css.match(re)
  if (!m) throw new Error(`找不到 @keyframes ${name}`)
  return m[1]
}

/** 从 transform 串里取某个函数的数值参数（会剥掉 deg / px / rem 等单位）。 */
function argsOf(block: string, fn: string): number[][] {
  const re = new RegExp(`${fn}\\(([^)]+)\\)`, 'g')
  const out: number[][] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    out.push(
      m[1]
        .trim()
        .split(/[,\s]+/)
        .map((v) => Number.parseFloat(v)),
    )
  }
  return out
}

describe('空闲晃动幅度', () => {
  it('平移分量存在且幅度很小（外层，无透视放大）', () => {
    const block = keyframes('drift-outer')
    const t = argsOf(block, 'translate3d')
    expect(t.length).toBe(2) // from / to

    for (const [x, y] of t) {
      // 外层没有透视放大，所以这里的数值就是屏幕像素量级（rem → px 约 ×16）
      expect(Math.abs(x)).toBeLessThan(0.5)
      expect(Math.abs(y)).toBeLessThan(0.5)
      // 但要大于 0，否则等于没动
      expect(Math.abs(x) + Math.abs(y)).toBeGreaterThan(0.01)
    }

    // from 与 to 必须反向，否则不是往复晃动
    expect(Math.sign(t[0][0])).toBe(-Math.sign(t[1][0]))
  })

  it('旋转分量存在且幅度很小（内层，会被透视放大）', () => {
    const block = keyframes('drift-inner')
    const rx = argsOf(block, 'rotateX')
    const ry = argsOf(block, 'rotateY')
    expect(rx.length).toBe(2)
    expect(ry.length).toBe(2)

    // 内层在透视里，0.15° 就会被放大成约 7px 的屏幕位移。
    // 上限 0.4° 对应约视口 1% 的跨度 —— 再大就不叫「轻微」了。
    for (const [deg] of [...rx, ...ry]) {
      expect(Math.abs(deg)).toBeLessThan(0.4)
      expect(Math.abs(deg)).toBeGreaterThan(0.02)
    }
  })

  it('两条动画的周期互质（合成拍频远大于单周期，看不出规律）', () => {
    const dur = (name: string): number => {
      // 周期现在写成 `calc(11s / var(--wz-time-scale, 1))`，慢放开关靠这个
      // 变量把时长拉长。正则要能同时接受裸 `11s` 和 calc 形式。
      const re = new RegExp(
        `\\.${name}\\s*\\{[^}]*animation:\\s*${name}\\s+(?:calc\\(\\s*)?(\\d+)s`,
        'm',
      )
      const m = css.match(re)
      if (!m) throw new Error(`找不到 .${name} 的 animation 定义`)
      return Number(m[1])
    }
    const a = dur('drift-outer')
    const b = dur('drift-inner')
    const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y))

    // 互质 → 最小公倍数 = 两者之积，拍频极长
    expect(gcd(a, b)).toBe(1)
    expect(a * b).toBeGreaterThan(120) // 拍频 > 2 分钟
    // 周期也不能太短，否则晃动会显得急躁
    expect(Math.min(a, b)).toBeGreaterThan(5)
  })

  it('prefers-reduced-motion 下两条动画都被关掉', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.drift-outer[^}]*animation:\s*none/,
    )
  })

  it('两个 drift 层都显式铺满（否则 #viewport 会塌成 0 高）', () => {
    // 带 transform 的元素会成为后代绝对定位的包含块；
    // 若它们高度为 0，内部的 #viewport 用 inset: 0 就会塌掉。
    expect(css).toMatch(/\.drift-outer,\s*\.drift-inner\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.drift-outer,\s*\.drift-inner\s*\{[^}]*inset:\s*0/)
  })
})
