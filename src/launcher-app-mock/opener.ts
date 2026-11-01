/** `@tauri-apps/plugin-opener`：外链照常打开（新标签页） */
export async function openUrl(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function openPath(_path: string): Promise<void> {
  return undefined
}

export async function revealItemInDir(_path: string): Promise<void> {
  return undefined
}
