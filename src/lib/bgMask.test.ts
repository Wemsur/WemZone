import { describe, expect, it } from 'vitest'

import { sectionBgMask } from '@/lib/bgMask'

/**
 * 背景渐隐带的几何不变量
 *
 * 这个函数存在的意义就是两条：**静止时视野内满不透明**（不出现「视野边缘
 * 开始发灰」或「背景只剩中间一条」），以及**相邻两块背景在中点附近交汇**。
 * 写死百分比时这两条在默认几何下勉强成立，换个窗口比例或改间距就全错。
 */

function stops(mask: string): { topOuter: number; topInner: number; botInner: number; botOuter: number } {
  // mask 以 `transparent 0%` 开头，取它后面的四个边界值
  const nums = [...mask.matchAll(/([\d.]+)%/g)].map((m) => Number.parseFloat(m[1]))
  const [topOuter, topInner, botInner, botOuter] = nums.slice(1, 5)
  return { topOuter, topInner, botInner, botOuter }
}

const BG_FACTOR = 2

/** 把 mask 百分比换算回「距背景中心的 rem」 */
function geometry(sectionH: number, spacing: number, bleed = 1.04) {
  const bgH = sectionH * BG_FACTOR
  const { topInner, botOuter, topOuter, botInner } = stops(
    sectionBgMask({ sectionH, bgFactor: BG_FACTOR, spacing, bleed }),
  )
  return {
    bgH,
    visibleHalf: sectionH / bleed / 2,
    inner: bgH / 2 - (topInner / 100) * bgH,
    outer: (botOuter / 100) * bgH - bgH / 2,
    band: ((botOuter - botInner) / 100) * bgH,
    topBand: ((topInner - topOuter) / 100) * bgH,
  }
}

describe('区块背景渐隐带', () => {
  // 16:9（一屏 62.5rem）、接近正方形（100rem）、很矮的宽窗口（40rem）
  for (const sectionH of [58.5, 78, 104, 41.6]) {
    it(`视野内满不透明（区块高 ${sectionH}rem）`, () => {
      const g = geometry(sectionH, 72)
      expect(g.inner).toBeGreaterThanOrEqual(g.visibleHalf)
    })
  }

  it('默认几何下，淡出带越过两区中点（两块背景在此交汇）', () => {
    const g = geometry(58.5, 72)
    expect(g.outer).toBeGreaterThan(72 / 2)
    // 淡出带至少 1.6rem 宽，不能退化成硬边
    expect(g.band).toBeGreaterThanOrEqual(1.5)
  })

  it('视野比间距还高时，仍然盖满一屏（不会变成一条横条）', () => {
    // 一屏 104rem、间距 72rem：中点在屏幕内，旧公式会压成 1.6rem 的条
    const g = geometry(104, 72)
    expect(g.inner).toBeGreaterThanOrEqual(g.visibleHalf)
    expect(g.visibleHalf).toBeGreaterThan(72 / 2)
  })

  it('渐隐带不越过背景自己的边', () => {
    for (const sectionH of [58.5, 78, 104]) {
      const g = geometry(sectionH, 72)
      expect(g.outer).toBeLessThanOrEqual(g.bgH / 2)
    }
  })

  it('间距调大时，渐变从视野边缘一直延伸到下一区的上边缘', () => {
    const small = geometry(58.5, 60)
    const large = geometry(58.5, 100)
    // 内侧永远贴着视野边缘（视野内不淡）
    expect(small.inner).toBeCloseTo(small.visibleHalf, 1)
    expect(large.inner).toBeCloseTo(large.visibleHalf, 1)
    // 外侧跟着下一区的上边缘走（背景不够高时被自己的边截住）
    expect(small.outer).toBeCloseTo(Math.min(small.bgH / 2, 60 - small.visibleHalf), 1)
    expect(large.outer).toBeCloseTo(Math.min(large.bgH / 2, 100 - large.visibleHalf), 1)
    expect(large.outer).toBeGreaterThan(small.outer)
  })

  it('横向渐隐仍然存在（两块 mask 用 intersect 合成）', () => {
    const mask = sectionBgMask({ sectionH: 58.5, bgFactor: BG_FACTOR, spacing: 72 })
    expect(mask).toContain('to right')
    expect(mask.split('linear-gradient').length).toBe(3) // 竖直 + 横向 = 2 条
  })

  it('窄版（bleed = 1、背景 150%）也盖满一屏', () => {
    const sectionH = 52
    const bgH = sectionH * 1.5
    const { topInner } = stops(
      sectionBgMask({ sectionH, bgFactor: 1.5, spacing: sectionH, bleed: 1 }),
    )
    const inner = bgH / 2 - (topInner / 100) * bgH
    // 百分比保留两位小数，允许 0.05rem 的舍入
    expect(inner).toBeGreaterThanOrEqual(sectionH / 2 - 0.05)
  })
})
