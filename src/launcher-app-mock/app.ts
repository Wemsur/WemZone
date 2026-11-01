/** `@tauri-apps/api/app`：版本号写死成启动器当前的版本 */
export async function getVersion(): Promise<string> {
  return '3.4.0'
}

export async function getTauriVersion(): Promise<string> {
  return '2.0.0'
}

export async function getIdentifier(): Promise<string> {
  return 'org.modrinth.app'
}
