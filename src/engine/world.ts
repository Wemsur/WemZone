/**
 * CSS 3D 写出层
 *
 * ## 每帧只写一次
 *
 * 整个引擎的性能前提：**每帧主线程只写 `#world` 的 transform 一次**，
 * 帧内零 `getBoundingClientRect`。几何在启动时算完，之后只有这一个写入点。
 *
 * ## 坐标系
 *
 * CSS 3D 里：X 向右、Y 向下、Z 向观察者。`perspective: P` 意味着眼睛在
 * z = +P 处（`perspective-origin` 在视口中心）。
 *
 * `#world` 是个 0×0 的盒子、位于视口中心，所以**世界原点 = 视口中心**，
 * 内容块用 `translate3d(x, y, 0)` 摆在世界里。
 *
 * ## 每帧的变换
 *
 * 摄像机在 (px, py)、距内容面 d、带倾角 (rx, ry)。要让它看到内容点 (px, py)：
 *
 * 1. **绕视口中心旋转** `-rx / -ry` —— 这就是「摄像机倾斜」：屏幕中心那个点不动，
 *    周围的一切绕它转，正是镜头俯仰/偏航的观感。
 * 2. **平移**，把内容点送到屏幕中心，并把内容面推到距眼 d 的位置。
 *
 * 平移量必须精确地抵消旋转对内容点的位移，否则倾角一大（全览模式）内容就跑偏：
 *
 *     t = (0, 0, P − d) − R·(px, py, 0)
 *
 * 小角度下 R ≈ I，t ≈ (−px, −py, P − d)，但大角度下这一项不能省。
 *
 * ## 距离变、大小不变
 *
 * 内容面被推到 z = P − d，投影缩放 = `P / (P − (P − d)) = P / d`。
 * 每个 section 的**静态** transform 里带一个反向补偿 `scale(d_i / P)`，
 * 于是静止时净缩放 = 1 —— 视觉大小恒定。
 *
 * 转场途中 `d(t)` 连续变化，而各 section 的补偿是各自固定的，
 * 净缩放 = `d_i / d(t)`，内容随镜头推拉轻微缩放，落位精确回到 1。
 * 这正是「推拉镜头」该有的观感，**而且补偿是静态的，不进每帧循环**。
 *
 * （若做「每帧实时补偿」，每帧写入从 1 次变成 N 次，违背整个架构的性能前提。）
 */

import type { CameraPose, Stop } from './types'

const DEG = Math.PI / 180

/**
 * 把相机位姿写进 `#world` 的 transform。**每帧唯一的写入点。**
 *
 * @param world   `#world` 元素
 * @param pose    当前相机位姿
 * @param P       透视距离（rem）
 * @param compensate 是否按 `d/P` 把相机位置缩放到「渲染平面」坐标。
 *   正常浏览为 true；总览为 false（那时区块不做距离补偿，位置也在设计坐标上）。
 */
export function renderPose(
  world: HTMLElement,
  pose: CameraPose,
  P: number,
  compensate = true,
): void {
  // **符号必须与下面 transform 里写的 rotateX/rotateY 完全一致。**
  //
  // 这里曾经用 `-pose.rx` 算补偿、却写 `rotateX(+pose.rx)` —— 两者反号，
  // 旋转带来的深度位移不但没被抵消，反而翻倍。后果是：相机在转场中倾斜
  // 3.2° 时，区块被放大约 46%，落位时又缩回去再弹一下，看起来就是
  // 「到达后突然缩小再放大」。
  //
  // 补偿矩阵 R 就是 CSS 实际应用的 `rotateX(rx) rotateY(ry)`。
  const a = pose.rx * DEG
  const b = pose.ry * DEG

  // 相机位置要落在**渲染平面**的坐标里：区块的静态 transform 用
  // `translate3d(x·s, y·s) scale(s)`，位置和尺寸都乘了 s = d/P。
  // 若这里仍用未缩放的 (x, y)，相机会朝着一个比区块远 4.4 倍的坐标看，
  // 画面就偏了 —— 而且区块间距在屏幕上会变成「好几屏」，背景自然接不上。
  const s = compensate ? pose.d / P : 1
  const px = pose.x * s
  const py = pose.y * s

  // R·(px, py, 0)，R = rotateX(a) · rotateY(b)（与下面 transform 列表的顺序一致）
  const cosA = Math.cos(a)
  const sinA = Math.sin(a)
  const cosB = Math.cos(b)
  const sinB = Math.sin(b)

  // rotateY(b) 先作用于点
  const x1 = px * cosB
  const z1 = -px * sinB
  // 再 rotateX(a)
  const y2 = py * cosA - z1 * sinA
  const z2 = py * sinA + z1 * cosA

  const tx = -x1
  const ty = -y2
  const tz = P - pose.d - z2

  world.style.transform =
    `translate3d(${round(tx)}rem, ${round(ty)}rem, ${round(tz)}rem) ` +
    `rotateX(${round(pose.rx, 4)}deg) rotateY(${round(pose.ry, 4)}deg)`
}

/**
 * 一个 section 的**静态** transform：把它摆在世界坐标 (x, y)，并带上
 * 距离补偿 `scale(d / P)`。
 *
 * `transform-origin` 必须是 `0 0`，且 `translate(-50%, -50%)` 放在最内层 ——
 * 这样 (x, y) 指的是**内容块的中心**，且缩放发生在中心。
 * 详见本文件顶部「距离变、大小不变」。
 *
 * @param compensate `false` 时不带距离补偿（scale = 1）。总览模式用：
 *   镜头在很远处，若仍按 `d_i / P` 补偿，区块会缩成小点、间距却不变，
 *   看到的不是「整个平面」而是一串孤立的小块。关掉补偿后世界尺寸就是
 *   设计尺寸（一屏 × 5 个区块），拉远后整张地图才是等比例的。
 */
export function staticSectionTransform(stop: Stop, P: number, compensate = true): string {
  const s = compensate ? stop.d / P : 1
  // **位置也要乘 s**：补偿的作用是让「一屏的世界尺寸 = 一屏的屏幕尺寸」，
  // 区块之间的间距（72rem）同样要按这个比例落到世界里，否则区块在屏幕上
  // 会相隔四五屏、背景根本接不上（总览里 scale = 1，看起来才是对的）。
  return (
    `translate3d(${round(stop.x * s)}rem, ${round(stop.y * s)}rem, 0) ` +
    `scale(${round(s, 6)}) translate(-50%, -50%)`
  )
}

/** 保留 n 位小数，减少 style 字符串抖动（避免无意义的重排）。 */
function round(v: number, n = 4): number {
  const f = 10 ** n
  return Math.round(v * f) / f
}
