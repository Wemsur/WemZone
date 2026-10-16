/**
 * 进度映射工具
 *
 * 全部是纯函数：输入 section 的总进度 p（0→1），输出某个子动画自己的
 * 局部进度。没有时间参与，所以「滚动停 → 动画停」天然成立。
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * 取 p 在区间 [start, end] 内的局部进度。
 * p < start → 0，p > end → 1。
 */
export function phase(p: number, start: number, end: number): number {
  if (end <= start) return p >= end ? 1 : 0
  return clamp01((p - start) / (end - start))
}

/** 线性插值 */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * 平滑缓入缓出（smoothstep）。
 * 用于让「渐显」的透明度曲线不显得机械，但它依然只是 p 的函数，
 * 不引入时间，因此不违反「滚多少动多少」。
 */
export function smooth(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/**
 * smooth 的反函数。
 *
 * 拖动这类「直接操作」给出的是**结果**（分割线在 43%、滑块在 210°），
 * 要把它换回滚动进度就得反解一次缓动曲线，否则手指按在 43% 处、
 * 松手后画面跳到别处 —— 拖动与滚动就不是同一个量了。
 *
 * smoothstep 是 y = x²(3-2x)，在 [0,1] 上单调，有闭式反函数：
 *   x = 1/2 - sin(asin(1 - 2y) / 3)
 */
export function unsmooth(y: number): number {
  const v = clamp01(y)
  return 0.5 - Math.sin(Math.asin(1 - 2 * v) / 3)
}

/** 先缓入再缓出的对称曲线，常用于「浮现 → 停留 → 浮走」的整体不透明度。 */
export function easeOut(t: number): number {
  const x = clamp01(t)
  return 1 - (1 - x) * (1 - x)
}

export function easeIn(t: number): number {
  const x = clamp01(t)
  return x * x
}

/**
 * 标准的「渐显 → 停留 → 渐隐」窗口。
 *
 * @param p       section 进度
 * @param inEnd   渐显结束点
 * @param outStart 渐隐开始点
 * @returns 0→1→0
 */
export function window01(p: number, inEnd = 0.16, outStart = 0.84): number {
  const rise = smooth(phase(p, 0, inEnd))
  const fall = 1 - smooth(phase(p, outStart, 1))
  return Math.min(rise, fall)
}

/**
 * 与 window01 配套的位移量（rem）。
 * 进入时从下方 +d 浮上到 0，离开时继续向上到 -d。
 * 注意：这是「元素自身的轻微浮动」，与页面滚动位移无关 —— 舞台是 sticky 的。
 */
export function floatY(p: number, inEnd = 0.16, outStart = 0.84, d = 1.6): number {
  const rise = smooth(phase(p, 0, inEnd))
  const fall = smooth(phase(p, outStart, 1))
  return mix(d, 0, rise) - mix(0, d, fall)
}

/** 把进度映射到区间 [a, b] 的取值 */
export function ramp(p: number, start: number, end: number, from: number, to: number): number {
  return mix(from, to, phase(p, start, end))
}

/** 保留 n 位小数，减少 style 字符串抖动 */
export function round(v: number, n = 4): number {
  const f = 10 ** n
  return Math.round(v * f) / f
}
