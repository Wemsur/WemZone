/** `@tauri-apps/plugin-os`：静态站按当前浏览器环境回答 */
export function type(): string {
  return 'windows'
}

export function platform(): string {
  return 'windows'
}

export function version(): string {
  return '10.0.0'
}

export function arch(): string {
  return 'x86_64'
}

export function family(): string {
  return 'windows'
}

export function locale(): string | null {
  return navigator.language ?? null
}

export async function hostname(): Promise<string> {
  return 'wemsur.top'
}
