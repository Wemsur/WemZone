import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCamera, type Engine } from '@/engine/camera'
import { CAMERA } from '@/engine/constants'
import { setTimeScale } from '@/engine/debug'
import { resetForTests } from '@/lib/scheduler'
import type { Stop } from '@/engine/types'

/**
 * 相机 = 连续受力质点
 *
 * 用假的 requestAnimationFrame 手动推帧，于是「切换是否在合理时长内完成」
 * 「静止后是否停帧」这些都能精确断言，不受真实帧率 / 标签页可见性影响。
 */

const stops: Stop[] = [
  { id: 'a', x: 0, y: 0, d: 34, rx: 0, ry: 0 },
  { id: 'b', x: 26, y: 72, d: 34, rx: 0, ry: 0 },
  { id: 'c', x: -26, y: 144, d: 34, rx: 0, ry: 0 },
]

let rafCallbacks: Map<number, FrameRequestCallback>
let nextId: number
let now: number

beforeEach(() => {
  rafCallbacks = new Map()
  nextId = 1
  now = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++
    rafCallbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('window', {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    innerHeight: 900,
    matchMedia: () => ({ matches: false }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  // 订阅表是模块级单例，测试之间共享 —— 必须清掉，
  // 否则上一个测试的引擎会继续响应下一个测试的 pump()。
  resetForTests()
  // 慢放是模块级状态，别泄漏到别的测试。
  setTimeScale(1)
})

function pump(dtMs: number): boolean {
  now += dtMs
  const pending = [...rafCallbacks.entries()]
  rafCallbacks.clear()
  for (const [, cb] of pending) cb(now)
  return rafCallbacks.size > 0
}

function makeEngine(): Engine {
  return createCamera({ stops, perspective: 120 })
}

/** 一直推到静止或超时，返回耗时（ms）。 */
function settle(_cam: Engine, maxMs = 5000): number {
  let elapsed = 0
  while (elapsed < maxMs) {
    const more = pump(16)
    elapsed += 16
    if (!more) break
  }
  return elapsed
}

describe('连续力学相机', () => {
  it('初始静止在 0，且很快停帧（静止零开销）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    expect(cam.current).toBe(0)
    const more = pump(16)
    expect(more).toBe(false)
    detach()
  })

  it('step() 会唤醒循环并走到目标井', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    expect(rafCallbacks.size).toBe(0)

    cam.step(1)
    expect(rafCallbacks.size).toBeGreaterThan(0)
    settle(cam)
    expect(cam.current).toBe(1)
    expect(cam.displayIndex).toBeCloseTo(1, 6)
    detach()
  })

  it('切换时会轻微过冲（用户要的「冲力」），但不会冲过头到下一格', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)

    let maxIndex = 0
    const stop = cam.subscribe((f) => {
      maxIndex = Math.max(maxIndex, f.index)
    })
    cam.step(1)
    settle(cam)
    stop()

    // 过冲必须看得见：约 1.2% 格距（约 50px 屏幕位移）
    expect(maxIndex).toBeGreaterThan(1.005)
    // 但不能逼近势垒（1.5）或跑进下一格
    expect(maxIndex).toBeLessThan(1.05)
    expect(cam.current).toBe(1)
    expect(cam.displayIndex).toBe(1)
    detach()
  })

  it('切换在合理时长内完成（0.4–2.5 秒）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)
    const ms = settle(cam)
    expect(ms).toBeGreaterThan(400)
    expect(ms).toBeLessThan(2500)
    detach()
  })

  it('轨迹呈「先慢后快再慢」：中段速度最大', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)

    const speeds: number[] = []
    const stop = cam.subscribe((f) => speeds.push(Math.abs(f.velocity)))
    cam.step(1)
    settle(cam)
    stop()

    // 去掉首尾的静止帧
    const moving = speeds.filter((v) => v > 0.01)
    expect(moving.length).toBeGreaterThan(10)

    const peakIdx = moving.indexOf(Math.max(...moving))
    // 峰值应在中段（不是第一帧、也不是最后一帧）
    expect(peakIdx).toBeGreaterThan(0)
    expect(peakIdx).toBeLessThan(moving.length - 1)
    detach()
  })

  it('落位后精确停在整数索引（视觉大小恒定的前提）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.goTo(2)
    settle(cam)
    expect(cam.current).toBe(2)
    expect(cam.displayIndex).toBe(2)
    detach()
  })

  it('goTo 越界会 clamp 到端点', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.goTo(99)
    settle(cam)
    expect(cam.current).toBe(2)
    detach()
  })

  it('边界处 step 越界不会改变目标', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(-1) // 已在 0
    settle(cam)
    expect(cam.current).toBe(0)
    expect(cam.target).toBe(0)
    detach()
  })

  it('滚动（pull）是力：能量不足时回到原井（果冻）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)

    let maxS = 0
    const stop = cam.subscribe((f) => {
      maxS = Math.max(maxS, f.index)
    })
    // 一个很小的滚动
    cam.dispatch({ kind: 'pull', delta: 40 })
    settle(cam)
    stop()

    // 偏离了（看得见），但没有翻页
    expect(maxS).toBeGreaterThan(0.002)
    expect(cam.current).toBe(0)
    expect(cam.displayIndex).toBe(0)
    detach()
  })

  it('更大的滚动给更多能量（偏离更远）', () => {
    const measure = (delta: number): number => {
      const cam = makeEngine()
      const detach = cam.attach()
      pump(16)
      let maxS = 0
      const stop = cam.subscribe((f) => {
        maxS = Math.max(maxS, f.index)
      })
      cam.dispatch({ kind: 'pull', delta })
      settle(cam)
      stop()
      detach()
      return maxS
    }
    const small = measure(50)
    const big = measure(200)
    expect(big).toBeGreaterThan(small)
  })

  it('goTo immediate 也会通知落位（深链接刷新后 HUD/hash 要跟着变）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    const settled: number[] = []
    cam.onSettle((i) => settled.push(i))
    cam.goTo(2, { immediate: true })
    expect(cam.current).toBe(2)
    expect(settled).toEqual([2])
    detach()
  })

  it('attach 幂等：重复 attach 不会让一次 step 走多格', () => {
    const cam = makeEngine()
    cam.attach()
    cam.attach()
    cam.attach()
    cam.step(1)
    settle(cam)
    expect(cam.current).toBe(1)
  })

  it('onSettle 只在落到新整数索引时触发', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    const settled: number[] = []
    cam.onSettle((i) => settled.push(i))
    cam.step(1)
    settle(cam)
    expect(settled).toEqual([1])
    detach()
  })

  it('落位后速度归零（否则运动模糊会卡住）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)
    settle(cam)
    let last = 1
    const stop = cam.subscribe((f) => (last = f.velocity))
    pump(16)
    stop()
    expect(Math.abs(last)).toBeLessThan(1e-6)
    detach()
  })

  it('落位前最后一帧的位移小于 0.1px（不会看到「突然吸过去」）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)

    // 屏幕放大 = P/d ≈ 3.53；1 索引 = 72rem = 1152px 世界坐标；根字号 16px。
    // 一帧的世界位移换算成屏幕像素：Δindex × 72 × 16 × 3.53
    const SCALE = (72 * 16 * (120 / 34))
    const positions: number[] = []
    const stop = cam.subscribe((f) => positions.push(f.index))
    cam.step(1)
    settle(cam)
    stop()

    // 找到「吸附」那一帧：最后一帧之后位置直接变成整数 1
    const lastMoving = positions[positions.length - 2] ?? positions[positions.length - 1]
    const jumpPx = Math.abs(1 - lastMoving) * SCALE
    expect(jumpPx).toBeLessThan(0.1)
    detach()
  })

  it('慢放：轨迹形状不变，只是时长按比例拉长', () => {
    const measure = (scale: number): { ms: number; peak: number } => {
      setTimeScale(scale)
      const cam = makeEngine()
      const detach = cam.attach()
      pump(16)
      let peak = 0
      const stop = cam.subscribe((f) => {
        peak = Math.max(peak, f.index)
      })
      cam.step(1)
      const ms = settle(cam, 20000)
      stop()
      detach()
      return { ms, peak }
    }

    const normal = measure(1)
    const slow = measure(0.25)

    // 慢放 4 倍 → 时长约 4 倍。离散帧长（16ms vs 4ms）会让落位点差几帧，
    // 实测约 4.7×，所以容差放到 3.3–5.0。
    expect(slow.ms / normal.ms).toBeGreaterThan(3.3)
    expect(slow.ms / normal.ms).toBeLessThan(5.0)
    // 轨迹形状不变：过冲幅度基本一致
    expect(Math.abs(slow.peak - normal.peak)).toBeLessThan(0.002)
  })

  it('物理参数处于合理区间', () => {
    // 近井底势能与锚定力叠加，有效刚度是 2k：
    //   ζeff = c / (2√(2k))
    // 必须欠阻尼（有过冲，这是用户要的「冲力」），但不能低到来回振荡。
    const zetaEff = CAMERA.PHYSICS_DAMPING / (2 * Math.sqrt(2 * CAMERA.PHYSICS_K))
    expect(zetaEff).toBeGreaterThan(0.45)
    expect(zetaEff).toBeLessThan(0.75)
  })
})

describe('减少动效', () => {
  it('prefers-reduced-motion 时 step 直接落位，不经过运动', () => {
    vi.stubGlobal('window', {
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: () => 0,
      clearTimeout: () => {},
      innerHeight: 900,
      matchMedia: (q: string) => ({ matches: q.includes('reduced-motion') }),
    })

    const cam = makeEngine()
    const detach = cam.attach()
    cam.step(1)
    expect(cam.state).toBe('IDLE')
    expect(cam.current).toBe(1)
    expect(cam.displayIndex).toBe(1)
    detach()
  })

  it('prefers-reduced-motion 时 pull 被忽略', () => {
    vi.stubGlobal('window', {
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: () => 0,
      clearTimeout: () => {},
      innerHeight: 900,
      matchMedia: (q: string) => ({ matches: q.includes('reduced-motion') }),
    })

    const cam = makeEngine()
    const detach = cam.attach()
    cam.dispatch({ kind: 'pull', delta: 200 })
    expect(cam.displayIndex).toBe(0)
    expect(cam.state).toBe('IDLE')
    detach()
  })
})
