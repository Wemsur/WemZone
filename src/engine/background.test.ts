import { describe, expect, it } from 'vitest'

import {
  ditherColors,
  hsl,
  hueAt,
  meshColors,
  mixHue,
  wrapHue,
} from '@/engine/background'

describe('色相插值', () => {
  it('wrapHue 归一化到 [0, 360)', () => {
    expect(wrapHue(0)).toBe(0)
    expect(wrapHue(360)).toBe(0)
    expect(wrapHue(-10)).toBe(350)
    expect(wrapHue(730)).toBe(10)
  })

  it('mixHue 走最短弧', () => {
    // 210 → 340：正向 +130，反向 -230；应当走正向
    expect(mixHue(210, 340, 0.5)).toBeCloseTo(275, 6)
    // 340 → 18：正向 +38（跨 0），反向 -322
    expect(mixHue(340, 18, 0.5)).toBeCloseTo(359, 6)
    expect(mixHue(340, 18, 1)).toBeCloseTo(18, 6)
  })

  it('整数索引处返回该区的原始色相', () => {
    const hues = [18, 38, 210, 340, 160]
    for (let i = 0; i < hues.length; i++) {
      expect(hueAt(i, hues)).toBeCloseTo(hues[i], 6)
    }
  })

  it('小数索引按段插值，且取最短弧', () => {
    const hues = [18, 38, 210, 340, 160]
    // 第 2→3 段（210 → 340）的中点
    expect(hueAt(2.5, hues)).toBeCloseTo(275, 6)
    // 第 3→4 段（340 → 160）：正向 +180 与反向 -180 等长，取 -180
    expect(hueAt(3.5, hues)).toBeCloseTo(250, 6)
  })

  it('越界索引 clamp 到端点（转场过冲不会插到不存在的区）', () => {
    const hues = [18, 38, 210]
    expect(hueAt(-0.3, hues)).toBeCloseTo(18, 6)
    expect(hueAt(5, hues)).toBeCloseTo(210, 6)
  })

  it('单区 / 空数组不崩', () => {
    expect(hueAt(3, [42])).toBeCloseTo(42, 6)
    expect(hueAt(3, [])).toBe(0)
  })
})

describe('调色', () => {
  it('mesh 是六格，深灰占多数', () => {
    const c = meshColors(18)
    expect(c).toHaveLength(6)
    const greys = c.filter((x) => x.startsWith('#'))
    expect(greys.length).toBe(3)
    // 剩下三格是主题色 / 压暗 / 高光
    expect(c.filter((x) => x.startsWith('hsl')).length).toBe(3)
  })

  it('dither 的笔色跟随色相', () => {
    expect(ditherColors(18).front).toContain('18.0')
    expect(ditherColors(210).front).toContain('210.0')
    expect(ditherColors(210).back).toBe('#1a1a1a')
  })

  it('hsl 支持 alpha', () => {
    expect(hsl(18, 56, 62)).toBe('hsl(18.0 56% 62%)')
    expect(hsl(18, 56, 62, 0.3)).toBe('hsl(18.0 56% 62% / 0.3)')
  })
})
