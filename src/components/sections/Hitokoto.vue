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

const fetched: Quote[] = []
let fetching = false

async function fetchOne(): Promise<void> {
  if (fetching) return
  fetching = true
  try {
    const ctrl = new AbortController()
    const timeout = window.setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('https://v1.hitokoto.cn/?encode=json&max_length=42', {
      signal: ctrl.signal,
    })
    window.clearTimeout(timeout)
    if (!res.ok) return
    const data = (await res.json()) as { hitokoto?: string; from_who?: string; from?: string }
    if (typeof data.hitokoto === 'string' && data.hitokoto.length > 0) {
      fetched.push({ text: data.hitokoto, from: data.from_who || data.from || '一言' })
    }
  } catch {
    // 离线 / 超时 / CORS：保持兜底
  } finally {
    fetching = false
  }
}

let fallbackIndex = Math.floor(Math.random() * FALLBACK.length)

/** 取下一句：优先用已取到的，没有就用兜底并顺手再请求一次 */
function nextQuote(): Quote {
  if (fetched.length > 0) {
    const q = fetched.shift() as Quote
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

onMounted(startTyping)

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
  font-size: 0.98rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: var(--wz-text-default);
  text-wrap: balance;
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
  font-size: 0.8rem;
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
