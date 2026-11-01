/**
 * GET /api/bilibili/videos —— 生产环境的 B 站代理（Vercel Serverless）
 *
 * 与开发服务器的中间件**逻辑同源**（`scripts/fetch-bilibili.mjs`）：WBI 签名、
 * `buvid3` cookie、浏览器指纹参数全在 Node 侧完成 —— 浏览器直连 B 站会被
 * CORS 与风控挡住。
 *
 * 失败时返回构建时快照 `src/data/videos.json`（200，不是 5xx）：对前端来说
 * 「B 站暂时取不到」和「用旧数据」没有区别，视频区永远不该因为上游挂了而空掉。
 *
 * 缓存：成功 10 分钟（`s-maxage` 让 CDN 也缓存），失败只缓 60 秒，等风控过去。
 */

import { fetchVideos } from '../../scripts/fetch-bilibili.mjs'
import snapshot from '../../src/data/videos.json'

/** 只用到这两个方法，不为了类型装 @vercel/node */
interface NodeLikeRes {
  status(code: number): NodeLikeRes
  setHeader(name: string, value: string): void
  send(body: string): void
}

export default async function handler(_req: unknown, res: NodeLikeRes): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  try {
    const data = await fetchVideos('1826712095', 1)
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400')
    res.status(200).send(JSON.stringify(data))
  } catch {
    // 风控 / 网络 / 接口变更：退回快照，前端不需要区分
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.status(200).send(JSON.stringify(snapshot))
  }
}
