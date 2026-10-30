import { describe, expect, it } from 'vitest'

import type { CameraPose } from '@/engine/types'
import { renderPose } from '@/engine/world'

/**
 * `renderPose` 的补偿矩阵
 *
 * 用假的 DOM 元素接住写出的 transform 字符串，解析回数值，
 * 验证「相机看向的那个点始终投影到屏幕中心、且距离恒为 d」。
 *
 * 这条性质曾经被破坏：补偿用了 `-rx`，而 transform 写的是 `rotateX(+rx)`，
 * 符号相反 → 倾斜 3.2° 时区块被放大约 46%，落位时缩回去再弹一下。
 */

interface Parsed {
  t: [number, number, number]
  rx: number
  ry: number
}

function parse(transform: string): Parsed {
  const m = transform.match(
    /translate3d\(([-\d.]+)rem, ([-\d.]+)rem, ([-\d.]+)rem\) rotateX\(([-\d.]+)deg\) rotateY\(([-\d.]+)deg\)/,
  )
  if (!m) throw new Error(`无法解析 transform: ${transform}`)
  return { t: [+m[1], +m[2], +m[3]], rx: +m[4], ry: +m[5] }
}

function applyPose(pose: CameraPose, P: number): Parsed {
  const el = { style: { transform: '' } } as unknown as HTMLElement
  renderPose(el, pose, P)
  return parse(el.style.transform)
}

/** 把世界坐标里的点按 transform 变换到 #viewport 坐标。 */
function project(p: { x: number; y: number }, out: Parsed): [number, number, number] {
  const DEG = Math.PI / 180
  const a = out.rx * DEG
  const b = out.ry * DEG
  // 与 CSS 的 `rotateX(rx) rotateY(ry)` 一致：先 rotateY，再 rotateX
  const x1 = p.x * Math.cos(b)
  const z1 = -p.x * Math.sin(b)
  const y2 = p.y * Math.cos(a) - z1 * Math.sin(a)
  const z2 = p.y * Math.sin(a) + z1 * Math.cos(a)
  return [x1 + out.t[0], y2 + out.t[1], z2 + out.t[2]]
}

describe('renderPose 的相机补偿', () => {
  const P = 120

  const poses: CameraPose[] = [
    { x: 22.1, y: 0, d: 34, rx: 0, ry: 0 },
    { x: -25.155, y: 72, d: 34, rx: 3.2, ry: 3.2 },
    { x: 25.898, y: 144, d: 34, rx: -3.2, ry: -3.2 },
    { x: 0, y: 36, d: 34, rx: 2.5, ry: -1.7 },
    { x: 20.3742, y: 288, d: 34, rx: 1.1, ry: 2.9 },
  ]

  it('相机看向的点始终投影到屏幕中心，且深度恒为 P−d', () => {
    for (const pose of poses) {
      const out = applyPose(pose, P)
      const [x, y, z] = project({ x: pose.x, y: pose.y }, out)
      expect(x).toBeCloseTo(0, 3)
      expect(y).toBeCloseTo(0, 3)
      // 深度必须恒为 P−d —— 这决定了投影缩放 P/d 恒定，也就是「不会缩放」
      expect(z).toBeCloseTo(P - pose.d, 3)
    }
  })

  it('倾斜不会改变内容面的投影缩放', () => {
    // 同一个相机位置，只改倾角：看向点的深度必须完全不变
    for (const rx of [0, 1.6, 3.2, -3.2]) {
      const out = applyPose({ x: -25.155, y: 72, d: 34, rx, ry: rx }, P)
      const [, , z] = project({ x: -25.155, y: 72 }, out)
      expect(z).toBeCloseTo(P - 34, 3)
    }
  })
})
