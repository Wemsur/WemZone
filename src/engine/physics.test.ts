import { describe, expect, it } from 'vitest'

import {
  advance,
  atRest,
  barrierHeight,
  potentialEnergy,
  potentialForce,
  substepCount,
  type PhysicsParams,
} from '@/engine/physics'

const P: PhysicsParams = { k: 45, damping: 12, maxSpeed: 6 }

describe('势能', () => {
  it('整数处是极小值（区块中心）', () => {
    for (const s of [0, 1, 2, 3, -1]) {
      expect(potentialEnergy(s, P.k)).toBeCloseTo(0, 10)
      expect(potentialForce(s, P.k)).toBeCloseTo(0, 10)
    }
  })

  it('半整数处是极大值（区块之间）', () => {
    for (const s of [0.5, 1.5, 2.5]) {
      expect(potentialEnergy(s, P.k)).toBeCloseTo(barrierHeight(P.k), 10)
    }
  })

  it('力指向最近的井：s 略大于整数时为负（往回拉）', () => {
    expect(potentialForce(0.1, P.k)).toBeLessThan(0)
    expect(potentialForce(0.9, P.k)).toBeGreaterThan(0)
  })

  it('近井底时力近似线性（谐振子）', () => {
    const s = 0.001
    // F ≈ −k·s
    expect(potentialForce(s, P.k)).toBeCloseTo(-P.k * s, 4)
  })
})

describe('积分器', () => {
  it('在井底且无输入时保持不动', () => {
    const st = advance({ s: 0, v: 0 }, 0, 0, 1 / 60, P)
    expect(st.s).toBeCloseTo(0, 12)
    expect(st.v).toBeCloseTo(0, 12)
  })

  it('偏离井底后会回到井底（阻尼耗散能量）', () => {
    let st = { s: 0.3, v: 0 }
    for (let i = 0; i < 600; i++) st = advance(st, 0, 0, 1 / 60, P)
    expect(st.s).toBeCloseTo(0, 2)
    expect(Math.abs(st.v)).toBeLessThan(0.05)
  })

  it('锚定到另一个井：最终停在那里', () => {
    let st = { s: 0, v: 0 }
    for (let i = 0; i < 600; i++) st = advance(st, 1, 0, 1 / 60, P)
    expect(st.s).toBeCloseTo(1, 2)
  })

  it('速度被 maxSpeed 封顶', () => {
    let st = { s: 0, v: 0 }
    for (let i = 0; i < 100; i++) {
      st = advance(st, 5, 10000, 1 / 60, P)
      expect(Math.abs(st.v)).toBeLessThanOrEqual(P.maxSpeed + 1e-9)
    }
  })

  it('大 dt 不会让位置爆炸（半隐式欧拉 + 子步）', () => {
    const dt = 0.1 // 100ms，标签页切回来
    const steps = substepCount(dt)
    let st = { s: 0, v: 0 }
    const sub = dt / steps
    for (let i = 0; i < steps; i++) st = advance(st, 1, 0, sub, P)
    // 一个子步序列后位置应在合理范围（不会飞到 1e6）
    expect(Number.isFinite(st.s)).toBe(true)
    expect(Math.abs(st.s)).toBeLessThan(10)
  })

  it('子步数随 dt 增大', () => {
    expect(substepCount(1 / 120)).toBe(1)
    expect(substepCount(1 / 60)).toBe(1)
    expect(substepCount(0.1)).toBeGreaterThanOrEqual(6)
  })
})

describe('静止判定', () => {
  it('在目标井且速度小 → 静止', () => {
    expect(atRest(1.0005, 0.001, 1)).toBe(true)
  })

  it('不在目标井 → 未静止', () => {
    expect(atRest(0.5, 0, 1)).toBe(false)
  })

  it('速度大 → 未静止', () => {
    expect(atRest(1, 0.5, 1)).toBe(false)
  })
})
