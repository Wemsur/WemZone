import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import { ShaderMount, type ShaderMountUniforms } from '@paper-design/shaders'

import { useCameraFrame } from '@/composables/useCamera'
import { getPerfProfile } from '@/lib/perf'
import { overviewOn } from '@/lib/overview'

/**
 * 在某个区块背景里挂一层 Paper Shader，并在区块离开视野时把它停下
 *
 * 背景是**常驻**动画（用户要求静止也流动），但只有当前区块与正在过渡的
 * 区块需要真的跑。每 250ms 读一次宿主元素投影到屏幕上的矩形，完全在
 * 视野外就 `setSpeed(0)`，于是离屏区块的着色器不排帧。
 *
 * 用轮询而不是响应式状态：位置是相机引擎每帧直接写 DOM transform 得到的，
 * 若把它接进 Vue 响应式，等于每帧触发一次组件更新 —— 那正是架构上
 * 一直在避免的事。
 */

export interface ShaderLayer {
  host: Ref<HTMLElement | null>
  fragment: string
  uniforms: ShaderMountUniforms
  /** 正常播放时的时间流速 */
  speed: number
  /**
   * 相机运动时的处理方式。两者都不改变静止时的画面。
   *
   * - `'pause'`（默认）：停帧。适合**高频图案**——抖动点阵的格子大小是按
   *   输出像素算的（`u_pxSize`），降分辨率会把点阵放大成肉眼可见的方块；
   *   而这些层的流速都很慢（0.07–0.09），整个画面在平移时停一秒多看不出来。
   * - `'lowres'`：降到 1/4 像素继续跑。适合**平滑的流体**——它没有高频细节，
   *   降分辨率看不出来，因此仍保持「一直在流动」的观感。
   *
   * 实测转场时把 3 个着色器画布全部藏掉，帧间隔从 p50 8.3ms / p90 12.4ms
   * 回到 4.2 / 4.3 —— 着色器填充是转场里最大的一笔渲染开销。
   */
  motion?: 'pause' | 'lowres'
}

/** 视口外多少像素内仍算「可见」——留一点余量，进场时已经在动 */
const MARGIN = 160

/**
 * 判定「相机在运动」的速度阈值（索引/秒）。
 *
 * 进出用两个不同的值：果冻回弹会让速度在阈值附近来回穿几次，
 * 单阈值会让每一层反复重建帧缓冲。滞环把它压到每次手势最多两次状态切换。
 */
const MOTION_ENTER = 0.09
const MOTION_EXIT = 0.02

/** `lowres` 层运动期间的像素倍率（0.25 = 线性分辨率减半） */
const LOW_RES_RATIO = 0.25

export function useShaderLayers(layers: ShaderLayer[]): void {
  const profile = getPerfProfile()
  const mounts: { mount: ShaderMount; baseSpeed: number; policy: 'pause' | 'lowres' }[] = []
  let timer = 0
  /** 相机是否在运动 */
  let moving = false
  /** lowres 层当前是否处于降分辨率状态（避免反复重建帧缓冲） */
  let lowRes = false

  const lowResPixels = Math.max(1, Math.round(profile.maxPixels * LOW_RES_RATIO))

  function inViewport(el: HTMLElement | null): boolean {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    return r.bottom > -MARGIN && r.top < vh + MARGIN && r.right > -MARGIN && r.left < vw + MARGIN
  }

  /**
   * 决定每一层的播放速度：离屏 → 0；相机运动中且策略是 `pause` → 0；
   * 其余按正常流速。
   *
   * 总览时所有区块同时可见 —— 让五个 WebGL 背景一起跑没有意义，
   * 而且在远处它们只是几团色块。停掉，总览本身要的是几何关系。
   */
  function applySpeeds(): void {
    const visible = !overviewOn.value && inViewport(layers[0]?.host.value ?? null)
    for (const { mount, baseSpeed, policy } of mounts) {
      mount.setSpeed(visible && !(moving && policy === 'pause') ? baseSpeed : 0)
    }
  }

  function applyResolution(): void {
    if (lowRes === moving) return
    lowRes = moving
    const cap = lowRes ? lowResPixels : profile.maxPixels
    for (const { mount, policy } of mounts) {
      if (policy === 'lowres') mount.setMaxPixelCount(cap)
    }
  }

  onMounted(() => {
    if (profile.cssOnly) return

    for (const layer of layers) {
      const el = layer.host.value
      if (!el) continue
      const mount = new ShaderMount(
        el,
        layer.fragment,
        layer.uniforms,
        undefined,
        layer.speed * profile.speed,
        0,
        1,
        profile.maxPixels,
      )
      mounts.push({
        mount,
        baseSpeed: layer.speed * profile.speed,
        policy: layer.motion ?? 'pause',
      })
    }

    applySpeeds()
    timer = window.setInterval(applySpeeds, 250)
  })

  onBeforeUnmount(() => {
    if (timer !== 0) window.clearInterval(timer)
    timer = 0
    for (const { mount } of mounts) mount.dispose()
    mounts.length = 0
  })

  // 只在速度跨过阈值的那一帧改变状态，过渡途中只做一次数值比较。
  useCameraFrame((frame) => {
    const speed = Math.abs(frame.velocity)
    const next = moving ? speed > MOTION_EXIT : speed > MOTION_ENTER
    if (next === moving) return
    moving = next
    applySpeeds()
    applyResolution()
  })
}
