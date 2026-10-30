/**
 * 开发调试用的全局时间缩放（慢放）
 *
 * `setTimeScale(0.25)` 之后，相机引擎感知到的时间流速变成 1/4：
 * 同样的切换动画会走 4 倍长的真实时间，方便逐帧观察轨迹、过冲、模糊与倾斜。
 *
 * ## 它影响什么、不影响什么
 *
 * **影响**（引擎内部所有「按秒」的量）：
 *  - 物理积分的 dt → 轨迹、过冲、落位时长
 *  - 输入力的半衰期衰减（90ms）
 *  - 由速度驱动的运动模糊与动态倾斜（速度本身不变，所以观感强度不变，
 *    只是持续更久）
 *  - 空闲晃动（CSS 动画时长，通过 `--wz-time-scale` 变量）
 *
 * **不影响**（输入判定保持真实时间）：
 *  - 手势切分（`GESTURE_GAP_MS`）、提交冷却、滚轮/触控板阈值
 *
 * 这是刻意的：慢放是为了「做一次正常操作，然后观察它的动画」。
 * 如果连输入的时间窗口也一起缩放，真实操作会被拆成多次手势，
 * 反而没法复现。
 *
 * **不进 localStorage**：它是调试开关，不该在刷新后还生效。
 */

const MIN_SCALE = 0.02
const MAX_SCALE = 1

let timeScale = 1

export function getTimeScale(): number {
  return timeScale
}

/**
 * 设置时间流速。1 = 正常，0.25 = 四倍慢放，0.1 = 十倍慢放。
 * 超出 [0.02, 1] 会被钳住。
 */
export function setTimeScale(scale: number): void {
  if (!Number.isFinite(scale)) return
  timeScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
  // 空闲晃动是 CSS 动画，靠这个变量把时长拉长
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--wz-time-scale', String(timeScale))
  }
}

/** 是否处于慢放（面板用来显示状态）。 */
export function isSlowMotion(): boolean {
  return timeScale < 0.999
}
