/**
 * 区块背景的竖直渐隐 —— 按**实际几何**算，而不是写死百分比
 *
 * ## 目标
 *
 * 1. **静止时视野内永远满不透明**。渐隐带不能出现在屏幕里，否则用户看到的是
 *    「背景在视野边缘就开始发灰」，而不是一整个背景。
 * 2. **相邻两块背景在中点附近交汇**。上一块淡出、下一块淡入，过渡时两块
 *    背景真正「交融」，而不是各自淡到黑。
 * 3. **任何窗口比例下都不能变成一条横条**。视野比区块间距还高时（非 16:9
 *    的窗口很容易如此），中点已经落在屏幕内 —— 此时若还坚持「渐隐带必须
 *    在中点、且不伸进视野」，带子会被压成 1px，背景就只剩中间一条。
 *
 * ## 做法：内侧边界取「可见边缘」与「中点」中更远的那个
 *
 * 设 `visibleHalf` 为可见半高、`mid` 为两区中点距本区中心的距离：
 *
 *  - `inner`（仍完全不透明处）= `max(visibleHalf + 0.6, mid − 0.8)`：
 *    永远盖满一屏；中点更远时贴着中点。
 *  - `outer`（完全透明处）= `max(inner + 1.6, mid + 1.6)`：
 *    带子至少 1.6rem 宽，并越过中点。
 *
 * 下一区背景是按 DOM 顺序画在上面的，且它自己的 `inner` 同样保证盖满一屏 ——
 * 所以本区在中点之后的淡出**被下一区盖住**，看不见；真正可见的交汇发生在
 * 下一区的淡入段（从它的顶边到它的 `inner`）压在本区不透明的底上。
 *
 * 反过来，若视野特别高（`mid < visibleHalf`），`inner` 会大于 `mid`：
 * 本区的淡出整体落在屏幕外、并被下一区覆盖，屏幕上看到的仍是完整背景。
 *
 * 一句话：**可见的那一半永远是实心的，淡出是给下一区垫背的**。
 */

export interface BgMaskOptions {
  /** 区块在世界里的高度（rem），即一屏 × 出血系数 */
  sectionH: number
  /** 背景高度相对区块的倍率。**必须与 main.css 里 .section-bg 的 height 一致。** */
  bgFactor: number
  /** 相邻区块的世界间距（rem） */
  spacing: number
  /**
   * 区块相对「一屏」的出血系数。
   * 宽版是 1.04（见 World.vue 的 sectionSize）；窄版区块正好一屏，取 1。
   */
  bleed?: number
}

/** 渐隐带相对「可见边缘」再往外让出的距离（rem） */
const OUTSIDE = 0.6
/** 淡出带的最小宽度（rem）——再窄就和硬边没区别了 */
const MIN_BAND = 1.6

export function sectionBgMask(opts: BgMaskOptions): string {
  const { sectionH, bgFactor, spacing } = opts
  const bleed = opts.bleed ?? 1.04
  const bgH = sectionH * bgFactor
  const bgHalf = bgH / 2
  const visibleHalf = sectionH / bleed / 2
  const mid = spacing / 2

  // 内侧边界：至少盖满一屏；中点更远时贴着中点
  const inner = Math.min(bgHalf - MIN_BAND, Math.max(visibleHalf + OUTSIDE, mid - 0.8))
  // 外侧边界：至少 MIN_BAND 宽，并越过中点
  const outer = Math.min(bgHalf, Math.max(inner + MIN_BAND, mid + MIN_BAND))

  /** rem（距背景顶边）→ 百分比 */
  const pct = (rem: number): string =>
    `${((Math.min(bgH, Math.max(0, rem)) / bgH) * 100).toFixed(2)}%`

  const topOuter = pct(bgHalf - outer)
  const topInner = pct(bgHalf - inner)
  const botInner = pct(bgHalf + inner)
  const botOuter = pct(bgHalf + outer)

  return (
    `linear-gradient(to bottom, transparent 0%, transparent ${topOuter}, ` +
    `#000 ${topInner}, #000 ${botInner}, transparent ${botOuter}, transparent 100%), ` +
    `linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%)`
  )
}
