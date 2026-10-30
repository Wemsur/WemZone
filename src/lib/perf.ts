/**
 * 性能档
 *
 * 背景是**常驻** WebGL（用户要求静止时也持续流动），所以它和相机引擎的
 * 「静止零开销」是冲突的 —— 这是刻意的取舍。代价必须可控，所以按设备
 * 能力给三档，并允许调参面板手动覆盖。
 *
 * 判据只看启动时就能拿到的东西（核数 / DPR / 减少动效），不做运行时
 * 帧率探测：那需要先掉帧才能降级，而背景降级本身几乎看不出来，
 * 不值得为它引入一个自我振荡的反馈环。
 */

import { ref } from 'vue'

export type PerfTier = 0 | 1 | 2

/** 减少动效时背景退化成静态渐变（不跑 WebGL）。 */
export interface PerfProfile {
  tier: PerfTier
  /** 着色器渲染的像素上限（宽 × 高） */
  maxPixels: number
  /** 流体与点阵的时间流速倍率 */
  speed: number
  /** 是否启用抖动点阵层 */
  dither: boolean
  /** 是否完全跳过 WebGL，用 CSS 渐变兜底 */
  cssOnly: boolean
}

const PROFILES: Record<PerfTier, Omit<PerfProfile, 'cssOnly'>> = {
  0: { tier: 0, maxPixels: 1280 * 720, speed: 1, dither: true },
  1: { tier: 1, maxPixels: 960 * 540, speed: 0.8, dither: true },
  2: { tier: 2, maxPixels: 640 * 360, speed: 0.6, dither: false },
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function detectTier(): PerfTier {
  if (typeof navigator === 'undefined') return 1
  const cores = navigator.hardwareConcurrency ?? 4
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (cores <= 4) return 2
  if (cores <= 8 || dpr >= 3) return 1
  return 0
}

/**
 * 手动覆盖档位。响应式，所以调参面板改它之后背景会重建着色器。
 * `null` = 自动检测。
 */
export const tierOverride = ref<PerfTier | null>(null)

export function getPerfProfile(): PerfProfile {
  const reduced = prefersReducedMotion()
  const tier = tierOverride.value ?? detectTier()
  const base = PROFILES[tier]
  return { ...base, cssOnly: reduced }
}

/** 自动检测出来的档位（面板显示用）。 */
export function detectedTier(): PerfTier {
  return detectTier()
}
