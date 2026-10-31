<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'

import snapshot from '@/data/videos.json'
import { useCamera, useCameraFrame } from '@/composables/useCamera'
import { shuffle } from '@/lib/shuffle'

/**
 * 视频区
 *
 * 用户要求（原文）：
 *   「卡片较大，从左上到右下斜着的，与水平方向倾斜角大概 30°。4 行相对较大的
 *     卡片，整体这 4 行铺满整个画面，每个卡片是一个封面和封面底部一条的逐渐
 *     增大的模糊 + 遮罩（从无到有）放标题，播放量什么的，将最新的一期高亮显示。
 *     模仿 bilibili 首页的展示内容只是把标题和播放量移到封面内部的底部渐变处来
 *     让卡片变得更贴近原封面比例 16:9，持续滚动无缝衔接」
 *   「悬浮时这一行快速减速停止」「内容最好实时从 b 站获取」
 *
 * 数据：优先请求 `/api/bilibili/videos`（开发服务器中间件签名代理），失败时
 * 用构建时快照 `src/data/videos.json`。两种来源结构相同。
 */
interface VideoItem {
  bvid: string
  title: string
  cover: string
  play: number
  created: number
  length: string
  url: string
}

const camera = useCamera()

const videos = ref<VideoItem[]>((snapshot as { videos: VideoItem[] }).videos)

// 一份内容就有约 10000px（30 张 23rem 的卡片），两份足够无缝循环，
// 第三份只会白白增加 120 个 DOM 节点。
const COPY_COUNT = 2
const BASE_SPEED = 26
const DECEL_TAU = 0.34

const grid = ref<HTMLElement | null>(null)
const rows = ref<(HTMLElement | null)[]>([])
const copyEl = ref<HTMLElement | null>(null)

const rowList = [0, 1, 2, 3]

const latestBvid = computed(() => videos.value[0]?.bvid ?? '')

const rowData = computed(() => rowList.map((r) => shuffle(videos.value, 1337 + r * 97)))

const pos = [0, 0, 0, 0]
const speed = [BASE_SPEED, BASE_SPEED, BASE_SPEED, BASE_SPEED]
const hover = [false, false, false, false]
const dirSign = [1, -1, 1, -1]
let copyWidth = 1
let raf = 0
let last = 0

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function measure(): void {
  const w = copyEl.value?.offsetWidth || 0
  if (w > 0) copyWidth = w
}

function inRange(index: number): boolean {
  return index > 2.4 && index < 4.1
}

