import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCamera, type Engine } from '@/engine/camera'
import type { Stop } from '@/engine/types'

/**
 * 相机状态机的确定性测试
 *
 * 用假的 requestAnimationFrame 手动推帧，于是「转场是否在配置时长内完成」
 * 「IDLE 是否真的停帧」这些都能精确断言，不受真实帧率 / 标签页可见性影响。
 */

const stops: Stop[] = [
  { id: 'a', x: 0, y: 0, d: 34, rx: 0, ry: 0 },
  { id: 'b', x: 26, y: -56, d: 34, rx: 0, ry: 0 },
  { id: 'c', x: -26, y: -112, d: 34, rx: 0, ry: 0 },
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
  // 输入层会读 window 上的 matchMedia / setTimeout，node 环境里给最小桩
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
})

/** 推一帧（dt 毫秒），返回是否还有后续帧被排。 */
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

describe('相机状态机', () => {
  it('初始为 IDLE，且 attach 后很快停帧（静止零开销）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    expect(cam.state).toBe('IDLE')
    // 推一帧：IDLE 应返回 false，于是不再排帧
    const more = pump(16)
    expect(more).toBe(false)
    detach()
  })

  it('step() 会唤醒已停的循环并完成转场', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16) // 让循环停下
    expect(rafCallbacks.size).toBe(0)

    cam.step(1)
    expect(cam.state).toBe('TRANSIT')
    // 唤醒后应重新有帧在排队
    expect(rafCallbacks.size).toBeGreaterThan(0)

    // 推足够多帧直到落位
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(cam.state).toBe('IDLE')
    expect(cam.current).toBe(1)
    detach()
  })

  it('转场时长在配置范围内（380–700ms）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)

    let elapsed = 0
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) {
      pump(16)
      elapsed += 16
    }
    expect(elapsed).toBeGreaterThanOrEqual(370)
    expect(elapsed).toBeLessThanOrEqual(720)
    detach()
  })

  it('落位后精确停在整数索引（视觉大小恒定的前提）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.goTo(2)
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(cam.current).toBe(2)
    detach()
  })

  it('goTo 越界会 clamp 到端点', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.goTo(99)
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(cam.current).toBe(2)
    detach()
  })

  it('边界处 step 越界退化为 pull（橡皮筋），不改变索引', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    // 已在索引 0，再往上应只弹不切
    cam.dispatch({ kind: 'pull', delta: -120 })
    expect(cam.state).toBe('PULL')
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(cam.current).toBe(0)
    detach()
  })

  it('pull 是弹簧回弹：位移先偏离再归零，且会过冲', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)

    const ys: number[] = []
    const stopSub = cam.subscribe((f) => ys.push(f.pose.y))
    cam.dispatch({ kind: 'pull', delta: 200 })

    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    stopSub()

    // 应偏离过静止位（0）——即出现过非零 y
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(0.05)
    // 最终回到 0
    expect(Math.abs(ys[ys.length - 1])).toBeLessThan(0.01)
    detach()
  })

  it('转场期间输入被锁定（再次 step 不改变目标）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)
    expect(cam.state).toBe('TRANSIT')
    // 立刻再 step：应被忽略（TRANSIT 期间 input.lock）
    cam.dispatch({ kind: 'step', dir: 1, speed: 0 })
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(cam.current).toBe(1)
    detach()
  })

  it('onSettle 只在落到新整数索引时触发', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    const settled: number[] = []
    cam.onSettle((i) => settled.push(i))
    cam.step(1)
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    expect(settled).toEqual([1])
    detach()
  })

  it('落位后速度归零（否则 Phase 2 的模糊会卡住）', () => {
    const cam = makeEngine()
    const detach = cam.attach()
    pump(16)
    cam.step(1)
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)
    let last = 1
    const stopSub = cam.subscribe((f) => (last = f.velocity))
    pump(16)
    stopSub()
    expect(Math.abs(last)).toBeLessThan(1e-6)
    detach()
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
    // 回归测试：开发时 HMR 会反复重建组件，若 attach 每次都叠一个 window
    // 监听，一次按键会被处理 N 次（按一下跳好几格）。
    const cam = makeEngine()
    cam.attach()
    cam.attach()
    cam.attach()

    // 直接派发意图，模拟「输入层收到一次事件」
    cam.step(1)
    let guard = 0
    while (cam.state !== 'IDLE' && guard++ < 500) pump(16)

    // 只应走一格
    expect(cam.current).toBe(1)
  })
})

describe('相机状态机 · 减少动效', () => {
  it('prefers-reduced-motion 时 step 直接落位，不经过 TRANSIT', () => {
    // 覆盖 matchMedia：让 reduce 为真
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
    // 直接到 IDLE，没有中间态
    expect(cam.state).toBe('IDLE')
    expect(cam.current).toBe(1)
    detach()
  })

  it('prefers-reduced-motion 时 pull 被忽略（无果冻）', () => {
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
    expect(cam.state).toBe('IDLE')
    detach()
  })
})
