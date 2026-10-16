import { describe, expect, it } from 'vitest'

import { springSettled, springSolve } from '@/engine/spring'

const cfg = { omega: 14, zeta: 0.55 }

describe('springSolve（解析解）', () => {
  it('dt = 0 时不改变状态', () => {
    const s = { x: 5, v: 2 }
    const out = springSolve(s, 0, 0, cfg)
    expect(out.x).toBe(5)
    expect(out.v).toBe(2)
  })

  it('欠阻尼会过冲（ζ = 0.55）', () => {
    // 从位移 5、速度 0 出发，向 0 收敛，途中应穿过 0（过冲）
    let s = { x: 5, v: 0 }
    let crossed = false
    for (let i = 0; i < 200; i++) {
      s = springSolve(s, 0, 8, cfg)
      if (s.x < 0) crossed = true
    }
    expect(crossed).toBe(true)
  })

  it('帧率无关：一大步 ≈ 多小步（解析解的核心保证）', () => {
    const big = springSolve({ x: 5, v: 0 }, 0, 32, cfg)
    let small = { x: 5, v: 0 }
    for (let i = 0; i < 4; i++) small = springSolve(small, 0, 8, cfg)
    // 指数解可叠加，两者应几乎相同
    expect(small.x).toBeCloseTo(big.x, 6)
    expect(small.v).toBeCloseTo(big.v, 6)
  })

  it('最终收敛到目标', () => {
    let s = { x: 5, v: 0 }
    for (let i = 0; i < 2000; i++) s = springSolve(s, 0, 16, cfg)
    expect(Math.abs(s.x)).toBeLessThan(1e-6)
    expect(Math.abs(s.v)).toBeLessThan(1e-6)
  })

  it('临界阻尼（ζ = 1）不过冲', () => {
    let s = { x: 5, v: 0 }
    let everNegative = false
    for (let i = 0; i < 500; i++) {
      s = springSolve(s, 0, 8, { omega: 14, zeta: 1 })
      if (s.x < -1e-9) everNegative = true
    }
    expect(everNegative).toBe(false)
  })

  it('过阻尼（ζ = 2）单调收敛', () => {
    let s = { x: 5, v: 0 }
    let prev = 5
    for (let i = 0; i < 500; i++) {
      s = springSolve(s, 0, 8, { omega: 14, zeta: 2 })
      expect(s.x).toBeLessThanOrEqual(prev + 1e-9)
      prev = s.x
    }
  })

  it('springSettled 在收敛后为真', () => {
    let s = { x: 5, v: 0 }
    expect(springSettled(s, 0)).toBe(false)
    for (let i = 0; i < 2000; i++) s = springSolve(s, 0, 16, cfg)
    expect(springSettled(s, 0)).toBe(true)
  })
})
