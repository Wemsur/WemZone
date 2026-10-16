/**
 * 指数追赶（从 Celestial-Web 的 `lib/scroll.ts` 原样抽出）
 *
 * 用**半衰期**而不是「每帧走百分之几」，是为了让 60Hz 与 144Hz 屏幕上的
 * 黏滞手感一致 —— 这是那段代码里最有价值的 8 行。
 *
 * 相机引擎里它**不是主驱动**（PULL 用解析解弹簧、TRANSIT 用固定时长补间），
 * 保留在这里是给 SETTLE 阶段收尾、以及将来可能需要的其它追赶场景用。
 */

/** 剩余距离减半所需的毫秒数 */
export const SMOOTH_HALF_LIFE = 120

/**
 * 指数衰减追赶：dt 毫秒后，current 与 target 的剩余距离为 2^(-dt/halfLife)。
 * 纯函数，不含任何全局状态。
 */
export function chase(
  current: number,
  target: number,
  dtMs: number,
  halfLife = SMOOTH_HALF_LIFE,
): number {
  return current + (target - current) * (1 - Math.pow(2, -dtMs / halfLife))
}

/** 用户是否要求减少动效。追赶类的效果都要读它一次。 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
