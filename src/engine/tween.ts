/**
 * 转场补间
 *
 * ## 为什么不能用 `chase()`（指数追赶）
 *
 * 指数追赶是「一开始最快、单调减速」，只有「快 → 慢」，**没有「慢」的开头**。
 * 而需求明确要「先慢后快再慢」。所以转场必须是**固定时长 + ease-in-out 补间**。
 *
 * 时长随提交速度调节：轻轻推 → 舒展；猛滑 → 干脆。但始终保留可感知的
 * 「慢-快-慢」（由缓动曲线保证，与时长无关）。
 */

import { CAMERA } from './constants'

/** 缓动函数：输入 [0,1]，输出 [0,1]，端点导数为 0。 */
export type Ease = (t: number) => number

/** 三次缓入缓出。默认曲线。 */
export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** 五次缓入缓出（smootherstep）。比三次更「平缓」的两端，Phase 5 可切换。 */
export const smootherstep: Ease = (t) => t * t * t * (t * (t * 6 - 15) + 10)

export interface Tween {
  /** 推进 dt 毫秒，返回当前值。 */
  step(dtMs: number): number
  /** 是否已经到达终点。 */
  readonly done: boolean
  /** 当前值（不推进）。 */
  readonly value: number
}

export function makeTween(from: number, to: number, durationMs: number, ease: Ease): Tween {
  const duration = Math.max(durationMs, 1)
  let elapsed = 0
  let current = from
  let finished = false

  return {
    step(dtMs: number): number {
      if (finished) return current
      elapsed += dtMs
      const t = elapsed >= duration ? 1 : elapsed / duration
      current = from + (to - from) * ease(t)
      if (t >= 1) {
        current = to
        finished = true
      }
      return current
    },
    get done() {
      return finished
    },
    get value() {
      return current
    },
  }
}

/**
 * 按提交速度算转场时长：越快越短，但钳在 [MIN, MAX] 内。
 * 保证任何速度下都还有可感知的「慢-快-慢」。
 */
export function transitDuration(speed: number): number {
  const d = CAMERA.TRANSIT_BASE_MS - speed * CAMERA.TRANSIT_SPEED_GAIN
  return Math.min(CAMERA.TRANSIT_MAX_MS, Math.max(CAMERA.TRANSIT_MIN_MS, d))
}
