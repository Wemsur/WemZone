/**
 * `@tauri-apps/plugin-fs`
 *
 * 静态站没有本地文件系统。读操作统一 reject（调用方本来就处理「文件不存在」），
 * 写操作静默成功 —— 这样文件管理页会显示空目录，而不是卡住或白屏。
 */
export interface DirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export async function readDir(_path: string): Promise<DirEntry[]> {
  return []
}

export async function readTextFile(_path: string): Promise<string> {
  throw new Error('mock: no filesystem')
}

export async function readFile(_path: string): Promise<Uint8Array> {
  throw new Error('mock: no filesystem')
}

export async function writeTextFile(_path: string, _contents: string): Promise<void> {
  return undefined
}

export async function writeFile(_path: string, _contents: Uint8Array): Promise<void> {
  return undefined
}

export async function mkdir(_path: string, _options?: unknown): Promise<void> {
  return undefined
}

export async function remove(_path: string, _options?: unknown): Promise<void> {
  return undefined
}

export async function rename(_oldPath: string, _newPath: string): Promise<void> {
  return undefined
}

export async function stat(_path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }> {
  return { isFile: false, isDirectory: true, size: 0 }
}

export async function exists(_path: string): Promise<boolean> {
  return false
}
