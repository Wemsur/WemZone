<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 一言
 *
 * 用户要求：刚进入站点时先用打字机打出「你好，欢迎来到此地」，然后打字机
 * 消失；之后进入一言，每 10s 渐隐渐显切换。
 *
 * 数据来自 hitokoto.cn（与 `celestial-hitokoto` 插件同一个接口）。
 * 网络失败时静默退到本地兜底句 —— 一言是装饰，不该因为接口挂了留一片空白。
 */

interface Quote {
  text: string
  from: string
}

const GREETING = '你好，欢迎来到此地'

/** 接口不可达时的兜底。挑的都是与站点气质相符的短句。 */
const FALLBACK: Quote[] = [
  { text: '庭有枇杷树，吾妻死之年所手植也。', from: '归有光' },
  { text: '山中何事？松花酿酒，春水煎茶。', from: '张可久' },
  { text: '我们都在阴沟里，但仍有人仰望星空。', from: '王尔德' },
  { text: '醉后不知天在水，满船清梦压星河。', from: '唐珙' },
  { text: '凡是过往，皆为序章。', from: '莎士比亚' },
]

const typed = ref('')
const quote = ref<Quote | null>(null)
/** 控制透明度：打字结束后淡出，换句时也用它做渐隐渐显 */
const visible = ref(true)
const phase = ref<'typing' | 'quote'>('typing')

const timers: number[] = []
const intervals: number[] = []

function later(fn: () => void, ms: number): void {
  timers.push(window.setTimeout(fn, ms))
}

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------------- 一言数据 ---------------- */

/**
 * 本地缓存
 *
 * 一言是装饰，但它也是最脆的一环（第三方接口、跨域、风控）。把取到过的句子
 * 存进 localStorage：下次打开站点**立刻**就有内容可轮换，网络请求只是补充。
 * 缓存满了就丢最旧的（先进先出），最多 `CACHE_MAX` 条。
 */
const CACHE_KEY = 'wemzone.hitokoto.v1'
const CACHE_MAX = 40

const fetched: Quote[] = []
let fetching = false

function loadCache(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const list = JSON.parse(raw) as Quote[]
    if (Array.isArray(list)) {
      for (const q of list) {
        if (q && typeof q.text === 'string' && q.text.length > 0) fetched.push(q)
      }
    }
  } catch {
    // 损坏 / 隐私模式：忽略即可，兜底句还在
  }
}

function saveCache(): void {
  try {
    // 只保留最近 CACHE_MAX 条（fetched 是 FIFO 队列）
    localStorage.setItem(CACHE_KEY, JSON.stringify(fetched.slice(-CACHE_MAX)))
  } catch {
    // 配额满 / 隐私模式：缓存是可选优化，失败不影响显示
  }
}

/**
 * 取句子的接口。
 *
 * 官方有两个入口（主站与 international），**随机挑一个**，再随机挑一个分类
 * （文学 / 诗词 / 哲学 / 原创）—— 站点气质偏静，不要「抖机灵」那类。
 * 不接第三方镜像：它们随时会挂，而一言挂掉时我们已经有缓存与兜底。
 */
const SOURCES = ['https://v1.hitokoto.cn/', 'https://international.v1.hitokoto.cn/']
const CATEGORIES = ['d', 'i', 'k', 'e']

function pickUrl(): string {
  const base = SOURCES[Math.floor(Math.random() * SOURCES.length)]
  const c = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
  return `${base}?encode=json&max_length=42&c=${c}`
}

async function fetchOne(): Promise<void> {
  if (fetching) return
  fetching = true
  try {
    const ctrl = new AbortController()
    const timeout = window.setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(pickUrl(), { signal: ctrl.signal })
    window.clearTimeout(timeout)
    if (!res.ok) return
    const data = (await res.json()) as { hitokoto?: string; from_who?: string; from?: string }
    if (typeof data.hitokoto === 'string' && data.hitokoto.length > 0) {
      const q = { text: data.hitokoto, from: data.from_who || data.from || '一言' }
      if (!fetched.some((x) => x.text === q.text)) {
        fetched.push(q)
        saveCache()
      }
    }
  } catch {
    // 离线 / 超时 / CORS：保持缓存与兜底
  } finally {
    fetching = false
  }
}

