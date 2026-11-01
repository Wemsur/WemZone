/** `@tauri-apps/api/webview`：拖拽事件在浏览器里不接（返回空 unlisten） */
export type UnlistenFn = () => void

export interface DragDropEvent {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths: string[]
  position: { x: number; y: number }
}

export function getCurrentWebview() {
  return {
    onDragDropEvent: async (_cb: (event: { payload: DragDropEvent }) => void): Promise<UnlistenFn> => () => {},
  }
}
