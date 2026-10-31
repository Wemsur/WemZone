<script setup lang="ts">
import { ref } from 'vue'

import launcherShot from '@/assets/bg/launcher-placeholder.png'
import { useCameraFrame } from '@/composables/useCamera'

/**
 * Celestial Launcher 区
 *
 * 阶段目标（用户原话）：
 *   「这个分层/动画功能后置做，在我部署完之后再做，开始做一个图片放在那里
 *     下落并左移，后续再替换为分层 + 真实启动器小窗」
 *
 * 所以现在只有：一张真实的启动器截图，进入本区时**从上方下落并左移**到
 * 左侧，右侧出现标题、简短介绍与进入官网的按钮。后续会用分层动画替换掉
 * 这张静图（真实启动器窗口复刻属于 Phase 6）。
 *
 * 动画由相机连续索引驱动（0.9 → 1.5 之间完成），与站内其它运动同源。
 */

const panel = ref<HTMLElement | null>(null)

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

useCameraFrame((frame) => {
  const el = panel.value
  if (!el) return
  const t = smoothstep(0.9, 1.5, frame.index)
  // t=0：在右上、更远、更小；t=1：落到左侧原位
  el.style.opacity = t.toFixed(3)
  el.style.transform =
    `translate3d(${((1 - t) * 16).toFixed(2)}%, ${((1 - t) * -52).toFixed(2)}%, 0) ` +
    `scale(${(0.92 + t * 0.08).toFixed(4)}) rotate(${((1 - t) * 2.2).toFixed(2)}deg)`
})
</script>

<template>
  <div class="launcher">
    <div ref="panel" class="shot-wrap">
      <img class="shot" :src="launcherShot" alt="Celestial Launcher 截图" draggable="false" />
    </div>

    <div class="copy">
      <h2 class="title">Celestial Launcher</h2>
      <p class="lead">
        一个基于 Modrinth 的 Minecraft 启动器。分屏浏览、逐句翻译、主题与背景都可以改。
      </p>
      <a class="cta" href="https://celestial.wemsur.top" target="_blank" rel="noopener noreferrer">
        进入官网<span class="arrow" aria-hidden="true">→</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.launcher {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4vw;
  padding: 4rem 6rem;
  box-sizing: border-box;
}

/* --- 截图（占位） --- */
.shot-wrap {
  flex: 0 0 48%;
  display: flex;
  justify-content: flex-end;
  will-change: transform, opacity;
  opacity: 0;
}

.shot {
  width: 100%;
  height: auto;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 0.6rem;
  /* 截图本身是启动器窗口，给它一点浮起来的阴影，不做外框 */
  box-shadow:
    0 2rem 5rem rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.06);
  user-select: none;
}

/* --- 右侧文字 --- */
.copy {
  flex: 0 0 34%;
  max-width: 34rem;
}

.title {
  margin: 0;
  font-size: 2.1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--wz-text-primary);
}

.lead {
  margin: 0.9rem 0 0;
  font-size: 0.95rem;
  line-height: 1.8;
  letter-spacing: 0.03em;
  color: var(--wz-text-tertiary);
}

/* 不重要的按钮不要边框：只有文字与一道悬停时的柔光 */
.cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.6rem;
  padding: 0.4rem 0.1rem;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  color: var(--wz-brand-soft);
  text-decoration: none;
  transition: color 200ms ease;
}

.cta::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0.05rem;
  width: 70%;
  height: 0.8rem;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse, hsl(var(--wz-brand-hue) 68% 55% / 0.5), transparent 70%);
  filter: blur(0.3rem);
  opacity: 0;
  transition: opacity 240ms ease;
  pointer-events: none;
}

.cta:hover {
  color: var(--wz-text-primary);
}

.cta:hover::after {
  opacity: 1;
}

.arrow {
  transition: transform 220ms ease;
}

.cta:hover .arrow {
  transform: translateX(0.25rem);
}

@media (max-width: 900px) and (orientation: portrait) {
  .launcher {
    flex-direction: column;
    gap: 2rem;
    padding: 3rem 1.5rem;
    text-align: center;
  }
  .shot-wrap {
    flex: 0 0 auto;
    width: 100%;
    justify-content: center;
  }
  .copy {
    flex: 0 0 auto;
    width: 100%;
  }
}
</style>
