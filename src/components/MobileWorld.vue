<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import Background from '@/components/Background.vue'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 窄版（竖屏手机 / 平板）的版式
 *
 * 与宽版是**两套完全不同的实现**，不是同一套缩一缩：
 *
 *  - 宽版是「一块 3D 平面 + 相机引擎」，页面本身不滚动。
 *  - 窄版是**原生竖直滚动 + scroll-snap**，没有 3D 平面、没有相机。
 *
 * 为什么必须分开：16:9 的横向构图与竖屏的比例是矛盾的。把 3D 平面塞进
 * 390px 宽的屏幕，要么字小到看不清，要么构图被裁掉一大半。
 *
 * 保留的是「跟手」与「弱弹簧」：
 *  - 跟手由原生滚动天然满足（手指走多远，页面走多远）。
 *  - 弹簧体现在每节进入时的轻微缩放/位移 —— 用一个跟随滚动进度的
 *    transform，幅度比宽版小得多（宽版是整块平面在动，这里只是内容自身）。
 */

const root = ref<HTMLElement | null>(null)
/** 每节相对视口的进度（-1 = 还没进，0 = 正好居中，1 = 已离开） */
const offsets = ref<number[]>(ACTIVE_SECTIONS.map(() => 0))

let raf = 0
let cleanup: (() => void) | null = null

/**
 * 计算每节相对视口中心的偏移，用于驱动轻微缩放。
 *
 * 这是窄版**唯一**的每帧计算，且只读一次几何（在滚动回调里，不是每帧），
 * 与宽版「帧内零 rect 读取」的纪律不冲突 —— 窄版没有相机状态需要合成。
 */
function measure(): void {
  raf = 0
  const el = root.value
  if (!el) return
  const vh = window.innerHeight
  const next: number[] = []
  for (const sec of Array.from(el.querySelectorAll<HTMLElement>('[data-mobile-section]'))) {
    const r = sec.getBoundingClientRect()
    const center = r.top + r.height / 2
    // -1 .. 1，0 表示正好在视口中心
    next.push(Math.max(-1, Math.min(1, (center - vh / 2) / vh)))
  }
  offsets.value = next
}

function schedule(): void {
  if (raf !== 0) return
  raf = requestAnimationFrame(measure)
}

onMounted(() => {
  const el = root.value
  if (!el) return
  el.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  measure()

  cleanup = () => {
    el.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    if (raf !== 0) cancelAnimationFrame(raf)
    raf = 0
  }
})

onBeforeUnmount(() => {
  cleanup?.()
  cleanup = null
})

/** 内容自身的轻微位移 + 缩放：越靠近视口中心越「正」。 */
function sectionStyle(i: number): Record<string, string> {
  const d = offsets.value[i] ?? 0
  const scale = 1 - Math.min(Math.abs(d), 1) * 0.04
  const y = d * 1.2
  return {
    transform: `translate3d(0, ${y.toFixed(3)}rem, 0) scale(${scale.toFixed(4)})`,
    opacity: String(1 - Math.min(Math.abs(d), 1) * 0.35),
  }
}
</script>

<template>
  <div ref="root" class="mobile-scroll">
    <section
      v-for="(section, i) in ACTIVE_SECTIONS"
      :key="section.id"
      class="mobile-section"
      data-mobile-section
      :data-id="section.id"
    >
      <!-- 背景跟着这一节滚动，与宽版同一套场景组件 -->
      <div class="section-bg" aria-hidden="true">
        <Background :kind="section.background" :hue="section.hue ?? 18" />
      </div>

      <div class="mobile-inner" :style="sectionStyle(i)">
        <slot :name="section.id" :index="i" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.mobile-scroll {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* 区块背景渐隐处露出的底色 */
  background: #0b0b0b;
  /* 一次滑动停一节。mandatory 保证不会停在两节之间 */
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.mobile-section {
  position: relative;
  height: 100vh;
  /* 用 svh 兜住移动浏览器地址栏收起/展开导致的高度跳变 */
  height: 100svh;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
  box-sizing: border-box;
}

.mobile-inner {
  width: 100%;
  display: grid;
  place-items: center;
  /* 轻微弹簧感的过渡（宽版禁用一切 transition，窄版则靠它做柔和跟随） */
  transition: transform 120ms linear, opacity 120ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-inner {
    transition: none;
  }
}
</style>
