<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import Wordmark from '@/assets/wemzone-wordmark.svg?component'
import { useCamera, useCameraFrame } from '@/composables/useCamera'
import {
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  scrollSensitivity,
} from '@/lib/preferences'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 统一卡片
 *
 * 用户要求（原文）：
 *   「统一卡片需要跟随摄像机运动，曲线运动到下一个内容区域的对应位置，
 *     而不是每个内容区域写一个，其具有对于别的地方相对较弱的动态模糊」
 *   「始终存在的几个内容：庭域WemZone 文字，下面 github 与 bilibili 的图标，
 *     以及整个卡片左侧/右侧（如果卡片在左侧就显示在卡片右侧）的那种类似于
 *     Celestial 侧边的标识当前进度，每个内容区域一个的横条，高亮与加长当前
 *     所在的，唯一的区别是不只是高亮条的一部分而是高亮一整根条」
 *
 * 所以站里只有**一张**卡：位置由相机连续索引插值，沿着一条带横向弧度的
 * 路径在各个区块的锚点之间移动。首页用顶部栏、联系区没有卡片。
 *
 * 卡片是 screen-space 的（不随 3D 世界倾斜），但有**比内容弱得多**的
 * 运动模糊 —— 它是「跟着镜头走的界面」，不是场景里的物体。
 */

const camera = useCamera()

const card = ref<HTMLElement | null>(null)

/** 卡片尺寸：定位时要用，缓存下来避免每帧读布局 */
const size = { w: 176, h: 120 }
let resizeObserver: ResizeObserver | null = null

function measure(): void {
  const el = card.value
  if (!el) return
  size.w = el.offsetWidth || size.w
  size.h = el.offsetHeight || size.h
}

/**
 * 每个索引对应一个锚点（视口比例）。
 * 首页没有卡片，但锚点仍取「启动器右上」，这样淡入发生在正确的位置；
 * 联系区同理取视频的右下，淡出也在那里结束。
 */
const ANCHORS = [
  { x: 1, y: 0 }, // home：淡入用，位置=启动器
  { x: 1, y: 0 }, // launcher：右上
  { x: 1, y: 0 }, // works：右上
  { x: 1, y: 1 }, // video：右下
  { x: 1, y: 1 }, // contact：淡出用
]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 卡片在索引处的可见度：0 首页淡入 → 1 中间三区 → 0 联系淡出 */
function visibility(index: number): number {
  return smoothstep(0.18, 0.72, index) * (1 - smoothstep(3.3, 3.86, index))
}

/** 卡片位置（视口 px，左上角） */
function positionAt(index: number): { x: number; y: number } {
  const W = window.innerWidth
  const H = window.innerHeight
  const s = clamp(index, 0, ANCHORS.length - 1)
  const i = Math.min(Math.floor(s), ANCHORS.length - 2)
  const t = s - i
  const a = ANCHORS[i]
  const b = ANCHORS[i + 1]

  const marginRight = W * 0.024
  const marginTop = H * 0.055
  const marginBottom = H * 0.05

  const ax = W - marginRight - size.w
  const ay = a.y === 0 ? marginTop : H - marginBottom - size.h
  const bx = W - marginRight - size.w
  const by = b.y === 0 ? marginTop : H - marginBottom - size.h

  // 曲线：从右上到右下不是直线下落，而是向画面内侧鼓一点
  const bulge = Math.sin(Math.PI * t) * W * 0.035

  return {
    x: ax + (bx - ax) * t - bulge,
    y: ay + (by - ay) * t,
  }
}

useCameraFrame((frame) => {
  const el = card.value
  if (!el) return

  const op = visibility(frame.index)
  const p = positionAt(frame.index)

  el.style.opacity = op.toFixed(3)
  el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
  el.style.pointerEvents = op > 0.55 ? 'auto' : 'none'

  // 相对较弱的动态模糊：内容层最多 6px，这里封顶 2px
  const blur = clamp(Math.abs(frame.velocity) * 0.9, 0, 2)
  el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : ''

  // 卡片跑到下半屏时，灵敏度面板翻到卡片**上方** —— 否则会顶出视口底边
  el.classList.toggle('flip', p.y > window.innerHeight * 0.5)
})

