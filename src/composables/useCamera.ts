/**
 * 相机的 Vue 侧接口
 *
 * ## 关键纪律：引擎永不逐帧写响应式状态
 *
 * 引擎是 vanilla TS，每帧都在变。如果每帧去改一个 `ref`，Vue 的响应式系统
 * 会以 60Hz 触发渲染 —— 这是这类项目的经典性能陷阱。
 *
 * 所以这里分成两条通道：
 *
 *  - **`useCamera()`** 只暴露**离散**状态：`current`（整数区块号）、`state`
 *    （状态名）。`current` 只在整数变化时更新，频率从 60Hz 降到「每次切换 1 次」。
 *  - **`useCameraFrame(cb)`** 是每帧数据的唯一正确入口：命令式订阅，
 *    回调里**直接写 DOM / CSS 变量**，完全不经过 Vue 渲染。
 *
 * 绝不 `ref()` 一个 pose 对象。需要每帧数据的组件用 `useCameraFrame`。
 */

import {
  inject,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

import { createCamera, buildStops, type CameraFrame, type Engine } from '@/engine'
import { CAMERA } from '@/engine/constants'
import { renderPose } from '@/engine/world'

export interface CameraApi {
  /** 最近的整数区块号。仅在整数变化时更新。 */
  current: Readonly<Ref<number>>
  /** 当前状态名。低频。 */
  state: Readonly<Ref<string>>
  goTo(index: number, opts?: { immediate?: boolean }): void
  step(dir: 1 | -1): void
  /** 命令式拿到引擎，供需要每帧数据的组件 */
  engine: Engine
  /** 把引擎挂到 DOM 上（World.vue 调用） */
  attachTo(worldEl: HTMLElement): () => void
}

const CAMERA_KEY: InjectionKey<CameraApi> = Symbol('camera')

export function provideCamera(): CameraApi {
  const engine = createCamera({
    stops: buildStops(),
    perspective: CAMERA.PERSPECTIVE,
  })

  const current = ref(0)
  const state = ref<string>('IDLE')

  // 每帧写 #world —— 全站唯一的每帧 DOM 写入点
  let worldEl: HTMLElement | null = null
  const stopFrame = engine.subscribe((frame: CameraFrame) => {
    if (worldEl) renderPose(worldEl, frame.pose, CAMERA.PERSPECTIVE)
    // 只在状态名变化时碰响应式
    if (state.value !== frame.state) state.value = frame.state
  })

  engine.onSettle((index) => {
    if (current.value !== index) current.value = index
  })

  onBeforeUnmount(() => {
    stopFrame()
  })

  const api: CameraApi = {
    current: readonly(current),
    state: readonly(state),
    goTo: (index, opts) => engine.goTo(index, opts),
    step: (dir) => engine.step(dir),
    engine: markRaw(engine),
    attachTo(el: HTMLElement): () => void {
      worldEl = el
      return engine.attach()
    },
  }

  provide(CAMERA_KEY, api)
  return api
}

export function useCamera(): CameraApi {
  const api = inject(CAMERA_KEY)
  if (!api) throw new Error('useCamera() 必须在 provideCamera() 之后使用')
  return api
}

/**
 * 订阅每帧相机状态。
 *
 * **回调里请直接写 DOM / CSS 变量，不要改 ref。** 这是每帧数据的正确用法。
 * 组件卸载时自动退订。
 */
export function useCameraFrame(cb: (frame: CameraFrame) => void): void {
  const { engine } = useCamera()
  let stop: (() => void) | null = null
  onMounted(() => {
    stop = engine.subscribe(cb)
  })
  onBeforeUnmount(() => {
    stop?.()
    stop = null
  })
}
