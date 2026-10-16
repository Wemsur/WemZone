/**
 * 弹簧-阻尼（解析解）
 *
 * ## 为什么用解析解而不是欧拉积分
 *
 * 欧拉积分的手感**随帧率变** —— 60Hz 与 144Hz 的过冲量不同，除非每帧切子步。
 * 这与 `chase()` 用半衰期而非「每帧百分比」是**同一条理由**：帧率无关。
 *
 * 欠阻尼闭式解
 *
 *     x(t) = e^(-ζω₀t) · (A·cos(ω_d t) + B·sin(ω_d t)) + target
 *     ω_d  = ω₀ · √(1 - ζ²)
 *
 * 对**任意 dt 精确**，一行 Math.exp/sin/cos 就够，不需要累积误差控制。
 *
 * 参数取自 `constants.ts` 的 SPRING_ZETA / SPRING_OMEGA。
 */

import { CAMERA } from './constants'

export interface SpringState {
  /** 相对目标的位移（rem） */
  x: number
  /** 速度（rem/ms） */
  v: number
}

export interface SpringConfig {
  /** 固有角频率（rad/s） */
  omega: number
  /** 阻尼比。ζ < 1 欠阻尼（有回弹） */
  zeta: number
}

/** 把 rad/s 的 omega 换算成公式里的时间单位（ms）。 */
function omegaPerMs(omega: number): number {
  return omega / 1000
}

/**
 * 推进弹簧状态 dt 毫秒（相对目标 target）。返回新状态。
 *
 * 纯函数 —— 便于单测：同一初始状态 + 同一 dt 必得同一结果，与调用频率无关。
 */
export function springSolve(
  s: SpringState,
  target: number,
  dtMs: number,
  cfg: SpringConfig = { omega: CAMERA.SPRING_OMEGA, zeta: CAMERA.SPRING_ZETA },
): SpringState {
  if (dtMs <= 0) return { x: s.x, v: s.v }

  const w0 = omegaPerMs(cfg.omega)
  const zeta = cfg.zeta
  // 位移相对于目标
  const x0 = s.x - target
  const v0 = s.v

  if (zeta < 1) {
    // 欠阻尼：有回弹
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * w0 * dtMs)
    const cos = Math.cos(wd * dtMs)
    const sin = Math.sin(wd * dtMs)

    // A = x0, B = (v0 + ζω₀x0) / ω_d
    const A = x0
    const B = (v0 + zeta * w0 * x0) / wd

    const x = decay * (A * cos + B * sin) + target
    // 求导得速度
    const v =
      decay *
        (-zeta * w0 * (A * cos + B * sin) + wd * (-A * sin + B * cos)) +
      0

    return { x, v }
  }

  if (zeta === 1) {
    // 临界阻尼
    const decay = Math.exp(-w0 * dtMs)
    const A = x0
    const B = v0 + w0 * x0
    const x = decay * (A + B * dtMs) + target
    const v = decay * (B - w0 * (A + B * dtMs))
    return { x, v }
  }

  // 过阻尼：两个实根
  const r = w0 * Math.sqrt(zeta * zeta - 1)
  const r1 = -zeta * w0 + r
  const r2 = -zeta * w0 - r
  const c2 = (v0 - r1 * x0) / (r2 - r1)
  const c1 = x0 - c2
  const x = c1 * Math.exp(r1 * dtMs) + c2 * Math.exp(r2 * dtMs) + target
  const v = c1 * r1 * Math.exp(r1 * dtMs) + c2 * r2 * Math.exp(r2 * dtMs)
  return { x, v }
}

/** 弹簧是否已经静止到可以停帧。 */
export function springSettled(
  s: SpringState,
  target: number,
  epsX = CAMERA.SPRING_EPS_X,
  epsV = CAMERA.SPRING_EPS_V,
): boolean {
  return Math.abs(s.x - target) < epsX && Math.abs(s.v) < epsV
}
