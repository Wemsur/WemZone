/**
 * 相机 —— 一个连续受力的质点
 *
 * 没有状态机。整站只有一个方程（见 `physics.ts`）：
 *
 *     a = F_势能 + F_阻尼 + F_锚定 + F_输入
 *
 * 果冻回弹、切换、落位都是它的不同能量状态，不是不同代码路径。
 *
 * ## 两层职责
 *
 * | 层 | 决定什么 |
 * |---|---|
 * | **意图**（`input.ts`） | 目标井是哪个。一次手势最多 ±1，保证「一次滚动只走一格」 |
 * | **力学**（`physics.ts`） | 怎么走过去。轨迹的「先慢后快再慢」全部来自方程本身 |
 *
 * 滚动时给的力（`pull`）不是单独一条「果冻动画」—— 它就是加进同一个方程的
 * 输入力。能量不够就越不过势垒、退回井底并阻尼振荡；能量够就落进下一个井。
 * 两者是同一种运动。
 *
 * ## 停帧
 *
 * 当相机静止在目标井、且没有待处理的输入力时，`tick` 返回 false 让 rAF 停下
 * —— 这是「静止时主线程零开销」的实现。空闲晃动交给 CSS 合成动画（见 main.css）。
 */

import { onFrame, wake } from '@/lib/scheduler'
import { prefersReducedMotion } from '@/lib/chase'

import { CAMERA } from './constants'
import { getTimeScale } from './debug'
import { createInput, type InputSource } from './input'
import {
  advance,
  atRest,
  FIXED_STEP,
  type PhysicsParams,
  type PhysicsState,
} from './physics'
import { buildPath, type CameraPath } from './spatial'
import type { CameraFrame, CameraPose, CameraStateName, Intent, Stop } from './types'

export interface CameraConfig {
  stops: readonly Stop[]
  /** 透视距离（rem）。必须与 CSS 里的 --perspective 一致。 */
  perspective: number
  /** 用户可调的滑动灵敏度倍率（1 = 默认），见 input.ts 的 InputOptions。 */
  getSensitivity?: () => number
}

export interface Engine {
  /** 挂到 DOM。返回卸载函数。 */
  attach(): () => void
  /** 订阅每帧状态（命令式，不进 Vue 响应式）。 */
  subscribe(cb: (frame: CameraFrame) => void): () => void
  /** 订阅「停到某个整数区块」这一刻（低频，可进响应式）。 */
  onSettle(cb: (index: number) => void): () => void
  goTo(index: number, opts?: { immediate?: boolean }): void
  step(dir: 1 | -1): void
  /** 当前整数区块（最近的井）。 */
  readonly current: number
  /**
   * 粗略的「运动状态」标签。
   *
   * **这不是状态机** —— 相机内部只有一个连续的 `s` / `v`。这个标签纯粹是给
   * UI / 调试显示用的：由「是否在动」与「是否在目标井」推出来，不参与运动计算。
   */
  readonly state: CameraStateName
  /** 连续索引（含转场中的小数）。调参面板显示用。 */
  readonly displayIndex: number
  /** 当前速度（索引/秒，按引擎时间）。调试显示用。 */
  readonly speed: number
  /** 目标井（整数）。 */
  readonly target: number
  readonly path: CameraPath
  /** 手动注入一个意图（调试 / 测试用）。 */
  dispatch(intent: Intent): void
  /** 重建空间路径（调参用，几何参数改了才需要）。 */
  rebuild(stops: readonly Stop[]): void
  /**
   * 开发用「总览」：把镜头拉远到能看见整个平面，位姿不再跟随路径。
   *
   * 只影响**渲染位姿**（`frame.pose`），不动 `phys.s` —— 所以滚动仍然在
   * 改当前索引，总览里画出的相机标记会沿轨迹移动。`distance` 由调用方
   * 按「整个平面要占多少屏幕」算好传进来（见 components/OverviewLayer.vue）。
   */
  setOverview(on: boolean, distance?: number): void
  readonly overview: boolean
}

