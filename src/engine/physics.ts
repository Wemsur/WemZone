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
 * 这没有削弱手感：轨迹的「先慢后快再慢」全部来自这个方程本身
 * （实测 k=45 / c=12 时，0% 处 v≈0.75、15% 处峰值 v≈2.17、30% 后减速），
 * 而不是来自某条预先写死的缓动曲线。
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
  /** 势能强度 k。近井底角频率 ω = √k */
  k: number
  /** 阻尼系数 c。阻尼比 ζ = c / (2√k) */
  damping: number
  /** 速度上限（索引/秒），防止极端输入把相机甩出去 */
  maxSpeed: number
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
  // 锚定力：与势能同量纲（k × 位移），所以 k 同时控制「井的硬度」与「走过去的快慢」
  const anchorForce = p.k * (anchor - state.s)

  const a =
    potentialForce(state.s, p.k) - p.damping * state.v + anchorForce + inputForce

  // 先更新速度
  let v = state.v + a * dtSec
  if (v > p.maxSpeed) v = p.maxSpeed
  else if (v < -p.maxSpeed) v = -p.maxSpeed

  // 再用新速度更新位置
  const s = state.s + v * dtSec
  return { s, v }
}

/** 是否已经静止在目标井。 */
export function atRest(
  s: number,
  v: number,
  anchor: number,
  epsS = 2e-3,
  epsV = 2e-2,
): boolean {
  return Math.abs(v) < epsV && Math.abs(s - anchor) < epsS
}

/**
 * 把一帧的 dt 切成不超过 maxStep 的子步。
 *
 * 标签页切回来时 dt 可能是 100ms，一帧直接跨过好几个井；子步把积分
 * 拉回稳定区间。
 */
export function substepCount(dtSec: number, maxStep = 1 / 60): number {
  return Math.max(1, Math.ceil(dtSec / maxStep))
}
