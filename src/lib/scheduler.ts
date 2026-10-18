/**
 * 帧调度骨架
 *
 * 从 Celestial-Web 的 `lib/scroll.ts` 抽出，但**去掉了滚动依赖** ——
 * 它现在是一个通用的「需要时才跑的 rAF 循环」：
 *
 *  - 全局只有一个 rAF，多个订阅者共用（不会每个组件各排一个）。
 *  - 每帧把 dt 归一化后交给回调，dt 有上限（标签页切回来时不至于一帧跳完）。
 *  - **回调返回 false 就停帧**：追上目标后立刻停，不做任何空转。
 *    这是「静止时主线程零开销」的实现基础。
 *  - 订阅者清空时彻底摘掉循环。
 *
 * 与 scroll.ts 的区别：那边的时间源是 `window.scrollY` 的追赶，
 * 这里没有时间源 —— 谁来推、推到什么时候停，由调用方（相机状态机）决定。
 */

export type FrameCallback = (dtMs: number) => boolean

const callbacks = new Set<FrameCallback>()

let frame = 0
let lastTime = 0

/** dt 上限（ms）：标签页切回来 / 断点续跑时不至于一帧跳完。 */
const MAX_DT_MS = 100

function tick(now: number): void {
  frame = 0

  // 首次（或上次停帧后重新开始）没有 lastTime，按 60Hz 估一帧
  const dt = lastTime === 0 ? 16.7 : Math.min(now - lastTime, MAX_DT_MS)
  lastTime = now

  // 回调可能在执行中增删订阅者，所以先复制一份再遍历
  let stillRunning = false
  for (const cb of [...callbacks]) {
    if (!callbacks.has(cb)) continue
    // 任何一个人还要继续，这一帧就不停
    if (cb(dt)) stillRunning = true
  }

  if (stillRunning) {
    schedule()
  } else {
    // 全员收工：重置 lastTime，下次从「全新一帧」开始
    lastTime = 0
  }
}

function schedule(): void {
  if (frame !== 0) return
  frame = requestAnimationFrame(tick)
}

/**
 * 注册一个每帧回调，返回注销函数。
 *
 * 回调返回 `true` 表示「我还要下一帧」，返回 `false` 表示「我收工了」。
 * 所有回调都返回 false 时循环自动停止，不空转。
 *
 * 注意：**回调里不要读 DOM 几何**。相机引擎的整个性能前提是「帧内零
 * getBoundingClientRect」—— 几何在启动时算完，帧里只写不读。
 */
export function onFrame(cb: FrameCallback): () => void {
  callbacks.add(cb)
  schedule()

  return () => {
    callbacks.delete(cb)
    if (callbacks.size === 0 && frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
    }
  }
}

/**
 * 重新排一帧。
 *
 * 回调返回 false 后循环会停，但**回调仍留在集合里** —— 调用方需要再次出帧时
 * 调这个函数即可，不必反复注册/注销（反复注册会丢掉「谁在跑」的连续性，
 * 而且容易漏注销）。相机状态机从 IDLE 进入 PULL/TRANSIT 时就靠它唤醒。
 */
export function wake(): void {
  if (callbacks.size === 0) return
  schedule()
}

/** 是否已经有循环在跑。调试用。 */
export function isRunning(): boolean {
  return frame !== 0 || callbacks.size > 0
}

/**
 * 清空所有订阅与待执行帧。**仅用于测试**。
 *
 * 订阅表是模块级单例，测试之间共享；漏掉 detach 会让上一个测试的引擎继续
 * 响应下一个测试的 rAF，产生「单独跑通过、一起跑失败」的幽灵问题。
 * 生产代码不应调用它。
 */
export function resetForTests(): void {
  callbacks.clear()
  if (frame !== 0) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  lastTime = 0
}
