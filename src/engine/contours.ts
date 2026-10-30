/**
 * 等高线生成（marching squares）
 *
 * 「其它作品」区的背景是一条条**静态、等距、细硬边缘**的等高线。
 * 直接手写几条正弦曲线做不出等高线的味道 —— 等高线是标量场的等值线，
 * 它们会自己互相靠近、分开、闭合，那是「地形」而不是「条纹」。
 *
 * 这里用一个由若干高斯山包叠加出来的高度场，按等距的水平值抽线。
 *
 * ## 为什么是 marching squares
 *
 * 网格上每个格点的值都算出来之后，逐格看四个角相对当前水平值的正负，
 * 16 种组合（实际 14 种非平凡）对应固定的线段拓扑。交点用线性插值
 * 定在格边上，于是线条足够平滑，代码只有几十行、没有依赖。
 *
 * 整个场只在尺寸变化时重算一次 —— 这是**静态**背景，不是动画。
 */

export interface ContourOptions {
  /** 视口宽高（CSS px） */
  width: number
  height: number
  /** 网格分辨率（格数）。越大线越平滑、越慢 */
  cols?: number
  rows?: number
  /** 等高线条数 */
  levels?: number
  /** 随机种子，保证同一尺寸下每次结果一致 */
  seed?: number
}

interface Bump {
  cx: number
  cy: number
  /** 半宽 / 半高（按视口比例） */
  sx: number
  sy: number
  amp: number
}

/** 确定性伪随机：同一 seed 得到同一组山包，避免每次刷新都变形 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 生成若干形状各异、大小不一的山包。
 *
 * 角度**均匀分布**（每包间隔 2π/n，再加一点随机抖动），而不是纯随机：
 * 纯随机很容易五六个包挤在同一侧，等高线就只出现在半张画面上。
 * 半径随机，所以不是规整的圆环，仍像自然地形。
 */
function makeBumps(count: number, seed: number): Bump[] {
  const rnd = mulberry32(seed)
  const out: Bump[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.55
    const r = 0.46 + rnd() * 0.32
    out.push({
      cx: Math.min(0.94, Math.max(0.06, 0.5 + Math.cos(a) * r * 0.9)),
      cy: Math.min(0.92, Math.max(0.08, 0.5 + Math.sin(a) * r * 0.78)),
      sx: 0.16 + rnd() * 0.24,
      sy: 0.13 + rnd() * 0.22,
      amp: 0.55 + rnd() * 0.75,
    })
  }
  return out
}

/** 高度场：高斯山包叠加，再压一个边缘衰减，让四周平缓 */
function fieldAt(nx: number, ny: number, bumps: Bump[]): number {
  let v = 0
  for (const b of bumps) {
    const dx = (nx - b.cx) / b.sx
    const dy = (ny - b.cy) / b.sy
    v += b.amp * Math.exp(-(dx * dx + dy * dy) * 1.6)
  }
  // 边缘衰减：越靠近视口边缘值越低，等高线在边缘外自然消失
  const e = Math.min(nx, 1 - nx, ny, 1 - ny)
  return v * Math.min(1, e * 6)
}

/** 一条线段（已换算成视口坐标） */
export interface ContourSegment {
  level: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * 抽取等高线线段。
 *
 * 返回的是**线段集合**而不是连续的 polyline：marching squares 天然按格
 * 产出线段，拼路径的收益很小（相邻线段端点完全重合），
 * 用 `stroke-linecap: round` 就足够连续。
 */
export function buildContours(opts: ContourOptions): ContourSegment[] {
  const {
    width,
    height,
    cols = 132,
    rows = Math.max(40, Math.round((132 * height) / Math.max(1, width))),
    levels = 15,
    seed = 7,
  } = opts

  if (width <= 0 || height <= 0) return []

  const bumps = makeBumps(6, seed)

  // 1. 采样高度场
  const gw = cols + 1
  const gh = rows + 1
  const vals = new Float32Array(gw * gh)
  let min = Infinity
  let max = -Infinity
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const v = fieldAt(gx / cols, gy / rows, bumps)
      vals[gy * gw + gx] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (!(max > min)) return []

  // 2. 等距水平值。跳过最外圈（那一条几乎贴边，看起来像边框）
  const segments: ContourSegment[] = []
  const cellW = width / cols
  const cellH = height / rows

  for (let li = 1; li <= levels; li++) {
    const level = min + ((max - min) * li) / (levels + 1)

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const i0 = gy * gw + gx
        const v0 = vals[i0] - level
        const v1 = vals[i0 + 1] - level
        const v2 = vals[i0 + gw + 1] - level
        const v3 = vals[i0 + gw] - level

        // 四角全在同侧：没有交点
        const mask =
          (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0)
        if (mask === 0 || mask === 15) continue

        const x0 = gx * cellW
        const y0 = gy * cellH
        const x1 = x0 + cellW
        const y1 = y0 + cellH

        // 四条边上的插值点
        const top = { x: x0 + cellW * (v0 / (v0 - v1 || 1e-9)), y: y0 }
        const right = { x: x1, y: y0 + cellH * (v1 / (v1 - v2 || 1e-9)) }
        const bottom = { x: x0 + cellW * (v3 / (v3 - v2 || 1e-9)), y: y1 }
        const left = { x: x0, y: y0 + cellH * (v0 / (v0 - v3 || 1e-9)) }

        const push = (a: { x: number; y: number }, b: { x: number; y: number }): void => {
          segments.push({ level: li, x1: a.x, y1: a.y, x2: b.x, y2: b.y })
        }

        switch (mask) {
          case 1:
          case 14:
            push(left, top)
            break
          case 2:
          case 13:
            push(top, right)
            break
          case 3:
          case 12:
            push(left, right)
            break
          case 4:
          case 11:
            push(right, bottom)
            break
          case 6:
          case 9:
            push(top, bottom)
            break
          case 7:
          case 8:
            push(left, bottom)
            break
          case 5:
            push(left, top)
            push(right, bottom)
            break
          case 10:
            push(top, right)
            push(left, bottom)
            break
          default:
            break
        }
      }
    }
  }

  return segments
}

/** 把同一层的线段拼成一条 SVG path 的 `d`，减少 DOM 节点数。 */
export function segmentsToPaths(segments: ContourSegment[]): { level: number; d: string }[] {
  const byLevel = new Map<number, string[]>()
  for (const s of segments) {
    let arr = byLevel.get(s.level)
    if (!arr) {
      arr = []
      byLevel.set(s.level, arr)
    }
    arr.push(`M${s.x1.toFixed(1)},${s.y1.toFixed(1)}L${s.x2.toFixed(1)},${s.y2.toFixed(1)}`)
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, parts]) => ({ level, d: parts.join('') }))
}
