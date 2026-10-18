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
 *       .blur-layer      ← filter 加在这里
 *         .drift-outer
 *           #viewport    ← 透视在这一层建立，不受影响
 *             .drift-inner
 *               #world   ← preserve-3d 在这里，不受影响
 *
 * 3D 场景先按正确的方式渲染完，再对**渲染结果**做模糊。这正是想要的。
 *
 * ## 模糊必须是连续的，不能是「转场时打开」
 *
 * 早先的实现把速度乘 1000（单位错了：`velocity` 已经是索引/秒），于是
 * **任何**运动都瞬间顶到 6px 上限、拖影瞬间全亮 —— 视觉上就是
 * 「静止 → 突然糊成一片 → 突然清晰」，与运动本身没有衔接。
 *
 * 现在模糊量是速度的**连续函数**：速度多小就有多小的模糊，速度归零模糊
 * 也连续归零。没有任何「转场开始 / 结束」的开关，只有速度。
 *
 * ## 为什么 CSS 的 blur() 不够
 *
 * `blur()` 是**各向同性**的（横竖一样糊），看起来像「失焦」而不是「运动」。
 * 真正的运动模糊是有方向的：沿运动轴糊得多、垂直方向几乎不糊。
 *
 * 两套方案：
 *
 * **A（预期生产）** —— `blur()` + 沿运动方向拉伸 + 方向性拖影叠加层。
 *   便宜、纯 GPU。拖影层不复制 DOM，只画一道方向性光晕。
 *
 * **B** —— SVG `feGaussianBlur` 的各向异性 `stdDeviation="sx sy"`。
 *   代价：作用在大面积 DOM 子树上极慢，**只作原型对比**。
 */

import { CAMERA } from './constants'
import type { CameraFrame } from './types'

export type BlurMode = 'off' | 'A' | 'B'

export interface BlurTargets {
  /** 承载 filter 的包装层（必须是 #viewport 的祖先） */
  layer: HTMLElement
  /** 方案 B 用的 SVG feGaussianBlur 元素 */
  feBlur: SVGFEGaussianBlurElement | null
}

/**
 * `frame.velocity` 是 d(displayIndex)/d(s)，单位**索引/秒**，峰值约 2–3。
 * 直接取绝对值即可，不要再乘 1000 —— 那是把秒当毫秒，会让模糊瞬间顶满。
 */
function speedOf(frame: CameraFrame): number {
  return Math.abs(frame.velocity)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 平滑阶跃：死区之上从 0 连续升起，避免「一到阈值就满格」的硬切。 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (x <= edge0) return 0
  if (x >= edge1) return 1
  const t = (x - edge0) / (edge1 - edge0)
  return t * t * (3 - 2 * t)
}

/**
 * 每帧写入模糊状态。
 *
 * **没有模式开关**：只要速度非零就有对应强度的模糊。`mode` 只决定用哪种
 * 实现（A / B / 关闭），不决定「模糊何时开始」。
 */
export function applyBlur(targets: BlurTargets, frame: CameraFrame, mode: BlurMode): void {
  if (mode === 'off') {
    clearBlur(targets)
    return
  }

  const speed = speedOf(frame)

  // 死区之上用 smoothstep 连续升起。smoothstep 的终点取「速度到达
  // 一次转场峰值的六成」——之后模糊随速度自然增长，不再额外加曲线。
  const ramp = smoothstep(CAMERA.BLUR_DEADZONE, CAMERA.BLUR_DEADZONE * 6, speed)

  const blurPx = clamp(speed * CAMERA.BLUR_SPEED_GAIN, 0, CAMERA.BLUR_MAX_PX) * ramp
  const stretch = clamp(speed * CAMERA.STRETCH_SPEED_GAIN, 0, CAMERA.STRETCH_MAX) * ramp

  const { layer, feBlur } = targets

  if (blurPx < 0.01 && stretch < 0.0005) {
    // 已经几乎不动了：完全清掉，别留一个「1e-3 的模糊」常驻。
    clearBlur(targets)
    return
  }

  if (mode === 'A') {
    // 各向同性模糊 + 沿运动方向的轻微拉伸
    layer.style.filter = `blur(${blurPx.toFixed(2)}px)`

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
      const k = blurPx * 0.6
      const sx = Math.max(0.01, k * Math.abs(frame.dir.x))
      const sy = Math.max(0.01, k * Math.abs(frame.dir.y))
      feBlur.setAttribute('stdDeviation', `${sx.toFixed(2)} ${sy.toFixed(2)}`)
    }
  }

  // 方向性：方案 A 靠沿运动轴的 scale，方案 B 靠两轴独立的 stdDeviation。
  // 刻意**不做**全屏拖影叠加层 —— 一整条带色光晕并不对应真实运动，
  // 而且会被启动器主题的绿色令牌染成一片半透明绿。

  // 只在真正有模糊时才提升为独立层
  layer.style.willChange = 'filter, transform'
}

/** 清除一切模糊状态，并把提升层摘掉。 */
export function clearBlur(targets: BlurTargets): void {
  const { layer, feBlur } = targets
  if (layer.style.filter) layer.style.filter = ''
  if (layer.style.transform) layer.style.transform = ''
  if (layer.style.willChange) layer.style.willChange = ''
  if (feBlur && feBlur.getAttribute('stdDeviation') !== '0 0') {
    feBlur.setAttribute('stdDeviation', '0 0')
  }
}