const sensitivityLabel = computed(() => String(Math.round(scrollSensitivity.value * 100) / 100))

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measure)
    if (card.value) resizeObserver.observe(card.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <aside ref="card" class="card" aria-label="站点导航">
    <!-- 进度条：卡片在画面右侧，所以条在卡的左侧 -->
    <div class="bars" role="tablist" aria-label="当前区块">
      <button
        v-for="(section, i) in ACTIVE_SECTIONS"
        :key="section.id"
        class="bar"
        :class="{ current: camera.current.value === i }"
        type="button"
        role="tab"
        :aria-selected="camera.current.value === i"
        :aria-label="section.label"
        @click="camera.goTo(i)"
      />
    </div>

    <div class="body">
      <div class="brand">
        <span class="name">庭域</span>
        <Wordmark class="wordmark" aria-label="WemZone" role="img" />
      </div>

      <div class="links">
        <a
          class="icon"
          href="https://github.com/Wemsur"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
        </a>

        <a
          class="icon"
          href="https://space.bilibili.com/1826712095"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="哔哩哔哩"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6.4 3.2 9 5.6h6L17.6 3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <rect
              x="2.6"
              y="5.6"
              width="18.8"
              height="13.6"
              rx="4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M8.4 10.4v3.4M15.6 10.4v3.4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </a>
      </div>
    </div>

    <!-- 滑动灵敏度：悬停整张卡片时从卡片下方（下半屏时从上方）滑出。
         这是给访客的手感设置，不是开发调试项 —— 不同设备的滚动粒度差一个
         数量级，同一套阈值不可能对所有人都合适。 -->
    <div class="sensitivity">
      <div class="sens-panel" @wheel.stop>
        <label class="sens-head" for="wz-sensitivity">
          <span class="sens-title">滑动灵敏度</span>
          <span class="sens-value">{{ sensitivityLabel }}×</span>
        </label>
        <input
          id="wz-sensitivity"
          v-model.number="scrollSensitivity"
          class="sens-range"
          type="range"
          :min="SENSITIVITY_MIN"
          :max="SENSITIVITY_MAX"
          step="0.05"
          aria-label="滑动灵敏度"
        />
        <p class="sens-hint">滑得很费力就调大，一碰就翻页就调小</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.card {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.85rem;
  /* 低透明度玻璃底：它是浮在场景上的界面，不该像一块实心卡片 */
  background: color-mix(in srgb, #101010 42%, transparent);
  backdrop-filter: blur(0.9rem) saturate(1.1);
  box-shadow: 0 0.6rem 2rem rgb(0 0 0 / 0.28);
  opacity: 0;
  pointer-events: none;
  will-change: transform, opacity, filter;
}

/* --- 进度条 --- */
.bars {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.32rem;
  padding-right: 0.55rem;
  border-right: 1px solid rgb(255 255 255 / 0.08);
}

.bar {
  width: 1.15rem;
  height: 2px;
  padding: 0;
  border: 0;
  border-radius: 1px;
  background: rgb(255 255 255 / 0.22);
  cursor: pointer;
  /* 不是「高亮一段」，而是整根条变长变亮 */
  transition:
    width 320ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 260ms ease,
    opacity 260ms ease;
}

.bar:hover {
  background: rgb(255 255 255 / 0.45);
}

.bar.current {
  width: 1.85rem;
  background: var(--wz-brand-soft);
  opacity: 1;
}

/* --- 正文 --- */
.body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.6rem;
  min-width: 6.4rem;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--wz-text-primary);
}

.name {
  font-family: 'XuanZong', serif;
  font-size: 1.15rem;
  line-height: 1;
  letter-spacing: 0.04em;
}

.wordmark {
  height: 0.66rem;
  width: auto;
  color: var(--wz-brand-soft);
  transform: translateY(0.03rem);
}

.links {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.icon {
  display: grid;
  place-items: center;
  color: var(--wz-text-tertiary);
  transition: color 160ms ease;
}

.icon:hover {
  color: var(--wz-text-primary);
}

.icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

/* --- 滑动灵敏度 ---
   悬停整张卡片时滑出。面板是卡片的绝对定位子元素，所以跟着卡片一起移动；
   `top: 100%` + padding 而不是 margin，是为了让「卡片 → 面板」之间的空隙
   也算在悬停区域内 —— 否则鼠标穿过空隙时面板会立刻收起，够不着滑块。 */
.sensitivity {
  position: absolute;
  right: 0;
  top: 100%;
  width: 13.5rem;
  padding-top: 0.45rem;
  opacity: 0;
  transform: translateY(-0.3rem);
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 卡片在下半屏时面板翻到上方，避免顶出视口底边 */
.card.flip .sensitivity {
  top: auto;
  bottom: 100%;
  padding-top: 0;
  padding-bottom: 0.45rem;
  transform: translateY(0.3rem);
}

.card:hover .sensitivity,
.card:focus-within .sensitivity {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.sens-panel {
  padding: 0.6rem 0.7rem 0.55rem;
  border: 1px solid rgb(255 255 255 / 0.07);
  border-radius: 0.7rem;
  background: color-mix(in srgb, #101010 55%, transparent);
  backdrop-filter: blur(0.9rem) saturate(1.1);
  box-shadow: 0 0.6rem 2rem rgb(0 0 0 / 0.32);
}

.sens-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.sens-title {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--wz-text-tertiary);
}

.sens-value {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--wz-brand-soft);
}

.sens-range {
  appearance: none;
  -webkit-appearance: none;
  display: block;
  width: 100%;
  height: 0.95rem;
  margin: 0.1rem 0 0;
  background: transparent;
  cursor: pointer;
}

.sens-range::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: rgb(255 255 255 / 0.18);
}

.sens-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 0.62rem;
  height: 0.62rem;
  margin-top: -0.26rem;
  border: 0;
  border-radius: 50%;
  background: var(--wz-brand-soft);
  box-shadow: 0 0 0 0.18rem hsl(var(--wz-brand-hue) 72% 75% / 0.18);
  transition: box-shadow 160ms ease;
}

.sens-range::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 0.3rem hsl(var(--wz-brand-hue) 72% 75% / 0.26);
}

.sens-range::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: rgb(255 255 255 / 0.18);
}

.sens-range::-moz-range-thumb {
  width: 0.62rem;
  height: 0.62rem;
  border: 0;
  border-radius: 50%;
  background: var(--wz-brand-soft);
}

.sens-range:focus-visible {
  outline: 1px solid var(--wz-brand-soft);
  outline-offset: 0.2rem;
  border-radius: 0.3rem;
}

.sens-hint {
  margin: 0.3rem 0 0;
  font-size: 0.62rem;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: var(--wz-text-tertiary);
  opacity: 0.72;
}
</style>
