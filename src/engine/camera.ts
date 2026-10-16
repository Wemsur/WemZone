/**
 * 相机状态机
 *
 * ```
 * IDLE    --intent(pull)--------> PULL      弹簧解析积分，位移后回弹
 * IDLE    --intent(step|jump)--> TRANSIT   固定时长补间，先慢后快再慢
 * PULL    --弹簧收敛----------> IDLE
 * PULL    --intent(step)------> TRANSIT    （冲量丢弃，从当前 index 重新补间）
 * PULL    --intent(pull)------> PULL       （冲量叠加）
 * TRANSIT --补间完成----------> SETTLE
 * TRANSIT --intent(*)---------> TRANSIT    （忽略，输入锁定）
 * SETTLE  --收敛--------------> IDLE
 * ```
 *
 * **IDLE 时不排 rAF** —— 这是「静止时主线程零开销」的实现。空闲晃动交给
 * `idle.ts` 的 CSS 合成动画（跑在合成线程，与主线程无关）。
 *
 * 状态是唯一的真值来源：`displayIndex` 是 float，目标永远是整数。
 * 整个引擎围绕这一个标量转。
 */

import { onFrame, wake } from '@/lib/scheduler'
import { prefersReducedMotion } from '@/lib/chase'

import { CAMERA } from './constants'
import { createInput, type InputSource } from './input'
import { buildPath, type CameraPath } from './spatial'
import { springSettled, springSolve, type SpringState } from './spring'
import { transitDuration, easeInOutCubic, makeTween, type Tween } from './tween'
import type { CameraFrame, CameraPose, CameraStateName, Intent, Stop } from './types'

export interface CameraConfig {
  stops: readonly Stop[]
  /** 透视距离（rem）。必须与 CSS 里的 --perspective 一致。 */
  perspective: number
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
  /** 当前整数区块（最近停靠点）。 */
  readonly current: number
  /** 当前状态名。 */
  readonly state: CameraStateName
  readonly path: CameraPath
  /** 手动注入一个意图（调试 / 测试用）。 */
  dispatch(intent: Intent): void
}

