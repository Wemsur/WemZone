/**
 * `@tauri-apps/api/window` 的最小替身
 *
 * 启动器只用到「最大化 / 全屏 / 关闭 / 拖动 / 装饰」这几个调用。浏览器里
 * 没有真的窗口，全部做成**幂等空操作**：返回值固定（未最大化、未全屏），
 * 事件订阅返回空 `unlisten`。界面因此不会报错，按钮点了也只是没反应 ——
 * 这正是「除滚动/切 tab/主题色/背景之外一律拦掉」的交互边界。
 */
export type UnlistenFn = () => void

const noop = (): Promise<void> => Promise.resolve()
const unlisten = async (): Promise<UnlistenFn> => () => {}

export function getCurrentWindow() {
  return {
    isMaximized: async () => false,
    isFullscreen: async () => false,
    isFocused: async () => true,
    isDecorated: async () => true,
    minimize: noop,
    maximize: noop,
    unmaximize: noop,
    toggleMaximize: noop,
    close: noop,
    destroy: noop,
    hide: noop,
    show: noop,
    setFocus: noop,
    setTitle: noop,
    setDecorations: noop,
    setFullscreen: noop,
    startDragging: noop,
    onResized: unlisten,
    onMoved: unlisten,
    onCloseRequested: unlisten,
    onFocusChanged: unlisten,
    onScaleChanged: unlisten,
    onThemeChanged: unlisten,
  }
}

export type Window = ReturnType<typeof getCurrentWindow>
