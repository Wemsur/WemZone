import { describe, expect, it } from 'vitest'

import { buildPath } from '@/engine/spatial'
import type { Stop, Vec3 } from '@/engine/types'

function stop(id: string, x: number, y: number, d = 34): Stop {
  return { id, x, y, d, rx: 0, ry: 0 }
}

/** 测试用的独立实现：uniform Catmull-Rom（alpha = 0），用来和 centripetal 对照。 */
function uniformCR(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): number {
  const t = u
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
  )
}

/** 一段内最大的「超出两端点区间」的量。 */
function maxOvershoot(
  seg: (u: number) => number,
  a: number,
  b: number,
  steps = 400,
): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  let worst = 0
  for (let k = 0; k <= steps; k++) {
    const v = seg(k / steps)
    worst = Math.max(worst, lo - v, v - hi)
  }
  return worst
}

describe('centripetal CR 的不过冲性质', () => {
  // 一条左右交替的折线锚点，正是本项目里容易诱发过冲的形态
  const stops: Stop[] = [
    stop('a', 0, 0),
    stop('b', 26, -56),
    stop('c', -26, -112),
    stop('d', 26, -168),
    stop('e', -26, -224),
  ]

  it('过冲量远小于 uniform CR（证明参数化确实是 centripetal）', () => {
    const path = buildPath(stops)
    const pts: Vec3[] = stops.map((s) => ({ x: s.x, y: s.y, z: 0 }))

    let centripetalWorst = 0
    let uniformWorst = 0

    for (let seg = 0; seg < path.last; seg++) {
      const p0 = pts[Math.max(seg - 1, 0)]
      const p1 = pts[seg]
      const p2 = pts[seg + 1]
      const p3 = pts[Math.min(seg + 2, pts.length - 1)]

      centripetalWorst = Math.max(
        centripetalWorst,
        maxOvershoot((u) => path.sample(seg + u).x, p1.x, p2.x),
      )
      uniformWorst = Math.max(
        uniformWorst,
        maxOvershoot((u) => uniformCR(p0, p1, p2, p3, u), p1.x, p2.x),
      )
    }

    // centripetal 应当显著优于 uniform（Yuksel 2011 的结论）
    expect(centripetalWorst).toBeLessThan(uniformWorst)
    // 绝对值也小：本项目 26rem 振幅下，过冲主要来自首段的端点效应，
    // 实测约 0.19rem（0.7% 振幅，16px 根字号下约 3px）
    expect(centripetalWorst).toBeLessThan(0.25)
  })

  it('过冲量级可忽略（< 1% 振幅）', () => {
    const path = buildPath(stops)
    const amp = 26
    for (let seg = 0; seg < path.last; seg++) {
      const lo = Math.min(stops[seg].x, stops[seg + 1].x)
      const hi = Math.max(stops[seg].x, stops[seg + 1].x)
      const over = maxOvershoot((u) => path.sample(seg + u).x, lo, hi)
      // 首段因端点复制有约 0.19rem 过冲（0.7% 振幅）；内段严格为 0。
      expect(over / amp).toBeLessThan(0.01)
    }
  })

  it('内段（非首段）严格不过冲', () => {
    const path = buildPath(stops)
    for (let seg = 1; seg < path.last; seg++) {
      const lo = Math.min(stops[seg].x, stops[seg + 1].x)
      const hi = Math.max(stops[seg].x, stops[seg + 1].x)
      const over = maxOvershoot((u) => path.sample(seg + u).x, lo, hi)
      expect(over).toBeLessThan(1e-9)
    }
  })
})
