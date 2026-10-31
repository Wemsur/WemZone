import { describe, expect, it } from 'vitest'

import {
  advance,
  atRest,
  barrierHeight,
  potentialEnergy,
  potentialForce,
  FIXED_STEP,
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

  it('固定步长下推进 100ms 不会让位置爆炸（标签页切回来）', () => {
    let st = { s: 0, v: 0 }
    const steps = Math.ceil(0.1 / FIXED_STEP)
    for (let i = 0; i < steps; i++) st = advance(st, 1, 0, FIXED_STEP, P)
    expect(Number.isFinite(st.s)).toBe(true)
    expect(Math.abs(st.s)).toBeLessThan(10)
  })

  it('固定步长足够小：数值阻尼可以忽略', () => {
    // 240Hz。见 camera.ts 的说明：步长越大，半隐式欧拉的数值阻尼越明显，
    // 过冲会随刷新率变化。
    expect(FIXED_STEP).toBeLessThanOrEqual(1 / 240)
  })

  it('越界时由更软、阻尼更大的边界弹簧拉回', () => {
    const p: PhysicsParams = {
      k: 450,
      damping: 42,
      maxSpeed: 12,
      anchorSaturation: 0.5,
      bounds: { min: 0, max: 4 },
      edgeStiffness: 280,
      edgeDamping: 55,
    }
    // 在首页之上：应当被朝正方向推回
    const below = advance({ s: -0.05, v: 0 }, 0, 0, 1 / 240, p)
    expect(below.v).toBeGreaterThan(0)
    // 在末页之下：应当被朝负方向推回
    const above = advance({ s: 4.05, v: 0 }, 4, 0, 1 / 240, p)
    expect(above.v).toBeLessThan(0)

    // 边界弹簧比内部软：同样 0.05 的偏移，回推速度明显更小
    const inside = advance({ s: 0.05, v: 0 }, 0, 0, 1 / 240, {
      ...p,
      bounds: undefined,
    })
    expect(Math.abs(below.v)).toBeLessThan(Math.abs(inside.v))
  })

  it('边界外不再受周期势能影响（不会被拉向不存在的上一页）', () => {
    const p: PhysicsParams = {
      k: 450,
      damping: 42,
      maxSpeed: 12,
      bounds: { min: 0, max: 4 },
      edgeStiffness: 280,
      edgeDamping: 55,
    }
    // 在 −0.6 处，周期势能会把人拉向 −1；有边界时必须是朝 0 拉回
    const out = advance({ s: -0.6, v: 0 }, 0, 0, 1 / 240, p)
    expect(out.v).toBeGreaterThan(0)
  })
})

describe('静止判定', () => {
  it('在目标井且速度小 → 静止', () => {
    expect(atRest(1.00001, 0.0002, 1)).toBe(true)
  })

  it('偏移超过亚像素的吸附量 → 不算静止（否则会看到瞬移）', () => {
    // epsS = 1.5e-5 索引 ≈ 0.06px 屏幕。1e-4 索引 ≈ 0.4px，应当继续收敛。
    expect(atRest(1.0001, 0.0002, 1)).toBe(false)
  })

  it('不在目标井 → 未静止', () => {
    expect(atRest(0.5, 0, 1)).toBe(false)
  })

  it('速度大 → 未静止', () => {
    expect(atRest(1, 0.5, 1)).toBe(false)
  })
})
