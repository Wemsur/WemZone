/**
 * 运动模糊
 *
 * ## 一个必须先讲清楚的约束
 *
 * `filter` 是 CSS 的**分组属性**（grouping property）。带分组属性的元素，
 * 其自身的 `transform-style` 会被计算成 `flat` —— 也就是说，如果直接给
 * `#world` 加 `filter`，它就不再是 `preserve-3d`，**整个 3D 场景会当场拍平**，
 * 所有 section 的 3D 定位全部失效。
 *
 * 同理，加在 `#viewport` 上也会毁掉它给子元素建立的透视。
 *
 * 所以模糊层必须是**透视容器的祖先**，而不是它的内部：
 *
 *     #stage
 *       .idle-drift-x
 *         .idle-drift-y
 *           .blur-layer      ← filter 加在这里
 *             #viewport      ← 透视在这一层建立，不受影响
 *               #world       ← preserve-3d 在这里，不受影响
 *
 * 3D 场景先按正确的方式渲染完，再对**渲染结果**做模糊。这正是想要的。
 *
 * ## 为什么 CSS 的 blur() 不够
 *
 * `blur()` 是**各向同性**的（横竖一样糊），看起来像「失焦」而不是「运动」。
 * 真正的运动模糊是有方向的：沿运动轴糊得多、垂直方向几乎不糊。
 *
 * 两套方案：
 *
 * **A（预期生产）** —— `blur()` + 沿运动方向拉伸 + 方向性拖影叠加层。
 *   便宜、纯 GPU。拖影层不复制 DOM，只画一道方向性光晕，
 *   把「糊」读成「拖」。
 *
 * **B** —— SVG `feGaussianBlur` 的各向异性 `stdDeviation="sx sy"`，
 *   两轴独立，是**真正的**方向性模糊。
 *   代价：作用在大面积 DOM 子树上极慢 —— 每帧改 `stdDeviation` 会触发
 *   整个 filter region 的软件重光栅化。**只作原型对比，预期不会作生产方案。**
 */

import { CAMERA } from './constants'
import type { CameraFrame } from './types'

export type BlurMode = 'off' | 'A' | 'B'

export interface BlurTargets {
  /** 承载 filter 的包装层（必须是 #viewport 的祖先） */
  layer: HTMLElement
  /** 方向性拖影叠加层 */
  streak: HTMLElement
  /** 方案 B 用的 SVG feGaussianBlur 元素 */
  feBlur: SVGFEGaussianBlurElement | null
}

/**
 * 把「索引变化率」换算成便于调参的速度量。
 *
 * `frame.velocity` 是 d(displayIndex)/d(ms)，一次转场约 0.002–0.004。
 * 乘 1000 后是「每秒走多少个区块」，峰值约 2–4 —— 这个量级好调。
 */
function speedOf(frame: CameraFrame): number {
  return Math.abs(frame.velocity) * 1000
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * 每帧写入模糊状态。
 *
 * 只在 `TRANSIT` 期间有可见效果 —— 静止时 speed 为 0，所有量归零，
 * 并且会把 `will-change` 摘掉（避免常驻的提升层白占显存）。
 */
export function applyBlur(targets: BlurTargets, frame: CameraFrame, mode: BlurMode): void {
  const speed = speedOf(frame)

  if (mode === 'off' || speed < 0.05) {
    clearBlur(targets)
    return
  }

  const blurPx = clamp(speed * CAMERA.BLUR_SPEED_GAIN, 0, CAMERA.BLUR_MAX_PX)
  const stretch = clamp(speed * CAMERA.STRETCH_SPEED_GAIN, 0, CAMERA.STRETCH_MAX)
  const streakOpacity = clamp(speed * 0.06, 0, CAMERA.STREAK_MAX_OPACITY)

  const { layer, streak, feBlur } = targets

  if (mode === 'A') {
    // 各向同性模糊 + 沿运动方向的轻微拉伸
    layer.style.filter = blurPx > 0.01 ? `blur(${blurPx.toFixed(2)}px)` : ''

    // 相机的运动主要是垂直的（沿平面向下），所以拉伸以纵向为主，
    // 横向按运动方向的 x 分量加权。
    const sx = 1 + stretch * Math.abs(frame.dir.x)
    const sy = 1 + stretch * Math.abs(frame.dir.y)
    layer.style.transform = `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`

    if (feBlur) feBlur.setAttribute('stdDeviation', '0 0')
  } else {
    // 方案 B：SVG 各向异性模糊。两轴独立，沿运动轴糊得多。
    layer.style.filter = 'url(#wemzone-motion-blur)'
    layer.style.transform = ''

    if (feBlur) {
      // stdDeviation 的两轴对应元素局部坐标。运动方向 (dir.x, dir.y)
      // 决定两轴的分配；再乘一个系数把「像素」调到与方案 A 相近的观感。
      const k = blurPx * 0.6
      const sx = Math.max(0.01, k * Math.abs(frame.dir.x))
      const sy = Math.max(0.01, k * Math.abs(frame.dir.y))
      feBlur.setAttribute('stdDeviation', `${sx.toFixed(2)} ${sy.toFixed(2)}`)
    }
  }

  // 方向性拖影：一道沿运动方向的光晕，把「糊」读成「拖」。
  // 角度换算：CSS 渐变角 0deg 指向正上方、90deg 指向正右方，
  // 屏幕坐标 y 向下，所以是 atan2(dx, -dy)。
  const angle = (Math.atan2(frame.dir.x, -frame.dir.y) * 180) / Math.PI
  streak.style.opacity = String(streakOpacity.toFixed(3))
  streak.style.setProperty('--streak-angle', `${angle.toFixed(1)}deg`)

  // 只在真正有模糊时才提升为独立层
  layer.style.willChange = 'filter, transform'
}

/** 清除一切模糊状态，并把提升层摘掉。 */
export function clearBlur(targets: BlurTargets): void {
  const { layer, streak, feBlur } = targets
  if (layer.style.filter) layer.style.filter = ''
  if (layer.style.transform) layer.style.transform = ''
  if (layer.style.willChange) layer.style.willChange = ''
  if (streak.style.opacity !== '0') streak.style.opacity = '0'
  if (feBlur && feBlur.getAttribute('stdDeviation') !== '0 0') {
    feBlur.setAttribute('stdDeviation', '0 0')
  }
}
