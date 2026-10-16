import { describe, expect, it } from 'vitest'

import { CAMERA } from '@/engine/constants'
import { springSolve } from '@/engine/spring'

/**
 * 果冻回弹的幅度必须受控。
 *
 * 回归背景：早先 PULL_VEL_GAIN = 0.004 时，一次滚轮（100px）会得到
 * 400 rem/s 的初速度，峰值位移达到 14.9rem（239px）—— 是 PULL_MAX_DISP
 * 的 4.6 倍，看起来像整个平面被甩飞。原因是弹簧峰值 ≈ |x₀| + |v₀|/ω，
 * 而 v₀ 的单位是 rem/ms、ω 是 rad/s，差 1000 倍，速度项直接压过了位移项。
 */

/** 模拟一次 pull 后的峰值位移（rem）。 */
function peakDisplacement(delta: number): number {
  const d = Math.max(-CAMERA.PULL_MAX_DELTA, Math.min(CAMERA.PULL_MAX_DELTA, delta))
  const disp = Math.max(
    -CAMERA.PULL_MAX_DISP,
    Math.min(CAMERA.PULL_MAX_DISP, d * CAMERA.PULL_DISP_GAIN),
  )
  let s = { x: disp, v: d * CAMERA.PULL_VEL_GAIN }
  let peak = Math.abs(s.x)
  for (let i = 0; i < 600; i++) {
    s = springSolve(s, 0, 16)
    peak = Math.max(peak, Math.abs(s.x))
  }
  return peak
}

describe('果冻回弹幅度', () => {
  it('任何输入下峰值都不超过 PULL_MAX_DISP 的 1.5 倍', () => {
    // 弹簧会过冲，所以峰值略高于初位移是正常的；但不该失控。
    for (const d of [10, 50, 100, 200, 400, 740, 1500, 10000]) {
      expect(peakDisplacement(d)).toBeLessThan(CAMERA.PULL_MAX_DISP * 1.5)
    }
  })

  it('一次滚轮（约 100px）的位移是「轻微」量级（< 8px @16px 根字号）', () => {
    const px = peakDisplacement(100) * 16
    expect(px).toBeLessThan(8)
    expect(px).toBeGreaterThan(1) // 但也得看得出来
  })

  it('位移随输入单调增大，但会饱和', () => {
    const a = peakDisplacement(100)
    const b = peakDisplacement(300)
    const c = peakDisplacement(1500)
    expect(b).toBeGreaterThan(a)
    // 超过 PULL_MAX_DELTA 后饱和
    expect(peakDisplacement(5000)).toBeCloseTo(c, 6)
  })

  it('极端输入下仍会收敛回 0', () => {
    const d = CAMERA.PULL_MAX_DELTA
    let s = { x: d * CAMERA.PULL_DISP_GAIN, v: d * CAMERA.PULL_VEL_GAIN }
    for (let i = 0; i < 2000; i++) s = springSolve(s, 0, 16)
    expect(Math.abs(s.x)).toBeLessThan(1e-6)
  })
})
