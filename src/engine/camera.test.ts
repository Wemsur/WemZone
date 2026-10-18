import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCamera, type Engine } from '@/engine/camera'
import { CAMERA } from '@/engine/constants'
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

  it('一次 step 恰好走一格（不会冲过头）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)
    settle(cam)
    expect(cam.current).toBe(1)
    expect(cam.displayIndex).toBeLessThan(1.02)
    detach()
  })

  it('切换在合理时长内完成（0.5–2.5 秒）', () => {
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

  it('物理参数处于合理区间', () => {
    // ζ = c / (2√k)，要在 0.6–1.2 之间：太低会振荡多次，太高会显得迟钝
    const zeta = CAMERA.PHYSICS_DAMPING / (2 * Math.sqrt(CAMERA.PHYSICS_K))
    expect(zeta).toBeGreaterThan(0.6)
    expect(zeta).toBeLessThan(1.2)
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
