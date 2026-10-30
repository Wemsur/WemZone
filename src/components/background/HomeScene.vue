<script setup lang="ts">
/**
 * 首页背景 —— 用户要求（原文）：
 *
 *   「整体背景图片 + 遮罩，背景比视野可见的要大，根据显示窗口比例自动适应大小，
 *     使视野里看到的永远不出现黑边，而在边缘处渐隐处理（这在视野外，
 *     不应该影响视野内的观感）。
 *     同时有大型白色微弱光晕，做出呼吸效果，一会在这里渐显渐隐，
 *     一会换一处渐显渐隐 + 微弱点阵」
 *
 * 实现要点：
 *  - 图片层比视口大 12%（`inset: -12%`），`cover` 铺满，再用 `mask` 在
 *    **它自己的边缘**渐隐 —— 那条边永远在视口外，所以视野内看不到接缝。
 *  - 光晕是三团白色径向渐变，各自以不同周期/相位呼吸，位置分散在
 *    左上 / 右下 / 中上，于是「一会这里、一会那里」。
 *  - 点阵是极低透明度的重复径向渐变，只在暗部隐约可见。
 *
 * **背景图待补**：用户会提供一张 ≥2560px 的首页图（访谈 Q36）。在那之前
 * 用程序化的暗色渐变占位；接入时只需给 `.photo` 设 `--home-bg-image: url(...)`。
 */
defineProps<{ hue: number }>()
</script>

<template>
  <div class="scene" :style="{ '--hue': hue }">
    <!-- 1. 背景图 + 遮罩。比视口大，边缘在视野外渐隐 -->
    <div class="photo" />
    <div class="photo-mask" />

    <!-- 2. 大型白色微弱呼吸光晕（三处，不同相位） -->
    <div class="glow glow-a" />
    <div class="glow glow-b" />
    <div class="glow glow-c" />

    <!-- 3. 微弱点阵 -->
    <div class="dots" />

    <!-- 4. 暗角 -->
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #121212;
}

/* --- 背景图 --- */
.photo {
  position: absolute;
  /* 比视口大：保证任何窗口比例下都铺满、且渐隐边落在视野外 */
  inset: -12%;
  background-image:
    var(--home-bg-image, none),
    radial-gradient(ellipse 80% 60% at 30% 24%, #342e28 0%, transparent 62%),
    radial-gradient(ellipse 70% 55% at 76% 72%, #232a32 0%, transparent 64%),
    linear-gradient(160deg, #201f1d 0%, #171717 48%, #121214 100%);
  background-size: cover;
  background-position: center;
  /* 边缘渐隐：这条边在视口外（inset 为负），所以视野内看不到它 */
  mask-image: radial-gradient(ellipse 88% 88% at 50% 50%, #000 55%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 88% 88% at 50% 50%, #000 55%, transparent 100%);
  transform: translate3d(var(--bg-px), var(--bg-py), 0) scale(1.04);
}

/* 遮罩：把图片整体压暗，保证正文可读 */
.photo-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(10 10 10 / 0.3) 0%,
    rgb(10 10 10 / 0.18) 45%,
    rgb(10 10 10 / 0.46) 100%
  );
}

/* --- 呼吸光晕 --- */
.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: screen;
}

.glow-a {
  left: -14%;
  top: -18%;
  width: 68vw;
  height: 68vw;
  background: radial-gradient(circle, rgb(255 255 255 / 0.18) 0%, transparent 62%);
  animation: breathe-a 13s ease-in-out infinite;
}

.glow-b {
  right: -16%;
  bottom: -22%;
  width: 74vw;
  height: 74vw;
  background: radial-gradient(circle, rgb(255 250 242 / 0.15) 0%, transparent 64%);
  animation: breathe-b 17s ease-in-out infinite;
}

.glow-c {
  left: 30%;
  top: 6%;
  width: 46vw;
  height: 46vw;
  background: radial-gradient(circle, rgb(255 255 255 / 0.11) 0%, transparent 66%);
  animation: breathe-a 21s ease-in-out infinite reverse;
}

@keyframes breathe-a {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.94);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.06);
  }
}

@keyframes breathe-b {
  0%,
  100% {
    opacity: 0.75;
    transform: scale(1.04);
  }
  50% {
    opacity: 0.12;
    transform: scale(0.92);
  }
}

/* --- 微弱点阵 --- */
.dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgb(255 255 255 / 0.1) 1px, transparent 1px);
  background-size: 15px 15px;
  /* 只在中间偏上可见，边缘淡出，避免变成一张铺满的网格 */
  mask-image: radial-gradient(ellipse 70% 62% at 50% 44%, #000 0%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 70% 62% at 50% 44%, #000 0%, transparent 78%);
  opacity: 0.7;
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, transparent 34%, #080808 100%);
  opacity: 0.42;
}

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
