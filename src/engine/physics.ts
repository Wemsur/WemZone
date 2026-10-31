/**
 * 连续力学系统
 *
 * 相机不是一个被「状态机 + 补间」推着走的物体，而是**一个受力运动的质点**。
 * 整站只有一个方程，果冻回弹、切换、落位都是它的不同能量状态：
 *
 *     a = F_势能 + F_阻尼 + F_锚定 + F_输入
 *
 * 位置 `s` 是连续索引（`s = 2.4` 表示第 2→3 段的 40%），速度 `v` 的单位是
 * 「索引/秒」。**没有 IDLE / PULL / TRANSIT / SETTLE 之分。**
 *
 * ## 三个力
 *
 * **势能** —— 每个区块中心是一个吸引中心：
 *
 *     U(s) = (k / (2π)²) · (1 − cos 2πs)
 *     F(s) = −dU/ds = −(k / 2π) · sin(2πs)
 *
 * 极小值在整数 `s`（区块中心），极大值在半整数（区块之间）。
 * 为什么用周期余弦而不是真的对每个中心求 `1/r²` 引力：`1/r²` 在中心处发散，
 * 数值上会把相机吸成一个点；有限个中心的引力不周期，边缘区块的平衡点会偏移。
 * 余弦势是「一整个晶格的中心」的平滑极限，形状一致、处处可导、无奇点。
 *
 * **阻尼** —— 耗散能量，让相机最终停下。没有它相机会永远振荡。
 *
 * **锚定** —— 把相机拉向「意图目标井」。这一项让物理的**轨迹**是连续的，
 * 但**目的地**是可控的（否则滚轮的离散能量会让落点不可预测）。
 * 见下面「为什么需要锚定」。
 *
 * ## 为什么需要锚定（而不是让物理自己决定去哪）
 *
 * 纯物理阈值很诱人：滚得够猛就越过势垒。但实测不行 ——
 *
 *  - 真实滚轮是一串**离散冲量**，间隔约 50ms，阻尼在这段时间里已经耗散掉
 *    大半能量。实测 k=30 时要连续 8 格、dv=0.5 才能勉强过去，而 k=20 时
 *    单次冲量要 dv=4.0 —— 输入量与「一格」的对应关系完全失控。
 *  - 用户要求「一次滚动只走一格」。这个约束靠能量阈值**涌现**出来是不可控的：
 *    同样滚一格，快滚和慢滚给的能量差几倍。
 *
 * 所以分成两层：**意图层**决定目标井（一格 = ±1，由 `input.ts` 的手势分类
 * 保证一次手势只提交一格），**力学层**负责怎么走过去。物理仍然是连续的、
 * 没有状态机 —— 只是多了一个「目的地」。
 *
 * 这没有削弱手感：轨迹的「先慢后快再慢」与末尾的过冲回弹全部来自这个
 * 方程本身（实测 k=450 / c=42 时，速度在约 200ms 达到峰值、350ms 过冲
 * 约 1%、450ms 回到目标），而不是来自某条预先写死的缓动曲线。
 *
 * ## 为什么用半隐式欧拉
 *
 * 显式欧拉在弹簧系统上会随 dt 增大而发散。半隐式（先更新速度、再用新速度
 * 更新位置）对谐振子是无条件稳定的（辛积分器），实现只有两行。
 * 另外对 dt 做了子步切分，避免标签页切回来时一帧跨过好几个井。
 */

export interface PhysicsState {
  /** 连续索引 */
  s: number
  /** 索引/秒 */
  v: number
}

export interface PhysicsParams {
  /** 势能强度 k。近井底有效角频率 ω = √(2k)（势能 + 锚定两力叠加） */
  k: number
  /** 阻尼系数 c。有效阻尼比 ζeff = c / (2√(2k)) */
  damping: number
  /** 速度上限（索引/秒），防止极端输入把相机甩出去 */
  maxSpeed: number
  /**
   * 锚定力的饱和距离（索引）。见 `advance()` 里「为什么锚定力要饱和」。
   * 不传则退化成线性锚定（旧行为）。
   */
  anchorSaturation?: number
  /**
   * 合法区间。越界后不再使用周期势能与井锚定，改用一个**更软但更强阻尼**
   * 的边界弹簧 —— 用户要求「到头尾还能滑一点，但单独加大最上/最下的阻尼」。
   */
  bounds?: { min: number; max: number }
  /** 边界弹簧刚度（索引/秒² per 索引）。比内部小，允许滑得更远。 */
  edgeStiffness?: number
  /** 边界阻尼（比内部大：滑出去能很快回来，不来回荡）。 */
  edgeDamping?: number
}

/** 势能对 s 的负导数，也就是相机受到的「引力」。 */
export function potentialForce(s: number, k: number): number {
  return -(k / (2 * Math.PI)) * Math.sin(2 * Math.PI * s)
}

/** 势能值。只用于测试与调参，运行时不需要。 */
export function potentialEnergy(s: number, k: number): number {
  return (k / (2 * Math.PI) ** 2) * (1 - Math.cos(2 * Math.PI * s))
}

