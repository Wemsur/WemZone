<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'

import launcherShot from '@/assets/bg/launcher-placeholder.png'
import { useCamera, useCameraFrame } from '@/composables/useCamera'
import { narrow } from '@/lib/viewport'

/**
 * 真实启动器应用（Phase 6）。**异步加载**：它就是启动器前端的 App.vue
 * （连同 vendor 组件库约 900KB），只有相机靠近本区时才需要。
 */
const LauncherWindow = defineAsyncComponent(() => import('./launcher/LauncherApp.vue'))

/**
 * Celestial Launcher 区
 *
 * 阶段目标（用户原话）：
 *   「这个分层/动画功能后置做，在我部署完之后再做，开始做一个图片放在那里
 *     下落并左移，后续再替换为分层 + 真实启动器小窗」
 *
 * 进入本区时窗口**从上方下落并左移**到左侧，右侧的标题/介绍/按钮随后浮上来。
 * 窗口本身是**启动器本人**：`src/launcher-app/App.vue` 原样复制 + Tauri
 * 数据层换成硬编码样例（见 `launcher/LauncherApp.vue`）。截图只在
 * 组件 chunk 还没加载完时充当占位。
 *
 * ## 为什么用「时间轴」而不是「相机索引」
 *
 * 之前把进度绑在连续索引上（0.5 → 0.97），结果动画在相机还没到时就已经
 * 播完了 —— 人看到的时候图片已经躺在左边，等于没做动画。
 * 现在改为**到达时触发**：索引进入 [0.90, 1.18] 才启动一条 1.15s 的时间轴，
 * 自己排 rAF，所以相机停帧后动画照样播完。
 */
const camera = useCamera()
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const copy = ref<HTMLElement | null>(null)

/**
 * 是否已经渲染真实窗口。相机靠近本区（索引 > 0.45）或窄版进入视野时置真，
 * 之后就保持 —— chunk 已经加载过，重新卸载/挂载没有意义。
 */
const showWindow = ref(false)

const DURATION = 1150
let raf = 0
let startedAt = 0
/** 上一帧是否已经在「本区」范围内，用来识别「刚进入」 */
let near = false
/** 窄版：没有相机帧，用 IntersectionObserver 触发同一条时间轴 */
let io: IntersectionObserver | null = null

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** t=0：在右上、更远、更小、透明；t=1：落在左侧原位 */
function apply(t: number): void {
  if (panel.value) {
    panel.value.style.opacity = t.toFixed(3)
    panel.value.style.transform =
      `translate3d(${((1 - t) * 26).toFixed(2)}%, ${((1 - t) * -68).toFixed(2)}%, 0) ` +
      `scale(${(0.9 + t * 0.1).toFixed(4)}) ` +
      `rotate(${((1 - t) * 3).toFixed(2)}deg)`
  }
  if (copy.value) {
    // 文字比图片晚一点浮上来
    const ct = clamp((t - 0.22) / 0.78, 0, 1)
    copy.value.style.opacity = ct.toFixed(3)
    copy.value.style.transform = `translate3d(0, ${((1 - ct) * 1.6).toFixed(2)}rem, 0)`
  }
}

function play(): void {
  if (reduced) {
    apply(1)
    return
  }
  if (raf !== 0) cancelAnimationFrame(raf)
  startedAt = performance.now()
  apply(0)
  const tick = (now: number): void => {
    raf = 0
    const p = Math.min(1, (now - startedAt) / DURATION)
    apply(easeOutCubic(p))
    if (p < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

useCameraFrame((frame) => {
  if (narrow.value) return
  // 提前一个区开始加载，等相机真的到了这里，窗口已经在画面上
  if (frame.index > 0.45) showWindow.value = true
  const isNear = frame.index > 0.9 && frame.index < 1.18
  if (isNear && !near) play()
  near = isNear
})

onMounted(() => {
  // 窄版是原生滚动，相机索引永远是 0 —— 不能靠它触发入场。
  // 改用 IntersectionObserver 观察本节：滚进来就播，滚出去再回来会重播。
  if (narrow.value) {
    apply(0)
    const el = root.value
    if (typeof IntersectionObserver !== 'undefined' && el) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && e.intersectionRatio > 0.5) {
              showWindow.value = true
              play()
            }
          }
        },
        { threshold: [0.55] },
      )
      io.observe(el)
    } else {
      apply(1)
    }
    return
  }

  const i = camera.engine.displayIndex
  // 深链接直接落在本区：窗口与入场都要就位
  if (i > 0.45) showWindow.value = true
  if (i > 0.9 && i < 1.18) play()
  else apply(0)
})

onBeforeUnmount(() => {
  if (raf !== 0) cancelAnimationFrame(raf)
  raf = 0
  io?.disconnect()
  io = null
})
</script>

<template>
  <div ref="root" class="launcher">
    <div ref="panel" class="shot-wrap">
      <!-- 真实小窗；chunk 未就绪或尚未靠近本区时，用截图占位 -->
      <div v-if="showWindow" class="window-frame">
        <LauncherWindow />
      </div>
      <img v-else class="shot" :src="launcherShot" alt="Celestial Launcher 截图" draggable="false" />
    </div>

    <div ref="copy" class="copy">
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

.window-frame {
  width: 100%;
  aspect-ratio: 16 / 10;
  max-height: 60vh;
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
  opacity: 0;
  will-change: transform, opacity;
}

.title {
  margin: 0;
  font-size: 2.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--wz-text-primary);
}

.lead {
  margin: 0.9rem 0 0;
  font-size: 1.08rem;
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
  font-size: 1.05rem;
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
    gap: 1.6rem;
    padding: 2.6rem 1.35rem;
    text-align: center;
  }
  .shot-wrap {
    flex: 0 0 auto;
    width: 100%;
    justify-content: center;
  }
  .shot {
    max-height: 44vh;
  }
  .copy {
    flex: 0 0 auto;
    width: 100%;
    max-width: none;
  }
  .title {
    font-size: 2.1rem;
  }
  .lead {
    font-size: 0.95rem;
    line-height: 1.7;
  }
  .cta {
    margin-top: 1.2rem;
    font-size: 0.95rem;
  }
}
</style>
