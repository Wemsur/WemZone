<script setup lang="ts">
/**
 * 联系区的背景 —— 「最安静的一屏，几乎只有渐变」
 *
 * 没有光晕、没有点阵、没有流体。只有一层极慢的斜向渐变，
 * 和一个把边缘收暗的暗角。它是全站唯一一处「什么都不发生」的背景，
 * 作为整段旅程的收束。
 */
defineProps<{ hue: number }>()
</script>

<template>
  <div class="scene" :style="{ '--hue': hue }">
    <div class="gradient" />
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #131313;
}

/* 极慢的斜向渐变：色相只以很低的饱和度出现，几乎读作「冷灰」 */
.gradient {
  position: absolute;
  inset: -10%;
  background:
    linear-gradient(
      145deg,
      hsl(var(--hue) 34% 16% / 0.55) 0%,
      transparent 46%,
      hsl(var(--hue) 22% 10% / 0.5) 100%
    ),
    radial-gradient(ellipse at 62% 38%, hsl(var(--hue) 30% 20% / 0.35), transparent 62%);
  animation: contact-breathe 26s ease-in-out infinite alternate;
}

@keyframes contact-breathe {
  from {
    transform: translate3d(-1.2%, -0.8%, 0) scale(1.02);
  }
  to {
    transform: translate3d(1.2%, 0.8%, 0) scale(1.05);
  }
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, transparent 36%, #0a0a0a 100%);
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .gradient {
    animation: none;
  }
}
</style>
