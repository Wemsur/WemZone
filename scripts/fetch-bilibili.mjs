/**
 * B 站投稿抓取（WBI 签名）
 *
 * B 站的 `x/space/wbi/arc/search` 需要 WBI 签名：先从 nav 接口取两个密钥，
 * 按固定置换表拼出 mixin key，再对排序后的参数做 md5。整个过程必须在
 * 服务端完成（浏览器直连会被 CORS 与风控挡住）。
 *
 * 用法：
 *   node scripts/fetch-bilibili.mjs [mid] [输出文件]
 *
 * 默认输出 `src/data/videos.json`。前端优先请求 `/api/bilibili/videos`
 * （开发服务器中间件 / 生产环境的 Serverless 函数），失败时退回这份快照 ——
 * 于是「B 站挂了」不会让视频区空掉。
 */

import crypto from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/**
 * 浏览器指纹参数。
 *
 * B 站的风控会看这几个 `dm_*` 参数：不带就返回 -352「风控校验失败」，
 * 或者 412。它们本身不参与业务，只是「像不像浏览器」的证据。
 * 值取自一次真实请求，长度与格式必须像真的 —— 随便编会更容易被拦。
 */
const DM_PARAMS = {
  dm_img_list: '[]',
  dm_img_str: 'V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ',
  dm_cover_img_str:
    'QU5HTEUgKEludGVsLCBJbnRlbChSKSBVSEQgR3JhcGhpY3MgNjMwICgweDAwMDAzRTlCKSBEaXJlY3QzRDExIHZzXzVfMCBwc181XzAsIEQzRDExKUdvb2dsZSBJbmMuIChJbnRlbC',
  dm_img_inter: '{"ds":[],"wh":[0,0,0],"of":[0,0,0]}',
}

/** 所有请求共用的浏览器式请求头 */
function headers(cookie, referer) {
  return {
    'User-Agent': UA,
    Referer: referer,
    Origin: 'https://space.bilibili.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    Cookie: cookie,
  }
}

const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex')
}

/**
 * B 站接口会看 `buvid3` 等 cookie；不带就直接返回风控 HTML。
 * 先访问一次首页，把 Set-Cookie 拼成请求头。
 */
async function getCookies() {
  const res = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA } })
  const list = res.headers.getSetCookie?.() ?? []
  return list.map((c) => c.split(';')[0]).join('; ')
}

async function getMixinKey(cookie) {
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: headers(cookie, 'https://www.bilibili.com/'),
  })
  const json = await res.json()
  const img = json?.data?.wbi_img?.img_url ?? ''
  const sub = json?.data?.wbi_img?.sub_url ?? ''
  const pick = (u) => u.split('/').pop().split('.')[0]
  const raw = pick(img) + pick(sub)
  if (raw.length < 64) throw new Error('拿不到 WBI 密钥')
  return MIXIN_TAB.map((i) => raw[i]).join('').slice(0, 32)
}

function sign(params, mixin) {
  const all = { ...params, wts: Math.floor(Date.now() / 1000) }
  const query = Object.keys(all)
    .sort()
    .map((k) => {
      const v = String(all[k]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    })
    .join('&')
  return `${query}&w_rid=${md5(query + mixin)}`
}

/** B 站封面是 http，且支持 `@` 缩放参数；这里统一升到 https 并要一张卡片尺寸 */
function cover(url) {
  if (!url) return ''
  const secure = url.replace(/^http:\/\//, 'https://')
  return `${secure}@672w_378h_1c.webp`
}

/**
 * 抓取某个 UP 主的投稿。
 * @param {string} mid
 * @param {number} pages 抓几页（每页 30）
 */
export async function fetchVideos(mid, pages = 1) {
  const cookie = await getCookies()
  const mixin = await getMixinKey(cookie)
  const out = []
  for (let pn = 1; pn <= pages; pn++) {
    const q = sign({ mid, ps: 30, pn, order: 'pubdate', ...DM_PARAMS }, mixin)
    const res = await fetch(`https://api.bilibili.com/x/space/wbi/arc/search?${q}`, {
      headers: headers(cookie, `https://space.bilibili.com/${mid}`),
    })
    const json = await res.json()
    if (json?.code !== 0) throw new Error(`B 站接口错误：${json?.code} ${json?.message ?? ''}`)
    const list = json?.data?.list?.vlist ?? []
    for (const v of list) {
      out.push({
        bvid: v.bvid,
        title: v.title,
        cover: cover(v.pic),
        play: v.play,
        created: v.created,
        length: v.length,
        url: `https://www.bilibili.com/video/${v.bvid}`,
      })
    }
    if (list.length < 30) break
  }
  return {
    mid,
    fetchedAt: new Date().toISOString(),
    videos: out,
  }
}

// 直接运行时写快照（被 vite.config 导入时不执行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mid = process.argv[2] || '1826712095'
  const outFile = process.argv[3] || 'src/data/videos.json'
  const data = await fetchVideos(mid, 1)
  await writeFile(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`wrote ${outFile}: ${data.videos.length} videos`)
}