export function createCamera(cfg: CameraConfig): Engine {
  let path = buildPath(cfg.stops)
  let last = path.last

  function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
  }

  /* ---- 唯一的运动状态 ---- */
  let phys: PhysicsState = { s: 0, v: 0 }
  /** 目标井（整数索引） */
  let anchor = 0
  /** 已通知过的落位索引 */
  let settledIndex = 0
  /** 本帧剩余的输入力（由 pull 意图累积，每帧耗散） */
  let inputForce = 0
  /** 输入力的衰减半衰期（ms）：滚轮的一次冲量不该持续几秒 */
  const INPUT_FORCE_DECAY_MS = 90

  /** 攒下来的模拟时间，跨帧保留（步长见 physics.ts 的 FIXED_STEP） */
  let accumulator = 0

  /** 驱动运动模糊与动态倾斜：索引/秒 */
  let velocity = 0
  let dirVec = { x: 0, y: 0 }

  /** 总览（开发用）：镜头拉远看整个平面，位姿不跟路径 */
  let overview = false
  let overviewDistance = 0

  let stopFrame: (() => void) | null = null
  let detach: (() => void) | null = null

  const frameSubs = new Set<(f: CameraFrame) => void>()
  const settleSubs = new Set<(i: number) => void>()

  function physicsParams(): PhysicsParams {
    return {
      k: CAMERA.PHYSICS_K,
      damping: CAMERA.PHYSICS_DAMPING,
      maxSpeed: CAMERA.PHYSICS_MAX_SPEED,
      anchorSaturation: CAMERA.PHYSICS_ANCHOR_SATURATION,
      // 首尾之外仍然允许滑出去一段：区间外换成更软、阻尼更大的边界弹簧
      bounds: { min: 0, max: last },
      edgeStiffness: CAMERA.EDGE_STIFFNESS,
      edgeDamping: CAMERA.EDGE_DAMPING,
    }
  }

  /* ---- 输入 ---- */
  const input: InputSource = createInput({
    getIndex: () => phys.s,
    last,
    getSensitivity: cfg.getSensitivity,
  })

  function emitFrame(): void {
    const frame = buildFrame()
    for (const cb of frameSubs) cb(frame)
  }

  function buildFrame(): CameraFrame {
    return {
      index: phys.s,
      pose: overview ? overviewPose() : currentPose(),
      velocity,
      dir: dirVec,
      state: stateLabel(),
    }
  }

  /**
   * 总览位姿：对准平面质心、正对内容面、距离由调用方给定。
   *
   * 倾角固定为 0：总览是「看地图」，不是「飞过去」，任何倾斜都会让
   * 边缘的区块因透视偏移而偏离它在轨迹上的真实位置。
   */
  function overviewPose(): CameraPose {
    const c = path.centroid()
    return { x: c.x, y: c.y, d: Math.max(overviewDistance, CAMERA.BASE_DISTANCE), rx: 0, ry: 0 }
  }

  /**
   * 给 UI 看的粗略标签。**不参与运动计算** —— 它只是从连续的 s / v 推出来的。
   */
  function stateLabel(): CameraStateName {
    const still = Math.abs(phys.v) < 0.05
    const atAnchor = Math.abs(phys.s - anchor) < 0.02
    if (still && atAnchor) return 'IDLE'
    if (atAnchor) return 'PULL' // 在目标井附近但还在晃 = 果冻
    if (still) return 'SETTLE'
    return 'TRANSIT'
  }

  /** 把连续索引 + 速度驱动的倾斜合成最终位姿。 */
  function currentPose(): CameraPose {
    const base = path.sample(phys.s)
    return {
      x: base.x,
      y: base.y,
      d: base.d,
      rx: base.rx + dynamicTiltX(),
      ry: base.ry + dynamicTiltY(),
    }
  }

  /** 速度驱动的动态倾斜：越快越「侧倾」，像飞机转弯。 */
  function dynamicTiltX(): number {
    return clamp(velocity * CAMERA.TILT_VEL_GAIN, -CAMERA.TILT_MAX_DEG, CAMERA.TILT_MAX_DEG)
  }

  function dynamicTiltY(): number {
    const t = clamp(
      velocity * CAMERA.TILT_VEL_GAIN * 0.6,
      -CAMERA.TILT_MAX_DEG,
      CAMERA.TILT_MAX_DEG,
    )
    return dirVec.y * t
  }

  /* ---- 帧循环 ---- */

  function tick(dtMs: number): boolean {
    // 慢放：真实 dt 先按上限钳住，再乘时间缩放。
    const scaledMs = Math.min(dtMs, CAMERA.MAX_DT_MS) * getTimeScale()
    const p = physicsParams()

    // ---- 固定步长积分 ----
    //
    // 半隐式欧拉在步长变大时会**额外增加数值阻尼**：实测同一条切换，
    // dt=16.7ms 的过冲是 1.03%，dt=1ms 是 2.67% —— 也就是说手感会随
    // 刷新率变化，慢放时也会看到不一样的轨迹。
    //
    // 所以把模拟时间攒进累加器，永远用 FIXED_STEP 推进。这样
    // 60Hz / 144Hz / 慢放 0.25× 得到的**轨迹完全一致**，只是真实时长不同。
    // 慢放看到的过冲、落位、模糊，就是正常速度下真正发生的事。
    accumulator += scaledMs / 1000
    // 防止长时间卡顿（标签页切回）后一次补几千步
    if (accumulator > 0.5) accumulator = 0.5

    while (accumulator >= FIXED_STEP) {
      phys = advance(phys, anchor, inputForce, FIXED_STEP, p)
      // 输入力也按固定步长衰减，保证与帧率、慢放倍率都无关
      inputForce *= Math.pow(2, -(FIXED_STEP * 1000) / INPUT_FORCE_DECAY_MS)
      accumulator -= FIXED_STEP
    }
    if (Math.abs(inputForce) < 1e-3) inputForce = 0

    // 速度：索引/秒，供模糊与倾斜使用
    velocity = phys.v
    updateDirVec()

    // 落位检测：进入目标井且速度很小
    if (atRest(phys.s, phys.v, anchor)) {
      // 吸附到井底，避免长期停在 0.9997
      phys = { s: anchor, v: 0 }
      velocity = 0
      inputForce = 0
      notifySettle(anchor)
      emitFrame()
      return false // 停帧：静止零开销
    }

    emitFrame()
    return true
  }

  function updateDirVec(): void {
    const eps = 0.01
    const a = path.sample(phys.s - eps)
    const b = path.sample(phys.s + eps)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    dirVec = { x: dx / len, y: dy / len }
  }

  function ensureFrame(): void {
    if (stopFrame) {
      wake()
      return
    }
    stopFrame = onFrame(tick)
  }

  function releaseFrame(): void {
    stopFrame?.()
    stopFrame = null
  }

  /* ---- 意图 ---- */

  function handleIntent(intent: Intent): void {
    switch (intent.kind) {
      case 'pull': {
        // 无障碍：减少动效时不做果冻
        if (prefersReducedMotion()) return
        // 滚动给的是一个**力**，不是一段预先写好的位移动画。
        // 力作用在同一个方程上：能量不够就退回井底（果冻），够了就越过势垒。
        //
        // 响应是**饱和**的（tanh），不是线性：触控板一次微滑累计只有几像素，
        // 线性映射算出来的力约等于零 —— 用户会直接说「触控板没反应」。
        // 饱和曲线把小输入抬到可感知的量级，同时不让大输入失控。
        const d = clamp(intent.delta, -CAMERA.PULL_MAX_DELTA, CAMERA.PULL_MAX_DELTA)
        const mag = Math.abs(d)
        const sign = Math.sign(d)
        if (mag === 0) return

        const force =
          sign * CAMERA.PULL_FORCE_MAX * Math.tanh(mag / CAMERA.PULL_FORCE_SATURATION_PX)
        const impulse =
          sign * CAMERA.PULL_IMPULSE_MAX * Math.tanh(mag / CAMERA.PULL_IMPULSE_SATURATION_PX)

        inputForce += force
        // 同时给一点速度冲量，让轻滚也有可感知的「推」
        phys = {
          s: phys.s,
          v: clamp(
            phys.v + impulse,
            -CAMERA.PHYSICS_MAX_SPEED,
            CAMERA.PHYSICS_MAX_SPEED,
          ),
        }
        ensureFrame()
        break
      }
      case 'step': {
        setAnchor(Math.round(anchor) + intent.dir)
        break
      }
      case 'jump': {
        setAnchor(intent.index)
        break
      }
    }
  }

  /** 设置目标井。物理负责走过去 —— 没有补间、没有缓动曲线。 */
  function setAnchor(target: number): void {
    const clamped = clamp(Math.round(target), 0, last)
    if (clamped === anchor) {
      // 已经在目标井：给一点「顶一下」的力，让边界也有反馈
      ensureFrame()
      return
    }
    anchor = clamped

    // 无障碍：减少动效时直接落位
    if (prefersReducedMotion()) {
      phys = { s: anchor, v: 0 }
      velocity = 0
      inputForce = 0
      notifySettle(anchor)
      emitFrame()
      return
    }

    ensureFrame()
  }

  function notifySettle(index: number): void {
    if (index === settledIndex) return
    settledIndex = index
    for (const cb of settleSubs) cb(index)
  }

  return {
    attach(): () => void {
      // 幂等：重复 attach 先卸掉上一次的监听。
      // 开发时 HMR 会反复重建组件，若每次 attach 都叠一个 window 监听，
      // 一次按键会被处理 N 次（表现为「按一下跳好几格」）。
      detach?.()

      const detachInput = input.attach()
      const offIntent = input.onIntent(handleIntent)
      ensureFrame()

      detach = () => {
        offIntent()
        detachInput()
        releaseFrame()
        detach = null
      }
      return detach
    },

    subscribe(cb): () => void {
      frameSubs.add(cb)
      cb(buildFrame())
      return () => frameSubs.delete(cb)
    },

    onSettle(cb): () => void {
      settleSubs.add(cb)
      return () => settleSubs.delete(cb)
    },

    goTo(index, opts): void {
      if (opts?.immediate) {
        anchor = clamp(Math.round(index), 0, last)
        phys = { s: anchor, v: 0 }
        velocity = 0
        inputForce = 0
        // 立即定位也要通知落位订阅者 —— 否则 Vue 侧的 current ref 与 URL hash
        // 都不会跟着更新（深链接刷新后 HUD 与地址栏会停在旧值）。
        notifySettle(anchor)
        emitFrame()
        return
      }
      setAnchor(index)
    },

    step(dir): void {
      setAnchor(Math.round(anchor) + dir)
    },

    dispatch(intent): void {
      handleIntent(intent)
    },

    get current(): number {
      return Math.round(phys.s)
    },
    get state(): CameraStateName {
      return stateLabel()
    },
    get displayIndex(): number {
      return phys.s
    },
    get speed(): number {
      return velocity
    },
    get target(): number {
      return anchor
    },
    /**
     * **必须是 getter**。早先写成 `path,`，对象属性在创建时就固定成了
     * 最初那条路径 —— `rebuild()` 换掉了闭包里的 `path`，但外界拿到的
     * 仍是旧路径。调参面板改几何时于是出现：相机按新路径移动、区块还停在
     * 旧位置，视角直接偏到区块之间的背景上。
     */
    get path(): CameraPath {
      return path
    },
    get overview(): boolean {
      return overview
    },
    setOverview(on: boolean, distance?: number): void {
      overview = on
      if (distance !== undefined) overviewDistance = distance
      emitFrame()
    },
    rebuild(next: readonly Stop[]): void {
      path = buildPath(next)
      last = path.last
      anchor = clamp(anchor, 0, last)
      phys = { s: clamp(phys.s, 0, last), v: 0 }
      settledIndex = clamp(settledIndex, 0, last)
      velocity = 0
      inputForce = 0
      emitFrame()
    },
  }
}
