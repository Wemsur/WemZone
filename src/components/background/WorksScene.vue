<script setup lang="ts">
import { computed } from 'vue'

/**
 * 其它作品区背景 —— 用户要求（原文）：
 *
 *   「使用点阵 + 大型轻微起伏的波形均匀分布 + 光晕作为背景」
 *
 * 三层：
 *  1. **波形**：六条横贯全屏的正弦线，均匀分布在画面上，各自以不同速度
 *     横向漂移、幅度很小。路径宽 2000、周期 500，所以位移 -25% 正好无缝循环。
 *  2. **点阵**：左侧是圆点，向右逐渐变成圆角方形（用户在第一轮表格里
 *     写的「圆点→圆角方形的渐变」），用两层点阵 + 横向 mask 交叉实现。
 *  3. **光晕**：一团跟着区块色相的大光晕。
 */
defineProps<{ hue: number }>()
const W = 2000
const PERIOD = 500

/** 一条正弦波的路径。宽 = 4 个周期，所以 -25% 位移后首尾重合。 */
function wavePath(amplitude: number, phase: number): string {
  const pts: string[] = []
  const step = 10
  for (let x = 0; x <= W; x += step) {
    const y = 50 + Math.sin((x / PERIOD) * Math.PI * 2 + phase) * amplitude
    pts.push(`${x},${y.toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}

/** 六条波：幅度 6–18（viewBox 高 100），相位错开，避免平行得像斑马线 */
const waves = computed(() => {
  const out: { d: string; top: number; dur: number; reverse: boolean; opacity: number }[] = []
  for (let i = 0; i < 6; i++) {
    const amp = 7 + (i % 3) * 5
    out.push({
      d: wavePath(amp, i * 0.9),
      top: 12 + i * 15, // 12% .. 87%，均匀分布
      dur: 26 + i * 5,
      reverse: i % 2 === 1,
      opacity: 0.5 - i * 0.045,
    })
  }
  return out
})
</script>

<template>
  <div class="scene" :style="{ '--hue': hue }">
    <!-- 1. 波形 -->
    <svg class="waves" :viewBox="`0 0 ${W} 100`" preserveAspectRatio="none" aria-hidden="true">
      <g
        v-for="(w, i) in waves"
        :key="i"
        class="wave"
        :style="{
          '--dur': `${w.dur}s`,
          '--dir': w.reverse ? 'reverse' : 'normal',
          '--op': String(w.opacity),
        }"
      >
        <path :d="w.d" />
      </g>
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

/* --- 波形 --- */
.waves {
  position: absolute;
  inset: -6%;
  width: 112%;
  height: 112%;
  overflow: visible;
}

.wave {
  transform-box: fill-box;
  animation: wave-drift var(--dur) linear infinite;
  animation-direction: var(--dir);
}

.wave path {
  fill: none;
  stroke: hsl(var(--hue) 40% 72% / 1);
  stroke-width: 0.35;
  opacity: var(--op);
  vector-effect: non-scaling-stroke;
}

@keyframes wave-drift {
  from {
    transform: translateX(0);
  }
  /* 一个周期 = 25%（2000 宽的 500），无缝循环 */
  to {
    transform: translateX(-25%);
  }
}

/* --- 点阵 --- */
.dots {
  position: absolute;
  inset: 0;
  mask-image: radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%);
  -webkit-mask-image: radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 88%);
}

.dots-round {
  background-image: radial-gradient(circle, hsl(var(--hue) 30% 78% / 0.16) 1px, transparent 1.4px);
  background-size: 18px 18px;
}

/* 圆角方形：内联 SVG pattern，向右逐渐取代圆点 */
.dots-square {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Crect x='6.2' y='6.2' width='5.6' height='5.6' rx='1.6' fill='%23ffffff' fill-opacity='0.14'/%3E%3C/svg%3E");
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
  .wave,
  .glow {
    animation: none;
  }
}
</style>