export function createCamera(cfg: CameraConfig): Engine {
  const path = buildPath(cfg.stops)
  const last = path.last

  function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
  }

  /* ---- 状态 ---- */
  let state: CameraStateName = 'IDLE'
  let displayIndex = 0
  let settledIndex = 0

  /** 弹簧作用在「相对静止位姿的偏移量」上，单位 rem。 */
  let spring: SpringState = { x: 0, v: 0 }
  /** 弹簧偏移的方向（由 pull 的符号决定） */
  let pullDir = 1
  /** 弹簧偏移如何映射到位姿 */
  let pull: { dy: number; dd: number; drx: number } = { dy: 0, dd: 0, drx: 0 }

  let tween: Tween | null = null

  /** 速度（rem/ms，index 的变化率）与运动方向，驱动模糊与动态倾斜 */
  let velocity = 0
  let dirVec = { x: 0, y: 0 }

  let stopFrame: (() => void) | null = null
  /** 当前 attach 的卸载函数；用于让 attach 幂等（见 attach 的注释） */
  let detach: (() => void) | null = null

  const frameSubs = new Set<(f: CameraFrame) => void>()
  const settleSubs = new Set<(i: number) => void>()

  /* ---- 输入 ---- */
  const input: InputSource = createInput({
    getIndex: () => displayIndex,
    last,
  })

  function emitFrame(): void {
    const frame = buildFrame()
    for (const cb of frameSubs) cb(frame)
  }

  function buildFrame(): CameraFrame {
    const pose = currentPose()
    return {
      index: displayIndex,
      pose,
      velocity,
      dir: dirVec,
      state,
    }
  }

  /** 把 displayIndex + 弹簧偏移合成最终位姿。 */
  function currentPose(): CameraPose {
    const base = path.sample(displayIndex)
    const rx = base.rx + pull.drx + dynamicTiltX()
    const ry = base.ry + dynamicTiltY()
    return {
      x: base.x,
      y: base.y + pull.dy,
      d: base.d + pull.dd,
      rx,
      ry,
    }
  }

  /** 速度驱动的动态倾斜：越快越「侧倾」，像飞机转弯。 */
  function dynamicTiltX(): number {
    const t = clamp(velocity * CAMERA.TILT_VEL_GAIN, -CAMERA.TILT_MAX_DEG, CAMERA.TILT_MAX_DEG)
    return t
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
    const before = displayIndex

    if (state === 'PULL') {
      spring = springSolve(spring, 0, dtMs)
      applyPull()
      if (springSettled(spring, 0)) {
        spring = { x: 0, v: 0 }
        pull = { dy: 0, dd: 0, drx: 0 }
        setState('IDLE')
        emitFrame()
        return false // 停帧
      }
    } else if (state === 'TRANSIT' && tween) {
      displayIndex = tween.step(dtMs)
      if (tween.done) {
        displayIndex = Math.round(displayIndex)
        tween = null
        setState('SETTLE')
        notifySettle(displayIndex)
      }
    } else if (state === 'SETTLE') {
      // 补间端点速度已是 0，理论上不需要吸收；这里只处理被 goTo 打断的残余
      if (Math.abs(displayIndex - Math.round(displayIndex)) < 1e-4) {
        displayIndex = Math.round(displayIndex)
        // 速度归零：否则 Phase 2 的运动模糊会因为残留速度而卡住不关
        velocity = 0
        setState('IDLE')
        emitFrame()
        return false // 停帧
      }
    } else {
      // IDLE：没有任何交互动画在跑。**必须停帧** —— 这正是
      // 「静止时主线程零开销」的实现。空闲晃动由 CSS 合成动画承担，
      // 跑在合成线程，与这个循环无关。
      velocity = 0
      emitFrame()
      return false
    }

    // 速度（rem/ms）：用 index 的变化率换算成世界距离的近似
    const dt = Math.max(dtMs, 1)
    const rawV = (displayIndex - before) / dt
    velocity = velocity * 0.6 + rawV * 0.4 // 轻度平滑，避免抖动
    updateDirVec()

    emitFrame()
    return true
  }

  function updateDirVec(): void {
    const eps = 0.01
    const a = path.sample(displayIndex - eps)
    const b = path.sample(displayIndex + eps)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    dirVec = { x: dx / len, y: dy / len }
  }

  function applyPull(): void {
    // 弹簧位移 → 位姿偏移。方向由 pullDir 决定。
    pull = {
      dy: spring.x * pullDir,
      dd: Math.abs(spring.x) * 0.15,
      drx: spring.x * pullDir * 0.9,
    }
  }

  function setState(next: CameraStateName): void {
    state = next
    if (next === 'TRANSIT') input.lock()
    else input.unlock()
  }

  function ensureFrame(): void {
    // 已经注册过就只唤醒 —— 反复注册/注销会丢掉循环的连续性
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

  /* ---- 意图处理 ---- */

  function handleIntent(intent: Intent): void {
    switch (intent.kind) {
      case 'pull': {
        if (state === 'TRANSIT') return
        // 无障碍：减少动效时不做果冻回弹
        if (prefersReducedMotion()) return
        if (state !== 'PULL') setState('PULL')
        pullDir = intent.delta > 0 ? 1 : -1
        // 给位移 + 给速度：位移让画面偏离，速度带来过冲（果冻）
        const disp = clamp(
          intent.delta * CAMERA.PULL_DISP_GAIN,
          -CAMERA.PULL_MAX_DISP,
          CAMERA.PULL_MAX_DISP,
        )
        // 叠加而非覆盖：连续 pull 会更「弹」
        spring = {
          x: spring.x + disp,
          v: spring.v + intent.delta * CAMERA.PULL_VEL_GAIN,
        }
        ensureFrame()
        break
      }
      case 'step': {
        const target = Math.round(displayIndex) + intent.dir
        goToInternal(target, intent.speed)
        break
      }
      case 'jump': {
        goToInternal(intent.index, 0)
        break
      }
    }
  }

  function goToInternal(target: number, speed: number): void {
    const clamped = clamp(target, 0, last)
    // 从当前位置（含弹簧偏移）出发，避免跳变
    const from = displayIndex
    if (Math.abs(from - clamped) < 1e-4) {
      setState('IDLE')
      return
    }

    // 无障碍：用户要求减少动效时，跳过弹性/补间，直接落位。
    // 布局与内容完全保留，只是没有过渡动画（见 docs/DESIGN.md）。
    if (prefersReducedMotion()) {
      displayIndex = clamped
      spring = { x: 0, v: 0 }
      pull = { dy: 0, dd: 0, drx: 0 }
      tween = null
      velocity = 0
      setState('IDLE')
      notifySettle(displayIndex)
      emitFrame()
      return
    }

    tween = makeTween(from, clamped, transitDuration(speed), easeInOutCubic)
    setState('TRANSIT')
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
      // 一次按键会被处理 N 次（表现为「按一下跳好几格」），排查起来极具迷惑性。
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
        displayIndex = clamp(Math.round(index), 0, last)
        spring = { x: 0, v: 0 }
        pull = { dy: 0, dd: 0, drx: 0 }
        tween = null
        velocity = 0
        setState('IDLE')
        // 立即定位也要通知落位订阅者 —— 否则 Vue 侧的 current ref 与 URL hash
        // 都不会跟着更新（深链接刷新后 HUD 与地址栏会停在旧值）。
        notifySettle(displayIndex)
        emitFrame()
        return
      }
      goToInternal(index, 0)
    },

    step(dir): void {
      goToInternal(Math.round(displayIndex) + dir, 0)
    },

    dispatch(intent): void {
      handleIntent(intent)
    },

    get current(): number {
      return Math.round(displayIndex)
    },
    get state(): CameraStateName {
      return state
    },
    path,
  }
}
