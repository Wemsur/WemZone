/**
 * 区块背景的竖直渐隐 —— 按**实际几何**算，而不是写死百分比
 *
 * ## 目标
 *
 * 1. **静止时视野内满不透明**。渐隐带不能出现在屏幕里，否则用户看到的是
 *    「背景在视野边缘就开始发灰」，而不是一整个背景。
 * 2. **整段间隙都用来渐变**：本区**下边缘**一直渐变到下一区**上边缘**。
 *    这两条边之间正好是「本区看不见的部分」，把整段都做成渐变，两块背景
 *    才是真正交融；只留一条窄带的话，看起来仍像各自淡出到黑。
 * 3. **任何窗口比例下都不能变成一条横条**。视野比区块间距还高时（非 16:9
 *    的窗口很容易如此），两区可见区域已经重叠、不存在「间隙」，此时退化成
 *    贴着视野边缘的一条窄带 —— 但那仍然是「屏幕内满不透明」。
 *
 * ## 换算
 *
 * 设 `visibleHalf` 为可见半高、`spacing` 为区块间距：
 *
 *  - 内侧边界（仍完全不透明） = `visibleHalf` —— 正好在视野边缘；
 *  - 外侧边界（完全透明） = `spacing − visibleHalf` —— 正好在下一区的视野边缘。
 *
 * 两区可见区域重叠时（`spacing < 2·visibleHalf`），外侧会落回内侧 + 最小带宽。
 *
 * 下一区背景按 DOM 顺序画在上面、且在它自己的可见区域内不透明，所以本区
 * 淡出的后半段被下一区盖住；真正可见的交叉渐变恰好铺满两区之间的间隙。
 */

export interface BgMaskOptions {
  /** 区块在世界里的高度（rem），即一屏 × 出血系数 */
  sectionH: number
  /**
   * 背景高度的**最小**倍率（相对区块）。
   * 宽版 2（与 main.css 一致）、窄版 1.5。间距很大时会自动加高，
   * 保证淡出带能走到下一区的上边缘而不被背景自己的边截断。
   */
  bgFactor: number
  /** 相邻区块的世界间距（rem） */
  spacing: number
  /**
   * 区块相对「一屏」的出血系数。
   * 宽版是 1.04（见 World.vue 的 sectionSize）；窄版区块正好一屏，取 1。
   */
  bleed?: number
}

/** 淡出带的最小宽度（rem）——再窄就和硬边没区别了 */
const MIN_BAND = 1.6

export interface BgMaskResult {
  /** 竖直 + 横向两条渐变的 mask（两块用 intersect 合成） */
  mask: string
  /** 背景高度，相对区块的百分比（写进 .section-bg 的 height） */
  heightPct: number
}

export function sectionBgMask(opts: BgMaskOptions): BgMaskResult {
  const { sectionH, bgFactor, spacing } = opts
  const bleed = opts.bleed ?? 1.04
  const visibleHalf = sectionH / bleed / 2

  // 内侧边界：正好在视野边缘（视野内永远不透明）
  const inner = Math.max(0, visibleHalf)
  // 外侧边界：正好在下一区的视野边缘 —— 整段间隙都是渐变
  const outer = Math.max(inner + MIN_BAND, spacing - visibleHalf)

  // 背景必须够高：至少到外侧边界，否则淡出带会被自己的边截断。
  // 间距调大时背景随之加高（默认 200% 只是下限）。
  const bgHalf = Math.max((sectionH * bgFactor) / 2, outer)
  const bgH = bgHalf * 2

  /** rem（距背景顶边）→ 百分比 */
  const pct = (rem: number): string =>
    `${((Math.min(bgH, Math.max(0, rem)) / bgH) * 100).toFixed(2)}%`

  const topOuter = pct(bgHalf - outer)
  const topInner = pct(bgHalf - inner)
  const botInner = pct(bgHalf + inner)
  const botOuter = pct(bgHalf + outer)

  return {
    mask:
      `linear-gradient(to bottom, transparent 0%, transparent ${topOuter}, ` +
      `#000 ${topInner}, #000 ${botInner}, transparent ${botOuter}, transparent 100%), ` +
      `linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%)`,
    heightPct: (bgH / sectionH) * 100,
  }
}
