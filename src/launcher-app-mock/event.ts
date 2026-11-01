/**
 * `@tauri-apps/api/event` 的替代实现
 *
 * mock 环境里没有 Rust 侧的事件源，`listen` 注册后永远不触发、返回一个
 * 空 `unlisten`。启动器用它接「编辑菜单」「加载进度」这类系统事件，
 * 静态站里没有这些事件是符合预期的。
 */
export type UnlistenFn = () => void

export interface Event<T> {
  event: string
  id: number
  payload: T
}

export async function listen<T>(
  _event: string,
  _handler: (event: Event<T>) => void,
): Promise<UnlistenFn> {
  return () => {}
}

export async function once<T>(
  _event: string,
  _handler: (event: Event<T>) => void,
): Promise<UnlistenFn> {
  return () => {}
}

export async function emit(_event: string, _payload?: unknown): Promise<void> {
  return undefined
}

export const TauriEvent = {
  WINDOW_RESIZED: 'tauri://resize',
  WINDOW_MOVED: 'tauri://move',
  WINDOW_CLOSE_REQUESTED: 'tauri://close-requested',
  WINDOW_DESTROYED: 'tauri://destroyed',
  WINDOW_FOCUS: 'tauri://focus',
  WINDOW_BLUR: 'tauri://blur',
  WINDOW_SCALE_FACTOR_CHANGED: 'tauri://scale-change',
  WINDOW_THEME_CHANGED: 'tauri://theme-changed',
  WINDOW_CREATED: 'tauri://window-created',
  WINDOW_DRAG_DROP_EVENT: 'tauri://drag-drop',
} as const
