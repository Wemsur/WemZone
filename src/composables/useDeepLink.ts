/**
 * 深链接：URL hash ↔ 当前区块
 *
 * 因为整站接管了滚动，浏览器前进/后退、直接打开某个区块的链接都得自己实现。
 *
 *  - 切换区块时 `pushState` 写 hash（用 `replaceState` 表示「不是用户导航」）。
 *  - 监听 `popstate`（前进/后退）与 `hashchange`（手改地址栏）→ 动画定位。
 *  - 首次挂载时读一次 hash，若有就无动画地落过去（避免刷新后跳回首页）。
 *
 * hash 用 `#<section.id>`（见 sections.ts），而不是索引 —— 索引会因为
 * 增删区块而错位，id 不会。
 */

import { onBeforeUnmount, onMounted, watch } from 'vue'

import type { CameraApi } from '@/composables/useCamera'
import { ACTIVE_SECTIONS } from '@/sections'

function indexFromHash(hash: string): number | null {
  const id = hash.replace(/^#/, '')
  if (!id) return null
  const i = ACTIVE_SECTIONS.findIndex((s) => s.id === id)
  return i >= 0 ? i : null
}

export function useDeepLink(camera: CameraApi): void {
  /** 标记「这次变化是我们自己写 hash 引起的」，避免回环 */
  let selfWriting = false

  function writeHash(index: number, replace: boolean): void {
    const id = ACTIVE_SECTIONS[index]?.id
    if (!id || window.location.hash === `#${id}`) return
    selfWriting = true
    const url = `#${id}`
    if (replace) {
      history.replaceState({ index }, '', url)
    } else {
      history.pushState({ index }, '', url)
    }
    // selfWriting 在下一帧清掉：popstate/hashchange 不会同步派发，
    // 但同一任务里我们不该再处理一次自己写的事件。
    queueMicrotask(() => {
      selfWriting = false
    })
  }

  /** 外部（前进/后退、手改地址栏）要求的跳转 */
  function syncFromUrl(): void {
    if (selfWriting) return
    const i = indexFromHash(window.location.hash)
    if (i === null) return
    if (i !== camera.current.value) camera.goTo(i)
  }

  // 区块落位 → 写 hash。replace=true 时表示首次落位（不污染历史）
  watch(
    () => camera.current.value,
    (index, prev) => {
      // prev 为 undefined 是首次（由 goTo immediate 触发），用 replace
      writeHash(index, prev === undefined)
    },
    { immediate: false },
  )

  onMounted(() => {
    // 先读一次 hash：有就无动画落过去，没有就把首页写进地址栏
    const i = indexFromHash(window.location.hash)
    if (i !== null) {
      camera.goTo(i, { immediate: true })
    } else {
      const id = ACTIVE_SECTIONS[0]?.id
      if (id) history.replaceState({ index: 0 }, '', `#${id}`)
    }

    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', syncFromUrl)
    window.removeEventListener('hashchange', syncFromUrl)
  })
}
