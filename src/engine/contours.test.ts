import { describe, expect, it } from 'vitest'

import { buildContours, segmentsToPaths } from '@/engine/contours'

describe('等高线生成', () => {
  it('在正常尺寸下能抽出线段', () => {
    const segs = buildContours({ width: 1200, height: 800 })
    expect(segs.length).toBeGreaterThan(200)
  })

  it('所有端点都落在画布范围内', () => {
    const w = 900
    const h = 600
    for (const s of buildContours({ width: w, height: h })) {
      for (const [x, y] of [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ]) {
        expect(x).toBeGreaterThanOrEqual(-0.001)
        expect(x).toBeLessThanOrEqual(w + 0.001)
        expect(y).toBeGreaterThanOrEqual(-0.001)
        expect(y).toBeLessThanOrEqual(h + 0.001)
      }
    }
  })

  it('同一 seed 结果完全一致（静态背景不能每次刷新都变形）', () => {
    const a = buildContours({ width: 800, height: 600, seed: 11 })
    const b = buildContours({ width: 800, height: 600, seed: 11 })
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i += 97) {
      expect(a[i].x1).toBe(b[i].x1)
      expect(a[i].y1).toBe(b[i].y1)
    }
  })

  it('不同 seed 得到不同地形', () => {
    const a = buildContours({ width: 800, height: 600, seed: 1 })
    const b = buildContours({ width: 800, height: 600, seed: 2 })
    // 至少有一条线段的坐标明显不同
    const differs = a.some((s, i) => {
      const o = b[i]
      return !o || Math.abs(o.x1 - s.x1) > 2 || Math.abs(o.y1 - s.y1) > 2
    })
    expect(differs).toBe(true)
  })

  it('按层拼成 path，层数不超过 levels', () => {
    const segs = buildContours({ width: 800, height: 600, levels: 10 })
    const paths = segmentsToPaths(segs)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.length).toBeLessThanOrEqual(10)
    for (const p of paths) expect(p.d.startsWith('M')).toBe(true)
  })

  it('尺寸为 0 时安全返回空', () => {
    expect(buildContours({ width: 0, height: 0 })).toEqual([])
  })
})
