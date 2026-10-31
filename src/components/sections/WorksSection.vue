<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'

import { useCamera, useCameraFrame } from '@/composables/useCamera'
import { PROJECTS } from '@/data/projects'
import { shuffle } from '@/lib/shuffle'

/**
 * 其它作品 —— 弹幕式项目列表
 *
 * 用户要求（原文）：
 *   「每个项目为一个较大的卡片，总共两行卡片，顶部为文字部分，下面两行
 *     持续向不同方向滚动，两侧无缝接入新的内容保持滚动的连续性」
 *   「刚进入该界面时，两行卡片从可视范围的两侧快速滑入并开始持续滚动，
 *     滑入方向与后面的滚动方向应该一致」
 *   「鼠标悬浮在某一个卡片上时将其所在这一行的滚动逐渐快速停止，不是一下
 *     子停下而是快速的减速停止。其他行无影响」
 *   「进入下一个内容页面时应该将这两行卡片快速滚动移出视野」
 *
 * 实现要点：
 *  - 每行放 **3 份**同样的卡片，位置按「一份的宽度」取模，于是首尾无缝相接。
 *  - 滚动用自有的 rAF 循环（相机引擎在静止时会停帧，不能靠它驱动）。
 *    只在索引接近本区时运行，离开后停掉。
 *  - 悬停不暂停，而是把目标速度设为 0，速度按指数逼近 —— 这就是「快速减速
 *    停止」而不是「一下停住」。
 *  - 进出场偏移由相机连续索引驱动：入场从两侧滑入，方向与后续滚动一致。
 */

const camera = useCamera()

const COPY_COUNT = 3
const BASE_SPEED = 34 // px/s
const DECEL_TAU = 0.38 // 悬停减速的时间常数（秒）

const rowA = ref<HTMLElement | null>(null)
const rowB = ref<HTMLElement | null>(null)
const copyA = ref<HTMLElement | null>(null)
const copyB = ref<HTMLElement | null>(null)

const copies = Array.from({ length: COPY_COUNT }, (_, i) => i)

/** 两行各自独立打乱，避免两行出现同一条重复的斜线 */
const rowProjects = [shuffle(PROJECTS, 211), shuffle(PROJECTS, 577)]

/** 只在第一份上挂测量用的 ref（另外两份宽度相同） */
function setCopyA(el: Element | ComponentPublicInstance | null): void {
  copyA.value = (el as HTMLElement) ?? null
}
function setCopyB(el: Element | ComponentPublicInstance | null): void {
  copyB.value = (el as HTMLElement) ?? null
}

/** 减少动效时不做无缝滚动，两行静止 */
const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let raf = 0
let last = 0
let posA = 0
let posB = 0
let speedA = BASE_SPEED
let speedB = BASE_SPEED
const hoverA = ref(false)
const hoverB = ref(false)
let copyWidth = 1

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function measure(): void {
  const w = copyA.value?.offsetWidth || 0
  if (w > 0) copyWidth = Math.max(w, copyB.value?.offsetWidth || 0, 1)
}

function inRange(index: number): boolean {
  return index > 1.35 && index < 3.45
}

