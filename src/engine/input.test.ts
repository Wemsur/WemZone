import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CAMERA } from '@/engine/constants'
import { createInput } from '@/engine/input'
import type { Intent } from '@/engine/types'

/**
 * 输入手势分类
 *
 * 这些测试直接驱动 `createInput`，用受控的 `performance.now()` 模拟
 * 「一格滚轮」「触控板猛滑 + 惯性尾巴」「慢速长滑」等手势。
 */

let now = 0
let handlers: Record<string, (e: unknown) => void> = {}

beforeEach(() => {
  now = 0
  handlers = {}
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('window', {
    innerHeight: 900,
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      handlers[type] = cb
    },
    removeEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup(getIndex = () => 0, getSensitivity?: () => number) {
  const intents: Intent[] = []
  const input = createInput({ getIndex, last: 4, getSensitivity })
  input.attach()
  input.onIntent((i) => intents.push(i))
  return { intents, input }
}

function wheel(deltaY: number, dtMs: number): void {
  now += dtMs
  handlers.wheel?.({ deltaY, deltaMode: 0, ctrlKey: false, deltaX: 0 })
}

describe('输入手势分类', () => {
  it('滚轮一格（约 100px）不提交切换', () => {
    const { intents } = setup()
    wheel(100, 16)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('连续滚 5 格（约 500px）仍不切换 —— 阈值已调大到 750', () => {
    const { intents } = setup()
    for (let i = 0; i < 5; i++) wheel(100, 16)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('慢速连续滚 8 格（约 800px）越过阈值 → 提交一次', () => {
    const { intents } = setup()
    // 每格间隔 40ms，速度 2.5px/ms < STEP_SPEED_PX_MS(4)，走累计分支
    for (let i = 0; i < 8; i++) wheel(100, 40)
    const steps = intents.filter((i) => i.kind === 'step')
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ kind: 'step', dir: 1 })
  })

  it('触控板猛滑 + 惯性尾巴 → 恰好一格', () => {
    const { intents } = setup()
    // 手指阶段：快速大 delta
    for (let i = 0; i < 8; i++) wheel(45, 4)
    // 惯性尾巴：逐渐衰减
    for (let i = 0; i < 50; i++) wheel(Math.max(30 - i * 0.5, 1), 4)

    const steps = intents.filter((i) => i.kind === 'step')
    expect(steps).toHaveLength(1)
  })

  it('轻柔的两指滑动不误判为翻页', () => {
    const { intents } = setup()
    // 慢速小幅：每 60ms 走 20px（0.33px/ms），累计 200px
    for (let i = 0; i < 10; i++) wheel(20, 60)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('向上滚动提交 dir = -1', () => {
    // 从中间位置出发：索引 0 处向上滚是边界橡皮筋，不会提交
    const { intents } = setup(() => 2)
    for (let i = 0; i < 8; i++) wheel(-100, 40)
    const steps = intents.filter((i) => i.kind === 'step')
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ kind: 'step', dir: -1 })
  })

  it('边界处向外滚动退化为橡皮筋（pull），不提交', () => {
    const { intents } = setup(() => 0)
    for (let i = 0; i < 8; i++) wheel(-100, 40)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('滚轮的两格（约 200px）不因「速度快」被误判 —— 粒度才是判据', () => {
    const { intents } = setup()
    // 两格，每格一个大事件（100px）。按事件间隔算速度会很高（6.25px/ms），
    // 但它不是触控板式的小步，不该走速度分支。
    wheel(100, 16)
    wheel(100, 16)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('横向滚动与捏合缩放被忽略', () => {
    const { intents } = setup()
    now += 16
    handlers.wheel?.({ deltaY: 0, deltaX: 500, deltaMode: 0, ctrlKey: false })
    now += 16
    handlers.wheel?.({ deltaY: 500, deltaX: 0, deltaMode: 0, ctrlKey: true })
    expect(intents).toHaveLength(0)
  })

  it('键盘方向键映射到正确的方向', () => {
    const { intents } = setup()
    handlers.keydown?.({ key: 'ArrowDown', repeat: false, preventDefault: () => {} })
    handlers.keydown?.({ key: 'ArrowUp', repeat: false, preventDefault: () => {} })
    handlers.keydown?.({ key: 'Home', repeat: false, preventDefault: () => {} })
    handlers.keydown?.({ key: 'End', repeat: false, preventDefault: () => {} })

    expect(intents[0]).toMatchObject({ kind: 'step', dir: 1 })
    expect(intents[1]).toMatchObject({ kind: 'step', dir: -1 })
    expect(intents[2]).toMatchObject({ kind: 'jump', index: 0 })
    expect(intents[3]).toMatchObject({ kind: 'jump', index: 4 })
  })

  it('按住不放（e.repeat）不会连续翻页', () => {
    const { intents } = setup()
    for (let i = 0; i < 10; i++) {
      handlers.keydown?.({ key: 'ArrowDown', repeat: true, preventDefault: () => {} })
    }
    expect(intents).toHaveLength(0)
  })

  it('阈值与速度常量处于合理区间', () => {
    // 阈值应远大于一格滚轮，但又不至于要滚十几格
    expect(CAMERA.STEP_THRESHOLD_PX).toBeGreaterThan(CAMERA.WHEEL_LINE_PX * 5)
    expect(CAMERA.STEP_THRESHOLD_PX).toBeLessThan(1200)
    // 速度分支的累计下限不能太小，否则轻滑就翻页
    expect(CAMERA.STEP_SPEED_MIN_PX).toBeGreaterThan(100)
  })

  /* ---- 用户灵敏度 ---- */

  it('灵敏度放大时，同样的滚动更早翻页', () => {
    // 4 格慢滚 = 500px × 2.5 = 1000px，越过 750 阈值
    const { intents } = setup(() => 2, () => 2.5)
    for (let i = 0; i < 4; i++) wheel(100, 40)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(1)
  })

  it('灵敏度调低时，同样的滚动不足以翻页', () => {
    // 12 格慢滚 = 1200px × 0.4 = 480px，仍在阈值下
    const { intents } = setup(() => 2, () => 0.4)
    for (let i = 0; i < 12; i++) wheel(100, 40)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })

  it('灵敏度也缩放果冻的力度（pull 的 delta）', () => {
    const { intents } = setup(() => 2, () => 2)
    wheel(50, 40)
    const pull = intents.find((i) => i.kind === 'pull')
    expect(pull).toMatchObject({ kind: 'pull', delta: 100 })
  })

  it('灵敏度不改变「滚轮大事件」的粒度判定', () => {
    // 滚轮一格 100px，即使灵敏度调到 2.5（150px）也不该走速度分支
    const { intents } = setup(() => 2, () => 2.5)
    wheel(100, 16)
    wheel(100, 16)
    expect(intents.filter((i) => i.kind === 'step')).toHaveLength(0)
  })
})
