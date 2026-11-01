/**
 * `@tauri-apps/plugin-dialog`
 *
 * 文件选择在静态站里没有意义（没有本地文件系统）—— 一律返回 `null`，
 * 调用方会当作「用户取消」。
 */
export async function open(_options?: unknown): Promise<string | string[] | null> {
  return null
}

export async function save(_options?: unknown): Promise<string | null> {
  return null
}

export async function message(_message: string, _options?: unknown): Promise<void> {
  return undefined
}

export async function ask(_message: string, _options?: unknown): Promise<boolean> {
  return false
}

export async function confirm(_message: string, _options?: unknown): Promise<boolean> {
  return false
}
