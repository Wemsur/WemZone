import { describe, expect, it } from 'vitest'

import { buildPath } from '@/engine/spatial'
import type { Stop } from '@/engine/types'

function stop(id: string, x: number, y: number, d = 34): Stop {
  return { id, x, y, d, rx: 0, ry: 0 }
}

const stops: Stop[] = [
  stop('a', 0, 0),
  stop('b', 26, -56),
  stop('c', -26, -112),
  stop('d', 26, -168),
  stop('e', -26, -224),
]

describe('buildPath', () => {
  it('在整数索引处精确经过锚点', () => {
    const path = buildPath(stops)
    for (let i = 0; i <= path.last; i++) {
      const p = path.sample(i)
      expect(p.x).toBeCloseTo(stops[i].x, 6)
      expect(p.y).toBeCloseTo(stops[i].y, 6)
      expect(p.d).toBeCloseTo(stops[i].d, 6)
    }
  })

  it('越界索引沿端点切线外推（首尾要能滑出去一点）', () => {
    const path = buildPath(stops)
    // 端点本身仍然精确
    expect(path.sample(0).x).toBeCloseTo(stops[0].x, 6)
    expect(path.sample(path.last).x).toBeCloseTo(stops[stops.length - 1].x, 6)

    // 越过端点后要真的动起来，而不是被 clamp 在原地 ——
    // 否则物理上推得再远，画面也纹丝不动，观感就是「到边界直接截断」
    expect(path.sample(-0.05).x).not.toBeCloseTo(stops[0].x, 4)
    expect(path.sample(-0.05).y).not.toBeCloseTo(stops[0].y, 4)
    expect(path.sample(path.last + 0.05).x).not.toBeCloseTo(
      stops[stops.length - 1].x,
      4,
    )

    // 外推方向与进入方向相反：负索引往「上一页的反方向」，
    // 正索引往「下一页」继续走（这组测试锚点的 y 是负的，所以符号也相反）
    expect(path.sample(-0.05).y).toBeGreaterThan(stops[0].y)
    expect(path.sample(path.last + 0.05).y).toBeLessThan(
      stops[stops.length - 1].y,
    )
  })

  it('centripetal CR 几乎不过冲（真正的对照见 spatial-overshoot.test.ts）', () => {
    const path = buildPath(stops)
    // 每段采样 200 个点，检查 x 不会明显甩出相邻两锚点范围之外。
    // 实测残余过冲只出现在**首段**（端点幽灵点所致，约 0.25rem），
    // 内段是严格 0。0.27rem 的容差覆盖这个端点效应，
    // 与 uniform CR 的定量对比在 spatial-overshoot.test.ts。
    for (let seg = 0; seg < path.last; seg++) {
      const lo = Math.min(stops[seg].x, stops[seg + 1].x)
      const hi = Math.max(stops[seg].x, stops[seg + 1].x)
      const slack = 0.27 // rem
      for (let k = 0; k <= 200; k++) {
        const x = path.sample(seg + k / 200).x
        expect(x).toBeGreaterThanOrEqual(lo - slack)
        expect(x).toBeLessThanOrEqual(hi + slack)
      }
    }
  })

  it('y 单调向下（因为锚点 y 单调递减）', () => {
    const path = buildPath(stops)
    let prev = path.sample(0).y
    for (let k = 1; k <= 1000; k++) {
      const y = path.sample((k / 1000) * path.last).y
      expect(y).toBeLessThanOrEqual(prev + 1e-6)
      prev = y
    }
  })

  it('标量（d）线性插值，不在段内套缓动', () => {
    const path = buildPath([stop('a', 0, 0, 30), stop('b', 0, -50, 50)])
    // 段中点应为两端平均值（线性）
    expect(path.sample(0.5).d).toBeCloseTo(40, 6)
    // 四分之一处
    expect(path.sample(0.25).d).toBeCloseTo(35, 6)
  })

  it('端点处有非零切线（否则首页的果冻会消失）', () => {
    const path = buildPath(stops)
    // `sample(s)` 对 s 的导数就是相机沿路径的速度。端点处若为 0，
    // 相机在首页附近几乎不动 —— 实测曾是其他区的 1/30。
    const eps = 1e-4
    const speedAt = (s: number): number => {
      const a = path.sample(s - eps)
      const b = path.sample(s + eps)
      return Math.hypot(b.x - a.x, b.y - a.y) / (2 * eps)
    }

    const ends = speedAt(0)
    const endsLast = speedAt(path.last)
    // 与内段（中段切线量级约 60–115rem/索引）同一量级，而不是 0
    expect(ends).toBeGreaterThan(20)
    expect(endsLast).toBeGreaterThan(20)
  })

  it('同样的索引偏移在首段与内段产生相近的视觉位移', () => {
    const path = buildPath(stops)
    const shift = 0.0123 // 一次滚轮 pull 的索引峰值（见 physics.test.ts）
    const disp = (s: number): number => {
      const a = path.sample(s)
      const b = path.sample(s + shift)
      return Math.hypot(b.x - a.x, b.y - a.y)
    }
    // 首页（端点）不应比内段慢一个数量级
    expect(disp(0)).toBeGreaterThan(disp(1) * 0.5)
  })

  it('单区时处处返回该区', () => {
    const path = buildPath([stop('only', 7, -9, 42)])
    expect(path.last).toBe(0)
    expect(path.sample(0)).toMatchObject({ x: 7, y: -9, d: 42 })
    expect(path.sample(3)).toMatchObject({ x: 7, y: -9, d: 42 })
  })

  it('centroid 是各锚点的平均值', () => {
    const path = buildPath(stops)
    const c = path.centroid()
    expect(c.x).toBeCloseTo(0, 6) // 左右交替抵消
    expect(c.y).toBeCloseTo((0 - 56 - 112 - 168 - 224) / 5, 6)
  })

  it('空 stops 抛错', () => {
    expect(() => buildPath([])).toThrow()
  })
})
