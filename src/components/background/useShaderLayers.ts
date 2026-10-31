import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import { ShaderMount, type ShaderMountUniforms } from '@paper-design/shaders'

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
}

/** 视口外多少像素内仍算「可见」——留一点余量，进场时已经在动 */
const MARGIN = 160

export function useShaderLayers(layers: ShaderLayer[]): void {
  const profile = getPerfProfile()
  const mounts: { mount: ShaderMount; baseSpeed: number }[] = []
  let timer = 0

  function inViewport(el: HTMLElement | null): boolean {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    return r.bottom > -MARGIN && r.top < vh + MARGIN && r.right > -MARGIN && r.left < vw + MARGIN
  }

  function syncVisibility(): void {
    // 总览时所有区块同时可见 —— 让五个 WebGL 背景一起跑没有意义，
    // 而且在远处它们只是几团色块。停掉，总览本身要的是几何关系。
    const visible = !overviewOn.value && inViewport(layers[0]?.host.value ?? null)
    for (const { mount, baseSpeed } of mounts) {
      mount.setSpeed(visible ? baseSpeed : 0)
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
      mounts.push({ mount, baseSpeed: layer.speed * profile.speed })
    }

    syncVisibility()
    timer = window.setInterval(syncVisibility, 250)
  })

  onBeforeUnmount(() => {
    if (timer !== 0) window.clearInterval(timer)
    timer = 0
    for (const { mount } of mounts) mount.dispose()
    mounts.length = 0
  })
}
