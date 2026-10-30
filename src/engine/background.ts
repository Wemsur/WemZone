/**
 * 背景配色工具
 *
 * 背景是**每个区块一套独立场景**（见 `components/background/`），
 * 所以这里只提供各场景共用的调色函数。色相插值（`hueAt`）留给
 * 需要「跟着相机连续变色」的东西（例如统一卡片的高亮色、未来的过渡元素）。
 *
 * 这里全是纯函数，可以脱离 DOM 与 WebGL 测试。
 */

/** 一个区块的背景色相（deg） */
export interface HueStop {
  hue: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 把角度归一化到 [0, 360) */
export function wrapHue(h: number): number {
  const m = h % 360
  return m < 0 ? m + 360 : m
}

/** 沿最短弧从 a 插值到 b（t ∈ [0,1]） */
export function mixHue(a: number, b: number, t: number): number {
  let d = wrapHue(b) - wrapHue(a)
  if (d > 180) d -= 360
  else if (d < -180) d += 360
  return wrapHue(a + d * t)
}

/**
 * 连续索引 → 当前色相。
 *
 * `index = 2.4` 表示「第 2 → 3 段的 40%」。索引越界时 clamp 到端点，
 * 所以转场过冲（例如 1.008）不会去插值不存在的第 6 区。
 */
export function hueAt(index: number, hues: readonly number[]): number {
  if (hues.length === 0) return 0
  if (hues.length === 1) return wrapHue(hues[0])

  const last = hues.length - 1
  const s = clamp(index, 0, last)
  const i = Math.min(Math.floor(s), last - 1)
  const t = s - i
  return mixHue(hues[i], hues[i + 1], t)
}

/** hsl 字符串。背景一律低饱和 —— 它是氛围，不是主角。 */
export function hsl(hue: number, sat: number, light: number, alpha?: number): string {
  const h = wrapHue(hue).toFixed(1)
  return alpha === undefined
    ? `hsl(${h} ${sat}% ${light}%)`
    : `hsl(${h} ${sat}% ${light}% / ${alpha})`
}

/**
 * MeshGradient 的六格调色。
 *
 * 深灰占多数格位（3 格），所以色团大部分时间是暗的；主题色 2 格像光斑
 * 一样游进来；近白只占 1 格，在某些位置擦一下边作为高光。
 * 与参考站 Celestial-Web 的 FluidBackground 同一套分配。
 */
export function meshColors(hue: number): string[] {
  return [
    hsl(hue, 56, 62), // 品牌色本体
    hsl(hue, 31, 26), // 同色相压暗，做品牌色到深灰的过渡
    '#1a1a1a', // 页面底色
    '#202020',
    '#111111', // 比底色更暗，留出真正的暗区
    hsl(hue, 26, 93), // 唯一的高光格
  ]
}

/** 抖动点阵：深灰打底、主题色作笔，于是点阵是「主题色的颗粒」。 */
export function ditherColors(hue: number): { back: string; front: string } {
  return { back: '#1a1a1a', front: hsl(hue, 56, 62) }
}
