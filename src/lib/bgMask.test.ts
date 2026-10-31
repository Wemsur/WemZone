import { describe, expect, it } from 'vitest'

import { sectionBgMask } from '@/lib/bgMask'

/**
 * 背景渐隐带的几何不变量
 *
 * 这个函数存在的意义是两条：**静止时视野内满不透明**（不出现「视野边缘
 * 开始发灰」或「背景只剩中间一条」），以及**整段间隙都是渐变**
 * （本区下边缘 → 下一区上边缘）。
 */

function stops(mask: string) {
  // mask 以 `transparent 0%` 开头，取它后面的四个边界值
  const nums = [...mask.matchAll(/([\d.]+)%/g)].map((m) => Number.parseFloat(m[1]))
  const [topOuter, topInner, botInner, botOuter] = nums.slice(1, 5)
  return { topOuter, topInner, botInner, botOuter }
}

const BG_FACTOR = 2

/** 把 mask 百分比换算回「距背景中心的 rem」 */
function geometry(sectionH: number, spacing: number, bleed = 1.04) {
  const { mask, heightPct } = sectionBgMask({ sectionH, bgFactor: BG_FACTOR, spacing, bleed })
  const bgH = (sectionH * heightPct) / 100
  const { topInner, botOuter, botInner } = stops(mask)
  return {
    bgH,
    heightPct,
    visibleHalf: sectionH / bleed / 2,
    inner: bgH / 2 - (topInner / 100) * bgH,
    outer: (botOuter / 100) * bgH - bgH / 2,
    band: ((botOuter - botInner) / 100) * bgH,
  }
}

describe('区块背景渐隐带', () => {
  // 16:9（一屏 62.5rem）、接近正方形（100rem）、很矮的宽窗口（40rem）
  for (const sectionH of [65, 78, 120, 41.6]) {
    it(`视野内满不透明（区块高 ${sectionH}rem）`, () => {
      const g = geometry(sectionH, 102)
      expect(g.inner).toBeGreaterThanOrEqual(g.visibleHalf - 0.05)
    })
  }

  it('渐变覆盖整段间隙：本区视野边缘 → 下一区上边缘', () => {
    const g = geometry(65, 102)
    expect(g.inner).toBeCloseTo(g.visibleHalf, 1)
    expect(g.outer).toBeCloseTo(102 - g.visibleHalf, 1)
    expect(g.band).toBeCloseTo(102 - 2 * g.visibleHalf, 1)
  })

  it('视野比间距还高时，仍然盖满一屏（不会变成一条横条）', () => {
    // 一屏 120rem、间距 102rem：中点（51rem）落在屏幕内
    const g = geometry(120, 102)
    expect(g.inner).toBeGreaterThanOrEqual(g.visibleHalf - 0.05)
    expect(g.visibleHalf).toBeGreaterThan(102 / 2)
  })

  it('间距大于背景默认高度时，背景自动加高，淡出带不被自己的边截断', () => {
    const g = geometry(65, 102)
    expect(g.outer).toBeGreaterThan(65) // 超过 200% 背景的半高
    expect(g.bgH / 2).toBeGreaterThanOrEqual(g.outer - 0.01)
    expect(g.heightPct).toBeGreaterThan(200)
  })

  it('间距调大时，渐变整体外移', () => {
    const small = geometry(65, 72)
    const large = geometry(65, 102)
    expect(large.outer).toBeGreaterThan(small.outer)
  })

  it('横向渐隐仍然存在（两块 mask 用 intersect 合成）', () => {
    const { mask } = sectionBgMask({ sectionH: 65, bgFactor: BG_FACTOR, spacing: 102 })
    expect(mask).toContain('to right')
    expect(mask.split('linear-gradient').length).toBe(3) // 竖直 + 横向 = 2 条
  })

  it('窄版（bleed = 1、背景至少 150%）也盖满一屏', () => {
    const sectionH = 52
    const { mask, heightPct } = sectionBgMask({
      sectionH,
      bgFactor: 1.5,
      spacing: sectionH,
      bleed: 1,
    })
    const bgH = (sectionH * heightPct) / 100
    const { topInner } = stops(mask)
    const inner = bgH / 2 - (topInner / 100) * bgH
    // 百分比保留两位小数，允许 0.05rem 的舍入
    expect(inner).toBeGreaterThanOrEqual(sectionH / 2 - 0.05)
    expect(heightPct).toBeCloseTo(150, 0)
  })
})
