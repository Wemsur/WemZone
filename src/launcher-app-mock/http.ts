/** `@tauri-apps/plugin-http`：用浏览器 fetch 顶上（CORS 由目标站决定） */
export async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return window.fetch(input, init)
}