function frame(now: number): void {
  raf = 0
  const dt = last === 0 ? 1 / 60 : Math.min(now - last, 60) / 1000
  last = now

  const index = camera.engine.displayIndex
  if (!inRange(index)) {
    // 离开本区：停掉循环，等相机再靠近时由 sync 唤醒
    last = 0
    return
  }

  const W = window.innerWidth
  const enter = smoothstep(1.5, 2.22, index)
  const exit = smoothstep(2.72, 3.28, index)

  // 指数逼近目标速度 → 快速减速而不是硬停
  const k = 1 - Math.exp(-dt / DECEL_TAU)
  speedA += ((hoverA.value ? 0 : BASE_SPEED) - speedA) * k
  speedB += ((hoverB.value ? 0 : BASE_SPEED) - speedB) * k

  posA = (posA + speedA * dt) % copyWidth
  posB = (posB + speedB * dt) % copyWidth

  const offA = (1 - enter) * W - exit * W
  const offB = -(1 - enter) * W + exit * W

  if (rowA.value) {
    rowA.value.style.transform = `translate3d(${(offA - posA).toFixed(2)}px, 0, 0)`
  }
  if (rowB.value) {
    // 反向：整条轨道从 -copyWidth 往右走
    rowB.value.style.transform = `translate3d(${(offB + posB - copyWidth).toFixed(2)}px, 0, 0)`
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

onMounted(() => {
  measure()
  sync(camera.engine.displayIndex)
})

onBeforeUnmount(() => {
  if (raf !== 0) cancelAnimationFrame(raf)
  raf = 0
})
</script>

<template>
  <div class="works">
    <header class="head">
      <h2 class="title">其它作品</h2>
      <p class="lead">启动器之外的一些东西。</p>
    </header>

    <div class="rows">
      <!-- 行 A：向左滚。悬停时整行减速 -->
      <div
        class="row"
        @pointerenter="hoverA = true"
        @pointerleave="hoverA = false"
      >
        <div ref="rowA" class="track">
          <div v-for="c in copies" :key="c" :ref="c === 0 ? setCopyA : undefined" class="copy">
            <a
              v-for="p in rowProjects[0]"
              :key="`${c}-${p.name}`"
              class="project"
              :href="p.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="tag">{{ p.tag }}</span>
              <span class="name">{{ p.name }}</span>
              <span class="desc">{{ p.desc }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- 行 B：向右滚 -->
      <div
        class="row"
        @pointerenter="hoverB = true"
        @pointerleave="hoverB = false"
      >
        <div ref="rowB" class="track">
          <div v-for="c in copies" :key="c" :ref="c === 0 ? setCopyB : undefined" class="copy">
            <a
              v-for="p in rowProjects[1]"
              :key="`${c}-${p.name}`"
              class="project"
              :href="p.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="tag">{{ p.tag }}</span>
              <span class="name">{{ p.name }}</span>
              <span class="desc">{{ p.desc }}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.works {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2.2rem;
  padding: 4.5rem 0 2rem;
  box-sizing: border-box;
  overflow: hidden;
}

.head {
  padding: 0 4.5rem;
}

.title {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--wz-text-primary);
}

.lead {
  margin: 0.5rem 0 0;
  font-size: 1.05rem;
  letter-spacing: 0.05em;
  color: var(--wz-text-tertiary);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  /* 只露出两行卡片 */
  overflow: hidden;
}

.row {
  overflow: hidden;
  /* 上下留一点空间给卡片的悬停提亮 */
  padding: 0.3rem 0;
  cursor: default;
}

.track,
.copy {
  display: flex;
  align-items: stretch;
  gap: 1.15rem;
  width: max-content;
  will-change: transform;
}

/* --- 卡片 --- */
.project {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.45rem;
  width: 21rem;
  height: 11.5rem;
  padding: 1.15rem 1.25rem;
  box-sizing: border-box;
  border: 1px solid rgb(255 255 255 / 0.09);
  border-radius: 0.7rem;
  background:
    linear-gradient(160deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.012)),
    color-mix(in srgb, #121316 55%, transparent);
  color: var(--wz-text-default);
  text-decoration: none;
  transition:
    border-color 220ms ease,
    background-color 220ms ease;
}

.project:hover {
  border-color: color-mix(in srgb, var(--wz-brand-soft) 45%, transparent);
  background:
    linear-gradient(160deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0.02)),
    color-mix(in srgb, #16181c 60%, transparent);
}

.tag {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--wz-brand-soft);
  opacity: 0.85;
}

.name {
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--wz-text-primary);
}

.desc {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--wz-text-tertiary);
  /* 两行封顶，避免不同长度的描述把卡片撑歪 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .track {
    /* 减少动效时不做无缝滚动：让轨道静止，用户可以横向滚动查看 */
    will-change: auto;
  }
}
</style>
