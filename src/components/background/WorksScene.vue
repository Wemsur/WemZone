<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { buildContours, segmentsToPaths } from '@/engine/contours'

/**
 * 其它作品区背景 —— 用户要求（原文）：
 *
 *   「使用点阵 + 大型轻微起伏的波形均匀分布 + 光晕作为背景」
 *   后来修正为：「那种等距的静态优美等高线，较细硬边缘」
 *
 * 所以不是流动的正弦波浪，而是**真正的地形等高线**：由几个高斯山包叠出
 * 高度场，用 marching squares 按等距水平值抽线。线条**静态**、间距均匀、
 * 细而硬（1px、无模糊、圆头收边）。生成逻辑见 `engine/contours.ts`。
 *
 * 点阵与光晕保留。
 */
defineProps<{ hue: number }>()

const root = ref<HTMLDivElement | null>(null)
const paths = shallowRef<{ level: number; d: string }[]>([])
const size = ref({ w: 0, h: 0 })

let observer: ResizeObserver | null = null
let raf = 0

/** 只在尺寸真的变了时重算；等高线是静态的，不需要每帧算 */
function rebuild(): void {
  const el = root.value
  if (!el) return
  const w = Math.round(el.clientWidth)
  const h = Math.round(el.clientHeight)
  if (!w || !h) return
  if (w === size.value.w && h === size.value.h) return
  size.value = { w, h }
  paths.value = segmentsToPaths(buildContours({ width: w, height: h, seed: 11 }))
}

function schedule(): void {
  if (raf !== 0) return
  raf = requestAnimationFrame(() => {
    raf = 0
    rebuild()
  })
}

onMounted(() => {
  rebuild()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule)
    if (root.value) observer.observe(root.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (raf !== 0) cancelAnimationFrame(raf)
})

/** 线条透明度：越靠内的圈越亮一点，读起来像地形的高处 */
function opacityOf(level: number, total: number): number {
  const t = total <= 1 ? 0.5 : level / (total - 1)
  return 0.12 + t * 0.2
}
</script>

<template>
  <div ref="root" class="scene" :style="{ '--hue': hue }">
    <!-- 1. 等高线：静态、等距、细硬边缘 -->
    <svg
      class="contours"
      :viewBox="`0 0 ${size.w || 1} ${size.h || 1}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        v-for="(p, i) in paths"
        :key="p.level"
        :d="p.d"
        :stroke-opacity="opacityOf(i, paths.length)"
      />
    </svg>

    <!-- 2. 点阵：圆点 → 圆角方形 -->
    <div class="dots dots-round" />
    <div class="dots dots-square" />

    <!-- 3. 光晕 -->
    <div class="glow" />

    <!-- 4. 暗角 -->
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #121316;
}

/* --- 等高线 --- */
.contours {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* 硬边、细线、圆头收边。不加 filter/模糊 —— 用户要的是「较细硬边缘」 */
  overflow: visible;
}

.contours path {
  fill: none;
  stroke: hsl(var(--hue) 34% 74%);
  stroke-width: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

/* --- 点阵 --- */
.dots {
  position: absolute;
  inset: 0;
  mask-image: radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%);
  -webkit-mask-image: radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%);
}

.dots-round {
  background-image: radial-gradient(circle, hsl(var(--hue) 30% 78% / 0.1) 1px, transparent 1.4px);
  background-size: 18px 18px;
}

/* 圆角方形：内联 SVG pattern，向右逐渐取代圆点 */
.dots-square {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Crect x='6.2' y='6.2' width='5.6' height='5.6' rx='1.6' fill='%23ffffff' fill-opacity='0.09'/%3E%3C/svg%3E");
  background-size: 18px 18px;
  mask-image:
    radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%),
    linear-gradient(to right, transparent 18%, #000 78%);
  -webkit-mask-image:
    radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%),
    linear-gradient(to right, transparent 18%, #000 78%);
  mask-composite: intersect;
  -webkit-mask-composite: source-in;
}

/* --- 光晕 --- */
.glow {
  position: absolute;
  left: 18%;
  top: 8%;
  width: 76vw;
  height: 76vw;
  border-radius: 50%;
  background: radial-gradient(circle, hsl(var(--hue) 55% 48% / 0.22) 0%, transparent 64%);
  transform: translate3d(var(--bg-px), var(--bg-py), 0);
  animation: works-breathe 19s ease-in-out infinite alternate;
}

@keyframes works-breathe {
  from {
    opacity: 0.55;
    transform: translate3d(var(--bg-px), var(--bg-py), 0) scale(0.96);
  }
  to {
    opacity: 0.95;
    transform: translate3d(var(--bg-px), var(--bg-py), 0) scale(1.06);
  }
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, transparent 36%, #08090b 100%);
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
