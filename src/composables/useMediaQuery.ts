/**
 * 响应式媒体查询
 *
 * 比 `lib/viewport.ts` 里的 `narrow` 更通用 —— 那个是「宽/窄版式」的专用单例，
 * 这个是给任意媒体查询用的（目前是 prefers-reduced-motion）。
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'

export function useMediaQuery(query: string): Ref<boolean> {
  const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null
  const matches = ref(mql?.matches ?? false)

  if (!mql) return matches

  const onChange = (e: MediaQueryListEvent): void => {
    matches.value = e.matches
  }
  mql.addEventListener('change', onChange)
  onBeforeUnmount(() => mql.removeEventListener('change', onChange))

  return matches
}
