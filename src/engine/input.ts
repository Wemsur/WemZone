/**
 * 输入层：把滚轮 / 触摸 / 键盘归一化成「意图」
 *
 * ## 核心难题：触控板惯性
 *
 * 精密触控板一次滑动会产生 **50–200 个 wheel 事件**，其中手指抬起后还有
 * 一段衰减的动量尾巴。若逐事件判「够不够一格」，一次猛滑会连切三四区。
 *
 * 所以判据必须是**手势级而非事件级**：
 *
 *  - 维护 `accum`（本次手势累计位移）、`lastT`、`committed`。
 *  - 手势之间靠 `GESTURE_GAP_MS` 的静默切分。
 *  - **一次手势最多提交一个 step**：`committed` 一旦置真，本次手势剩下的
 *    所有事件（含整条惯性尾巴）全部丢弃。
 *  - 提交后还有一段 `GESTURE_COOLDOWN_MS` 冷却，吃掉尾巴的余波。
 *
 * ## 阈值
 *
 *  - 滚轮一格约 100px < `STEP_THRESHOLD_PX`(150) → **只抖不切**（pull），
 *    与访谈确认的「滚轮一格算微弱」一致。
 *  - 两格连击（约 200px）越过阈值 → step。
 *  - 触控板猛滑：速度分支（≥3 px/ms 且累计 ≥40px）在滑到 40px 时就提交，
 *    随后整条惯性尾巴被吞掉 → 恰好一格。
 */

import { CAMERA } from './constants'
import type { Intent } from './types'

export interface InputSource {
  /** 挂上监听，返回卸载函数。 */
  attach(): () => void
  /** 订阅意图，返回退订函数。 */
  onIntent(cb: (intent: Intent) => void): () => void
  /** 进入 TRANSIT 时锁输入（丢弃一切意图）。 */
  lock(): void
  unlock(): void
  /** 当前是否锁定。 */
  readonly locked: boolean
}

export interface InputOptions {
  /** 当前索引（用于边界判定） */
  getIndex: () => number
  /** 最后一个合法索引 */
  last: number
}

/** 把 wheel 事件的 delta 归一化成像素。 */
function normalizeWheel(e: WheelEvent): number {
  let d = e.deltaY
  if (e.deltaMode === 1) d *= CAMERA.WHEEL_LINE_PX // 行
  else if (e.deltaMode === 2) d *= window.innerHeight // 页
  return d
}

export function createInput(opts: InputOptions): InputSource {
  const listeners = new Set<(intent: Intent) => void>()
  let locked = false

  // 手势状态
  let accum = 0
  let lastT = 0
  let prevT = 0
  let committed = false
  let cooldownUntil = 0

  function emit(intent: Intent): void {
    if (locked) return
    for (const cb of listeners) cb(intent)
  }

  /** 提交一次切换。方向朝外且已在边界 → 退化成橡皮筋。 */
  function commitStep(dir: 1 | -1, speed: number): void {
    const index = opts.getIndex()
    const atStart = dir === -1 && index <= 0.001
    const atEnd = dir === 1 && index >= opts.last - 0.001
    if (atStart || atEnd) {
      emit({ kind: 'pull', delta: dir * Math.max(Math.abs(accum), 60) })
    } else {
      emit({ kind: 'step', dir, speed })
    }
  }

  function onWheel(e: WheelEvent): void {
    // 捏合缩放 / 横向滚动：不是我们的意图
    if (e.ctrlKey) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

    const now = performance.now()
    const delta = normalizeWheel(e)

    // 手势切分：静默够久就是新手势
    if (now - lastT > CAMERA.GESTURE_GAP_MS) {
      accum = 0
      committed = false
    }

    prevT = lastT
    lastT = now

    // 已提交 / 冷却中 / 锁定：丢弃（这就是吞掉惯性尾巴的地方）
    if (committed || now < cooldownUntil) return

    accum += delta

    const dt = Math.max(now - prevT, 1)
    const v = Math.abs(delta) / dt

    const overThreshold = Math.abs(accum) >= CAMERA.STEP_THRESHOLD_PX
    // 速度分支只对「触控板式」的小步事件生效。
    // 滚轮一格是个大事件（约 100px），按事件间隔算出来的「速度」反而很高，
    // 若不排除它，两格滚轮就会被误判成猛滑，750px 的阈值形同虚设。
    // 真正的区别是粒度而不是速度：触控板产生许多小事件，滚轮产生少数大事件。
    const trackpadLike = Math.abs(delta) <= CAMERA.TRACKPAD_MAX_EVENT_PX
    const fastFlick =
      trackpadLike &&
      v >= CAMERA.STEP_SPEED_PX_MS &&
      Math.abs(accum) >= CAMERA.STEP_SPEED_MIN_PX

    if (overThreshold || fastFlick) {
      committed = true
      cooldownUntil = now + CAMERA.GESTURE_COOLDOWN_MS
      commitStep(accum > 0 ? 1 : -1, v)
      accum = 0
    }
  }

  /**
   * 手势结束时（静默够久且未提交）把累计位移作为一次 pull 发出去。
   * 这给了「微弱滚动 → 果冻回弹」的输入。
   */
  function settleGesture(): void {
    if (committed || accum === 0) return
    if (performance.now() - lastT < CAMERA.GESTURE_GAP_MS) return
    emit({ kind: 'pull', delta: accum })
    accum = 0
  }

  // 手势结束没有原生事件，用一个低频检查器兜底（不排 rAF，避免空转）
  let settleTimer = 0
  function bumpSettleTimer(): void {
    if (settleTimer !== 0) clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => {
      settleTimer = 0
      settleGesture()
    }, CAMERA.GESTURE_GAP_MS)
  }

  function onWheelWithSettle(e: WheelEvent): void {
    onWheel(e)
    bumpSettleTimer()
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return
    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
        emit({ kind: 'step', dir: 1, speed: 0 })
        e.preventDefault()
        break
      case 'ArrowUp':
      case 'PageUp':
        emit({ kind: 'step', dir: -1, speed: 0 })
        e.preventDefault()
        break
      case ' ':
        emit({ kind: 'step', dir: e.shiftKey ? -1 : 1, speed: 0 })
        e.preventDefault()
        break
      case 'Home':
        emit({ kind: 'jump', index: 0 })
        e.preventDefault()
        break
      case 'End':
        emit({ kind: 'jump', index: opts.last })
        e.preventDefault()
        break
      default:
        break
    }
  }

  return {
    attach(): () => void {
      // wheel 必须非 passive 才能 preventDefault（阻止页面滚动 / 缩放）
      window.addEventListener('wheel', onWheelWithSettle, { passive: true })
      window.addEventListener('keydown', onKeyDown)
      return () => {
        window.removeEventListener('wheel', onWheelWithSettle)
        window.removeEventListener('keydown', onKeyDown)
        if (settleTimer !== 0) clearTimeout(settleTimer)
      }
    },
    onIntent(cb): () => void {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    lock(): void {
      locked = true
      accum = 0
      committed = true
    },
    unlock(): void {
      locked = false
      accum = 0
      committed = false
      cooldownUntil = 0
    },
    get locked() {
      return locked
    },
  }
}
