/**
 * `@tauri-apps/api/core` 的替代实现
 *
 * 启动器前端（`src/launcher-app`）是原样复制过来的，它所有数据都来自
 * `invoke()`。这里把命令路由到硬编码的样例数据（见 `handlers.ts`），
 * 于是同一套页面代码在浏览器里跑起来，**界面与真启动器一模一样**，
 * 只是数据是假的。
 *
 * 未实现的命令**不抛错**，按命令名猜一个空值返回。启动器启动时会打一批
 * 与界面无关的命令（广告、更新、遥测），抛错会让整页挂掉；给空值是更接近
 * 「功能关掉」的表现。
 */

import { handle } from './handlers'

export type ChannelCallback<T> = (message: T) => void

/** Tauri v2 的 Channel：构造时接回调，`onmessage` 也可以后设。 */
export class Channel<T> {
  onmessage: ChannelCallback<T> | null

  constructor(onmessage?: ChannelCallback<T>) {
    this.onmessage = onmessage ?? null
  }

  /** 真实现里由 IPC 调用；mock 用不到，保留以对齐接口 */
  toJSON(): string {
    return '{"__channel__":"mock"}'
  }
}

/** 本地路径在 Tauri 里要转成 asset:// 才能给 <img>；浏览器里原样返回 */
export function convertFileSrc(path: string): string {
  return path
}

export function isTauri(): boolean {
  return true
}

/** 形如 `plugin:instance|instance_list` 的命令，全部交给 handlers 表 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return handle<T>(cmd, args ?? {})
}
