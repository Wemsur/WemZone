/**
 * 用户偏好（不是调试参数）
 *
 * ## 为什么「滑动灵敏度」必须给用户一个旋钮
 *
 * 相机是连续力学的：一次手势能不能越过势垒，取决于**这一次手势累计了多少
 * 滚动像素**。而「多少像素」在不同设备上差一个数量级 —— 精密触控板滑一次
 * 往往只有一百多像素，廉价鼠标滚轮滚一格就是 100px，四向滚轮 / 高 DPI 滚轮
 * 的一格又可能是别的值。同一套阈值，在一台机器上是「轻轻一划就翻页」，
 * 在另一台机器上就是「滑得手酸也不动」。
 *
 * 所以把阈值整体缩放交给用户：灵敏度 2× 等于阈值减半（更容易翻页），
 * 0.5× 等于阈值翻倍（要滑更久）。它只影响**输入判定**，不影响力学本身 ——
 * 翻页之后的轨迹（过冲、回拉、果冻）永远一样。
 */

import { ref, watch } from 'vue'

const STORAGE_KEY = 'wemzone.scroll-sensitivity.v1'

/** 用户可调区间。过低会「怎么滑都不动」，过高会「一碰就飞」，都不要。 */
export const SENSITIVITY_MIN = 0.4
export const SENSITIVITY_MAX = 2.5

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function load(): number {
  if (typeof localStorage === 'undefined') return 1
  const raw = localStorage.getItem(STORAGE_KEY)
  const v = raw === null ? NaN : Number.parseFloat(raw)
  return Number.isFinite(v) ? clamp(v, SENSITIVITY_MIN, SENSITIVITY_MAX) : 1
}

/** 滚动灵敏度倍率（1 = 默认）。引擎每读一次 wheel 事件现读它。 */
export const scrollSensitivity = ref(load())

watch(scrollSensitivity, (v) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(v))
})
