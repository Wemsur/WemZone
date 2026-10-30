/**
 * 从区块配置生成相机停靠点
 *
 * 规则（见 `constants.ts` 的 VERTICAL_SPACING / LATERAL_AMPLITUDE 等）：
 *   y_i = -i · VERTICAL_SPACING        单调向下
 *   x_i = ±LATERAL_AMPLITUDE · shape(i) 左右交替，shape 让脊线轻微弯曲
 *   d_i = BASE_DISTANCE ± DISTANCE_JITTER  每区镜头感不同
 */

import { CAMERA } from './constants'
import type { Stop } from './types'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 脊线的轻微弯曲：让左右交替不是机械的正负交替，而是沿一条缓和的正弦脊线，
 * 于是相机路径更像「一条有生命的曲线」而不是折线。
 */
function ridgeShape(i: number): number {
  return 0.85 + 0.15 * Math.sin(i * 0.9)
}

/** 相机距离的抖动，让每区的推拉感不同。 */
function distanceWobble(i: number): number {
  return Math.sin(i * 1.7) * CAMERA.DISTANCE_JITTER
}

export function buildStops(): Stop[] {
  return ACTIVE_SECTIONS.map((section, i) => {
    const lateral = (i % 2 === 0 ? 1 : -1) * CAMERA.LATERAL_AMPLITUDE * ridgeShape(i)
    return {
      id: section.id,
      x: lateral,
      y: i * CAMERA.VERTICAL_SPACING,
      d: CAMERA.BASE_DISTANCE + distanceWobble(i),
      // 静止基准倾角必须是 0。
      //
      // 区块要**铺满视野**，而倾斜的平面投影会变短：实测 rx=-1.2°、ry≈1.5°
      // 时区块只占视口的 91%×92%，四周露出一圈背景，看起来又变成
      // 「屏幕中间一张卡片」。3D 感由别的东西提供 —— 相机沿曲线运动、
      // 速度驱动的动态倾斜（见 camera.ts）、以及空闲晃动。
      rx: 0,
      ry: 0,
    } satisfies Stop
  })
}