/** 势垒高度（从井底到半整数处）。
 *  U(0.5) = (k/(2π)²)·(1 − cos π) = (k/(2π)²)·2 = k/(2π²) */
export function barrierHeight(k: number): number {
  return k / (2 * Math.PI * Math.PI)
}

/**
 * 推进 dt 秒。半隐式欧拉。
 *
 * @param anchor   意图目标井（整数索引）。锚定力把它拉向这里。
 * @param inputForce 本帧的输入力（索引/秒²），方向带符号
 */
export function advance(
  state: PhysicsState,
  anchor: number,
  inputForce: number,
  dtSec: number,
  p: PhysicsParams,
): PhysicsState {
  // ---- 锚定力：为什么它要饱和 ----
  //
  // 线性锚定 `k·(anchor − s)` 在 k 大时会**起步即巅峰**：k=350 时 33ms
  // 就冲到 7.5 索引/秒，完全没有用户要求的「慢-快-慢」开头。
  //
  // 改成 `k·sat·tanh(d/sat)`：
  //  - 近处（|d| ≪ sat）→ tanh(x) ≈ x，力仍是 k·d，**刚度不变**，
  //    所以落位与果冻的手感不受影响；
  //  - 远处（|d| ≫ sat）→ 力封顶在 k·sat，起步不会被猛推。
  //
  // 附带的好处是它更像真实的引力：距离越远力越大，但有上限。
  // 判断是否越界。越界时势能与井锚定都**失效** —— 周期势在区间外会试图
  // 把相机拉向一个不存在的「上一页/下一页」，那显然不对。
  const b = p.bounds
  const edge = b ? (state.s < b.min ? b.min : state.s > b.max ? b.max : null) : null

  let potential = 0
  let restoring = 0
  let damp = p.damping

  if (edge === null) {
    const d = anchor - state.s
    const sat = p.anchorSaturation
    potential = potentialForce(state.s, p.k)
    restoring = sat && sat > 0 ? p.k * sat * Math.tanh(d / sat) : p.k * d
  } else {
    // 边界外：只有一个更软、阻尼更大的弹簧把人拉回去。
    // 软 → 允许滑出去一段；阻尼大 → 松手后干脆地回来，不晃。
    restoring = (p.edgeStiffness ?? p.k) * (edge - state.s)
    damp = p.edgeDamping ?? p.damping
  }

  const a = potential - damp * state.v + restoring + inputForce

  // 先更新速度
  let v = state.v + a * dtSec
  if (v > p.maxSpeed) v = p.maxSpeed
  else if (v < -p.maxSpeed) v = -p.maxSpeed

  // 再用新速度更新位置
  const s = state.s + v * dtSec
  return { s, v }
}

/**
 * 是否已经静止到「可以安全吸附」的程度。
 *
 * ## 阈值必须按**像素**定，不能按索引拍脑袋
 *
 * 落位时引擎会把 `s` 直接吸附到整数索引。吸附量就是最后那一帧的视觉跳变，
 * 所以阈值直接决定「会不会看到一下瞬移」。
 *
 * 换算关系（16px 根字号、透视 120rem、距离 34rem）：
 *
 *     屏幕放大 = P/(P−z) = 120/34 ≈ 3.53
 *     1 索引   = 72rem = 1152px 世界坐标
 *     1px 屏幕 ≈ 1 / (3.53 × 1152) ≈ 2.46e-4 索引
 *
 * 早先 `epsS = 2e-3`，吸附时最大跳 0.002 索引 ≈ **0.8px**，
 * 用户会看到「最后一下突然吸过去」。现在取 1.5e-5（≈0.06px），肉眼不可见。
 *
 * **速度阈值也要一起收紧**：吸附跳变的上限其实是 `epsS + v·dt` ——
 * 最后一个未吸附的帧可能只是「差一点点没过检查」，下一帧就跳过去了。
 * 所以只压 `epsS` 不够，`epsV` 也压到 5e-4，实测最坏跳变约 0.067px。
 *
 * 代价是收敛尾巴多走一点，所以同时把 k/c 调快
 * （k=450 / c=42，ζeff≈0.70）：落位总时长约 0.61s，
 * 轨迹是「起步慢 → 中段快 → 过冲一点 → 迅速拉回」。
 */
export const REST_EPS_S = 1.5e-5
export const REST_EPS_V = 5e-4

/** 是否已经静止在目标井。 */
export function atRest(
  s: number,
  v: number,
  anchor: number,
  epsS = REST_EPS_S,
  epsV = REST_EPS_V,
): boolean {
  return Math.abs(v) < epsV && Math.abs(s - anchor) < epsS
}

/**
 * 固定步长：相机每帧按这个步长推进模拟时间（见 camera.ts 的 FIXED_STEP）。
 *
 * **为什么不再用「按 dt 切子步」**：半隐式欧拉的数值阻尼随步长变化。
 * 实测同一条切换，dt=16.7ms 的过冲 1.03%、dt=1ms 的过冲 2.67% ——
 * 手感会随刷新率变，慢放时看到的轨迹也和正常速度不一致。
 * 固定步长让 60Hz / 144Hz / 慢放得到同一条轨迹。
 */
export const FIXED_STEP = 1 / 240
