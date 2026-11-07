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
import { overviewOn } from '@/lib/overview'
import { scrollSensitivity } from '@/lib/preferences'

export interface CameraApi {
  /** 最近的整数区块号。仅在整数变化时更新。 */
  current: Readonly<Ref<number>>
  /**
   * 目标井（整数）。同样只在变化时更新。
   *
   * 给「需要提前准备内容」的组件用：`current` 在落位后才变，而转场途中
   * 相机已经朝 `target` 走了，只看 `current` 会漏掉前方那一段。
   */
  target: Readonly<Ref<number>>
  /** 当前状态名。低频。 */
  state: Readonly<Ref<string>>
  goTo(index: number, opts?: { immediate?: boolean }): void
  step(dir: 1 | -1): void
  /** 命令式拿到引擎，供需要每帧数据的组件 */
  engine: Engine
  /** 把引擎挂到 DOM 上（World.vue 调用） */
  attachTo(worldEl: HTMLElement): () => void
  /**
   * 几何参数（间距 / 振幅 / 距离）改变后重建路径。
   *
   * 调参面板用：改完常量调一下，区块位置与相机路径立刻按新参数重排。
   * **不影响**力学参数（k / damping / 力增益）—— 那些每帧现读，不用重建。
   */
  rebuildStops(): void
  /** 重建路径后递增，供模板重新计算各区块的静态 transform。 */
  geometryVersion: Readonly<Ref<number>>
}

const CAMERA_KEY: InjectionKey<CameraApi> = Symbol('camera')

export function provideCamera(): CameraApi {
  const engine = createCamera({
    stops: buildStops(),
    perspective: CAMERA.PERSPECTIVE,
    // 灵敏度是「用户偏好」，不是引擎常量：每读一次输入现读，改了立刻生效
    getSensitivity: () => scrollSensitivity.value,
  })

  const current = ref(0)
  const target = ref(0)
  const state = ref<string>('IDLE')
  /** 几何重建计数器：模板依赖它来重算各区块的静态 transform。 */
  const geometryVersion = ref(0)

  // 每帧写 #world —— 全站唯一的每帧 DOM 写入点
  let worldEl: HTMLElement | null = null
  const stopFrame = engine.subscribe((frame: CameraFrame) => {
    // 总览时区块不做距离补偿，相机位置也就不能按 d/P 缩放
    if (worldEl) renderPose(worldEl, frame.pose, CAMERA.PERSPECTIVE, !overviewOn.value)
    // 只在状态名变化时碰响应式
    if (state.value !== frame.state) state.value = frame.state
    if (target.value !== engine.target) target.value = engine.target
  })

  engine.onSettle((index) => {
    if (current.value !== index) current.value = index
  })

  onBeforeUnmount(() => {
    stopFrame()
  })

  const api: CameraApi = {
    current: readonly(current),
    target: readonly(target),
    state: readonly(state),
    goTo: (index, opts) => engine.goTo(index, opts),
    step: (dir) => engine.step(dir),
    engine: markRaw(engine),
    attachTo(el: HTMLElement): () => void {
      worldEl = el
      return engine.attach()
    },
    rebuildStops(): void {
      engine.rebuild(buildStops())
      // 引擎的 path 换了，各区块的静态 transform 要跟着重算 ——
      // 递增计数器让模板重新求值（这是低频操作，只在调参时发生）。
      geometryVersion.value++
      // 路径变了，当前井可能越界；引擎内部已 clamp，这里把视图同步一次。
      engine.goTo(engine.target, { immediate: true })
    },
    geometryVersion: readonly(geometryVersion),
  }

  provide(CAMERA_KEY, api)

  /**
   * DEV-only 调试入口。调参时可以直接在控制台里读连续索引 / 速度，
   * 或者 `__camera.engine.goTo(3)` 跳区。生产构建会被 tree-shake 掉。
   */
  if (import.meta.env.DEV) {
    ;(window as unknown as { __camera?: CameraApi }).__camera = api
  }

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
