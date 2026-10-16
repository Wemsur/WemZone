import { describe, expect, it } from 'vitest'

import { CAMERA } from '@/engine/constants'
import { buildPath } from '@/engine/spatial'
import { buildStops } from '@/engine/stops'

describe('区块布局', () => {
  const stops = buildStops()

  it('y 坐标随索引递增 —— 首页在最上方', () => {
    // 回归测试：VERTICAL_SPACING 曾经是负值，导致索引越大的区块被摆得越高，
    // 「首页」反而跑到了所有区块下面。CSS 里 +Y 是向下，所以这个常量必须是正的。
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].y).toBeGreaterThan(stops[i - 1].y)
    }
  })

  it('首页在 y 最小处（最上方）', () => {
    const minY = Math.min(...stops.map((s) => s.y))
    const first = stops.find((s) => s.id === 'home')
    expect(first?.y).toBe(minY)
  })

  it('相机索引增大时 y 增大（向下滚动 = 下一区）', () => {
    const path = buildPath(stops)
    for (let i = 1; i <= path.last; i++) {
      expect(path.sample(i).y).toBeGreaterThan(path.sample(i - 1).y)
    }
  })

  it('左右交替：相邻区块的 x 异号', () => {
    for (let i = 1; i < stops.length; i++) {
      expect(Math.sign(stops[i].x)).toBe(-Math.sign(stops[i - 1].x))
    }
  })

  it('相机距离都为正（否则内容会跑到相机背后）', () => {
    for (const s of stops) expect(s.d).toBeGreaterThan(0)
  })

  it('区块间距足够大，相邻区块在视野里不会互相干扰', () => {
    expect(CAMERA.VERTICAL_SPACING).toBeGreaterThan(CAMERA.BASE_DISTANCE)
  })
})