let fallbackIndex = Math.floor(Math.random() * FALLBACK.length)

/** 取下一句：优先用缓存/已取到的，没有就用兜底并顺手再请求一次 */
function nextQuote(): Quote {
  if (fetched.length > 0) {
    // 轮换而不是消费：取出来的放回队尾，缓存不会越用越少
    const q = fetched.shift() as Quote
    fetched.push(q)
    saveCache()
    void fetchOne() // 保持缓冲区不空
    return q
  }
  void fetchOne()
  const q = FALLBACK[fallbackIndex % FALLBACK.length]
  fallbackIndex++
  return q
}

/* ---------------- 时间线 ---------------- */

function startTyping(): void {
  if (reduced) {
    typed.value = GREETING
    later(() => {
      visible.value = false
    }, 900)
    later(startQuotes, 1500)
    return
  }

  let i = 0
  const step = (): void => {
    i++
    typed.value = GREETING.slice(0, i)
    if (i < GREETING.length) {
      later(step, 105)
    } else {
      // 打完停留一会儿，再淡出
      later(() => {
        visible.value = false
      }, 1400)
      later(startQuotes, 2100)
    }
  }
  later(step, 450)
}

function startQuotes(): void {
  phase.value = 'quote'
  // 前几句预先取好，避免第一次切换时空白
  void fetchOne()
  void fetchOne()

  later(() => {
    quote.value = nextQuote()
    visible.value = true
  }, 120)

  // 每 10s：先渐隐 → 换句 → 渐显
  intervals.push(
    window.setInterval(() => {
      if (reduced) {
        quote.value = nextQuote()
        return
      }
      visible.value = false
      later(() => {
        quote.value = nextQuote()
        visible.value = true
      }, 700)
    }, 10_000),
  )
}

onMounted(() => {
  loadCache()
  startTyping()
})

onBeforeUnmount(() => {
  for (const t of timers) window.clearTimeout(t)
  for (const i of intervals) window.clearInterval(i)
  timers.length = 0
  intervals.length = 0
})
</script>

<template>
  <div class="hitokoto" :class="{ 'is-hidden': !visible }">
    <p v-if="phase === 'typing'" class="line typing">
      {{ typed }}<span class="caret" aria-hidden="true" />
    </p>
    <template v-else>
      <p class="line">{{ quote?.text ?? '' }}</p>
      <p v-if="quote?.from" class="from">—— {{ quote.from }}</p>
    </template>
  </div>
</template>

<style scoped>
.hitokoto {
  position: absolute;
  left: 50%;
  bottom: 2.6rem;
  transform: translateX(-50%);
  width: min(46rem, 86%);
  text-align: center;
  /* 渐隐渐显：换句与开场结束都用这一条 */
  opacity: 1;
  transition: opacity 600ms ease;
}

.hitokoto.is-hidden {
  opacity: 0;
}

.line {
  margin: 0;
  font-size: 1.14rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: var(--wz-text-default);
  text-wrap: balance;
  text-shadow: 0 0.1rem 0.7rem rgb(0 0 0 / 0.65);
}

.typing {
  color: var(--wz-text-tertiary);
}

/* 打字机光标：一条细竖线，呼吸式闪 */
.caret {
  display: inline-block;
  width: 1px;
  height: 1em;
  margin-left: 0.12em;
  vertical-align: -0.12em;
  background: var(--wz-brand-soft);
  animation: caret-blink 1s steps(1, end) infinite;
}

@keyframes caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

.from {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: var(--wz-text-tertiary);
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .hitokoto {
    transition: none;
  }
  .caret {
    animation: none;
  }
}
</style>
