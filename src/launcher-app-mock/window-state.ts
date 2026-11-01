/** `@tauri-apps/plugin-window-state`：窗口大小状态在浏览器里没有意义 */
export const StateFlags = {
  SIZE: 1,
  POSITION: 2,
  MAXIMIZED: 4,
  VISIBLE: 8,
  DECORATIONS: 16,
  FULLSCREEN: 32,
} as const

export async function saveWindowState(_flags?: number): Promise<void> {
  return undefined
}

export async function restoreStateCurrent(_flags?: number): Promise<void> {
  return undefined
}
