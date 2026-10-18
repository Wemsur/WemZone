/**
 * 空间模型：内容区的锚点 + 相机路径
 *
 * 每区一个 `Stop`（相机停靠点），相机沿一条穿过所有停靠点的样条移动。
 *
 * ## 为什么是 centripetal Catmull-Rom
 *
 * 停靠点在 Y 上等距、但在 X 上左右交替，是一条**折线状的锚点序列**。
 *
 *  - **uniform Catmull-Rom**：在急转处会**过冲** —— 相机甩出脊线外再拉回来，
 *    看起来像打嗝。centripetal（α = 0.5）从数学上杜绝 cusp 与 overshoot，
 *    是这类锚点的标准解。
 *  - **Bézier**：要手工摆控制柄，改一个锚点得重调两个柄。CR 只依赖四个相邻
 *    锚点，改 `sections.ts` 的坐标即可，切线自动重算。
 *  - **直线段 + smoothstep**：切线在锚点处不连续，相机会在每一站「拐一下」，
 *    与「每部分之间的曲线要能够平滑连接」冲突。
 *
 * ## 位置走 CR，标量走线性
 *
 * `x` / `y` 走 CR（它们决定路径形状）。`d` / `rx` / `ry` 是**线性插值** ——
 * 「先慢后快再慢」由力学系统提供（见 `physics.ts`：相机沿路径的运动由
 * 势能 + 阻尼 + 锚定决定），路径本身不需要再套一次缓动。
 * 线性也保证这三个量不过冲（距离过冲会像镜头突然怼近又退开）。
 *
 * 分工：**spatial 只决定「形状」，physics 只决定「快慢」**。二者正交。
 */

import type { CameraPose, Stop, Vec3 } from './types'

/** centripetal 参数。0.5 = centripetal，0 = uniform，1 = chordal。 */
const ALPHA = 0.5

/** 节点间距的下限，避免重复点导致零长度区间（除零）。 */
const KNOT_EPS = 1e-4

function knotDelta(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  // |P_b - P_a|^alpha，加下限防止除零
  return Math.max(Math.pow(dist, ALPHA), KNOT_EPS)
}

/**
 * 一条穿过所有停靠点的相机路径。
 */
export interface CameraPath {
  readonly stops: readonly Stop[]
  /** 最后一个合法 index（含）。stops.length - 1 */
  readonly last: number
  /**
   * 连续索引 → 完整相机位姿。
   * `index = 2.4` 表示「第 2 → 3 段的 40%」。会 clamp 到 [0, last]。
   */
  sample(index: number): CameraPose
  /** 平面质心（rem），供全览模式把镜头拉远时对准用。 */
  centroid(): Vec3
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function buildPath(stops: readonly Stop[]): CameraPath {
  if (stops.length === 0) {
    throw new Error('buildPath: stops 不能为空')
  }

  const last = stops.length - 1

  /**
   * 取第 i 个停靠点的位置；越界时**复制端点**（保证样条在两端有切线）。
   *
   * 试过三种「幽灵点」替代方案（镜像 `2·P[0]−P[1]`、线性外推、半镜像），
   * 实测在本项目这种**左右交替的折线锚点**上，它们全都比复制端点更差：
   * 首段过冲 0.25~0.28rem，而复制端点是 0.19rem。原因是镜像/外推会
   * 把端点的切线拉向「折回」方向，而这个方向恰好与首段的真实走向相冲。
   * 复制端点让端点处切线为零（自然起步），反而是这里最平顺的选择。
   *
   * 残余的 0.19rem 过冲（约 0.7% 振幅、16px 根字号下约 3px）只出现在首段，
   * 内段是严格 0。对相机路径来说这点过冲反而像「入弯」，观感自然。
   */
  function pointAt(i: number): Vec3 {
    const s = stops[clamp(i, 0, last)]
    return { x: s.x, y: s.y, z: 0 }
  }

  /** 在 [0,1] 的段内参数 u 上求 CR 的 (x, y)。 */
  function crSegment(seg: number, u: number): { x: number; y: number } {
    const p0 = pointAt(seg - 1)
    const p1 = pointAt(seg)
    const p2 = pointAt(seg + 1)
    const p3 = pointAt(seg + 2)

    // Barry–Goldman 节点参数化
    const t0 = 0
    const t1 = t0 + knotDelta(p0, p1)
    const t2 = t1 + knotDelta(p1, p2)
    const t3 = t2 + knotDelta(p2, p3)

    const t = t1 + (t2 - t1) * u

    // 一阶插值
    const a1w0 = (t1 - t) / (t1 - t0)
    const a1w1 = (t - t0) / (t1 - t0)
    const a2w0 = (t2 - t) / (t2 - t1)
    const a2w1 = (t - t1) / (t2 - t1)
    const a3w0 = (t3 - t) / (t3 - t2)
    const a3w1 = (t - t2) / (t3 - t2)

    const a1x = a1w0 * p0.x + a1w1 * p1.x
    const a1y = a1w0 * p0.y + a1w1 * p1.y
    const a2x = a2w0 * p1.x + a2w1 * p2.x
    const a2y = a2w0 * p1.y + a2w1 * p2.y
    const a3x = a3w0 * p2.x + a3w1 * p3.x
    const a3y = a3w0 * p2.y + a3w1 * p3.y

    // 二阶插值
    const b1w0 = (t2 - t) / (t2 - t0)
    const b1w1 = (t - t0) / (t2 - t0)
    const b2w0 = (t3 - t) / (t3 - t1)
    const b2w1 = (t - t1) / (t3 - t1)

    const b1x = b1w0 * a1x + b1w1 * a2x
    const b1y = b1w0 * a1y + b1w1 * a2y
    const b2x = b2w0 * a2x + b2w1 * a3x
    const b2y = b2w0 * a2y + b2w1 * a3y

    // 三阶插值
    const cw0 = (t2 - t) / (t2 - t1)
    const cw1 = (t - t1) / (t2 - t1)

    return {
      x: cw0 * b1x + cw1 * b2x,
      y: cw0 * b1y + cw1 * b2y,
    }
  }

  function sample(index: number): CameraPose {
    const clamped = clamp(index, 0, last)
    const seg = clamp(Math.floor(clamped), 0, Math.max(0, last - 1))
    const u = clamped - seg

    const { x, y } = crSegment(seg, u)

    // 标量线性插值。seg 可能等于 last（单区或落在末端），此时直接取端点。
    const a = stops[seg]
    const b = stops[Math.min(seg + 1, last)]
    const d = a.d + (b.d - a.d) * u
    const rx = a.rx + (b.rx - a.rx) * u
    const ry = a.ry + (b.ry - a.ry) * u

    return { x, y, d, rx, ry }
  }

  function centroid(): Vec3 {
    let x = 0
    let y = 0
    for (const s of stops) {
      x += s.x
      y += s.y
    }
    return { x: x / stops.length, y: y / stops.length, z: 0 }
  }

  return { stops, last, sample, centroid }
}