function frame(now: number): void {
  raf = 0
  const dt = last === 0 ? 1 / 60 : Math.min(now - last, 60) / 1000
  last = now

  const index = camera.engine.displayIndex
  if (!inRange(index)) {
    last = 0
    return
  }

  // 整个网格的入场：相机靠近时从略偏右下浮上来
  const enter = smoothstep(2.45, 3.05, index)
  if (grid.value) {
    grid.value.style.opacity = (0.25 + enter * 0.75).toFixed(3)
    grid.value.style.transform = `translate(-50%, -50%) rotate(30deg) scale(${(1.02 + (1 - enter) * 0.05).toFixed(4)})`
  }

  const k = 1 - Math.exp(-dt / DECEL_TAU)
  for (let i = 0; i < 4; i++) {
    speed[i] += ((hover[i] ? 0 : BASE_SPEED) - speed[i]) * k
    pos[i] = (pos[i] + speed[i] * dt) % copyWidth
    const el = rows.value[i]
    if (el) {
      // 向左滚的行从 0 开始往负方向走；向右滚的行从 -copyWidth 走到 0，
      // 两者都在 copyWidth 处取模，于是首尾画面完全一致。
      const x = dirSign[i] > 0 ? -pos[i] : pos[i] - copyWidth
      el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`
    }
  }

  raf = requestAnimationFrame(frame)
}

function sync(index: number): void {
  if (reduced) return
  if (inRange(index) && raf === 0) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}

useCameraFrame((f) => sync(f.index))

function setRow(i: number, el: Element | null): void {
  rows.value[i] = (el as HTMLElement) ?? null
}

function setCopy(el: Element | ComponentPublicInstance | null): void {
  copyEl.value = (el as HTMLElement) ?? null
}

function setHover(i: number, on: boolean): void {
  hover[i] = on
}

async function loadLive(): Promise<void> {
  try {
    const res = await fetch('/api/bilibili/videos')
    if (!res.ok) return
    const data = (await res.json()) as { videos?: VideoItem[] }
    if (Array.isArray(data.videos) && data.videos.length > 0) videos.value = data.videos
  } catch {
    // 离线 / 代理不可用：保持快照
  }
}

onMounted(() => {
  measure()
  sync(camera.engine.displayIndex)
  void loadLive()
})

onBeforeUnmount(() => {
  if (raf !== 0) cancelAnimationFrame(raf)
  raf = 0
})

/** 播放量：万以上用「x.x 万」，与原站习惯一致 */
function playText(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`
  return String(n)
}
</script>

<template>
  <div class="video">
    <header class="head">
      <h2 class="title">视频创作者</h2>
      <p class="lead">
        持续创作 Minecraft 相关内容，包括 Minecraft 生存、挑战、一些莫名其妙诡异视频和 Celestial 相关视频
      </p>
    </header>

    <!-- 两层遮罩嵌套（alpha 自然相乘，不依赖 mask-composite）：
         ① .stage-mask  整体在视野边缘渐隐；
         ② .corner-mask 只在左上角让卡片变半透明。 -->
    <div class="stage-mask">
      <div class="corner-mask">
        <div ref="grid" class="grid">
      <div
        v-for="r in rowList"
        :key="r"
        class="row"
        @pointerenter="setHover(r, true)"
        @pointerleave="setHover(r, false)"
      >
        <div :ref="(el) => setRow(r, el as Element | null)" class="track">
          <div
            v-for="c in COPY_COUNT"
            :key="c"
            :ref="c === 1 ? setCopy : undefined"
            class="copy"
          >
            <a
              v-for="(v, i) in rowData[r]"
              :key="`${r}-${c}-${i}-${v.bvid}`"
              class="vcard"
              :class="{ latest: v.bvid === latestBvid }"
              :href="v.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                class="cover"
                :src="v.cover"
                :alt="v.title"
                loading="lazy"
                referrerpolicy="no-referrer"
                draggable="false"
              />
              <!-- 封面底部一条：从无到有的模糊 + 遮罩，标题与播放量压在里面 -->
              <div class="shade" />
              <div class="meta">
                <span class="vtitle">{{ v.title }}</span>
                <span class="stat">{{ playText(v.play) }} 播放 · {{ v.length }}</span>
              </div>
              <span v-if="v.bvid === latestBvid" class="badge">最新</span>
            </a>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 顶部文字压在斜向卡片之上 */
.head {
  position: absolute;
  left: 4.5rem;
  top: 3.4rem;
  z-index: 2;
  width: min(30rem, 80%);
  /* 整块仍然贴在左上角，只让大字与小字彼此居中对齐 */
  text-align: center;
  pointer-events: none;
}

.title {
  margin: 0;
  font-size: 3.4rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--wz-text-primary);
  text-shadow: 0 0.15rem 1rem rgb(0 0 0 / 0.7);
}

.lead {
  margin: 0.55rem 0 0;
  font-size: 1.32rem;
  line-height: 1.75;
  letter-spacing: 0.03em;
  color: var(--wz-text-tertiary);
  text-shadow: 0 0.1rem 0.8rem rgb(0 0 0 / 0.7);
}

/* 斜向网格：比视口大得多，旋转 30° 后四角仍然铺满 */
.grid {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 190%;
  height: 190%;
  transform: translate(-50%, -50%) rotate(30deg);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.35rem;
  will-change: transform, opacity;
}

/* 视野边缘渐隐：mask 必须在**屏幕对齐**的容器上。
   加在 .grid 上会跟着 30° 旋转，而且它是 190% 大小，
   渐隐区会跑到视口外，等于没做。 */
.stage-mask {
  position: absolute;
  inset: 0;
  /* ① 整体在视野边缘渐隐：半径必须落在视口内，否则透明区跑到视口外，
     视口边缘仍接近不透明，看起来就是硬切。 */
  mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 55%, transparent 100%);
}

/* ② 只在左上角让卡片变半透明（给标题让出可读区） */
.corner-mask {
  position: absolute;
  inset: 0;
  mask-image: linear-gradient(to bottom right, rgb(0 0 0 / 0.5) 0%, #000 52%);
  -webkit-mask-image: linear-gradient(to bottom right, rgb(0 0 0 / 0.5) 0%, #000 52%);
}

.row {
  overflow: hidden;
  padding: 0.35rem 0;
}

.track,
.copy {
  display: flex;
  align-items: stretch;
  gap: 1.15rem;
  width: max-content;
  will-change: transform;
}

/* --- 视频卡片 --- */
.vcard {
  position: relative;
  display: block;
  width: 23rem;
  height: 12.95rem; /* 16:9 */
  border-radius: 0.6rem;
  overflow: hidden;
  background: #101012;
  text-decoration: none;
  transition: box-shadow 240ms ease;
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.vcard:hover .cover {
  transform: scale(1.045);
}

/* 底部渐变 + 遮罩：标题区从「无」逐渐出现 */
.shade {
  position: absolute;
  inset: 42% 0 0 0;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgb(6 6 8 / 0.55) 46%,
    rgb(6 6 8 / 0.9) 100%
  );
  backdrop-filter: blur(0px);
  transition: backdrop-filter 240ms ease;
}

.meta {
  position: absolute;
  left: 0.8rem;
  right: 0.8rem;
  bottom: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.vtitle {
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--wz-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.stat {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--wz-text-tertiary);
  opacity: 0.8;
}

/* 最新一期：整张卡片一道品牌色描边 + 角标 */
.vcard.latest {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--wz-brand-soft) 55%, transparent),
    0 0 2.4rem hsl(var(--wz-brand-hue) 60% 50% / 0.25);
}

.badge {
  position: absolute;
  left: 0.7rem;
  top: 0.6rem;
  padding: 0.1rem 0.42rem;
  border-radius: 0.3rem;
  background: color-mix(in srgb, var(--wz-brand-soft) 82%, transparent);
  color: #17130f;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

@media (prefers-reduced-motion: reduce) {
  .track {
    will-change: auto;
  }
}
</style>
