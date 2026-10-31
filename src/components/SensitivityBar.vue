<script setup lang="ts">
import { computed } from 'vue'

import { SENSITIVITY_MAX, SENSITIVITY_MIN, scrollSensitivity } from '@/lib/preferences'

/**
 * 滑动灵敏度条
 *
 * 外观：一块扁圆角「卡片」，内部一圈四边等距的圆角轨道（看起来像外框的
 * 描边），主题橙按当前倍率从左往右填充：`0.4× → 0%`，`2.5× → 100%`。
 * 条上没有文字，数值放在悬停出现的 tooltip 里。
 *
 * 真正的 `<input type=range>` 是透明铺满整块的，所以拖动、点击、键盘都能用。
 *
 * 两个宿主（统一卡片、首页顶栏）共用这一个组件；宽度由宿主决定
 * （统一卡片里与卡片等宽，顶栏里是一个固定的小宽度）。
 */
const props = defineProps<{
  /** 条在宿主**上方**时置真：tooltip 改到条的上方，避免压住宿主 */
  flip?: boolean
}>()

const label = computed(() => String(Math.round(scrollSensitivity.value * 100) / 100))

/** 填充比例：0.4× → 0%，2.5× → 100% */
const pct = computed(() => {
  const t = (scrollSensitivity.value - SENSITIVITY_MIN) / (SENSITIVITY_MAX - SENSITIVITY_MIN)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return (c * 100).toFixed(1)
})
</script>

<template>
  <div class="sens-panel" :class="{ flip: props.flip }" @wheel.stop>
    <div class="sens-track">
      <div class="sens-fill" :style="{ width: `${pct}%` }" />
    </div>

    <input
      v-model.number="scrollSensitivity"
      class="sens-range"
      type="range"
      :min="SENSITIVITY_MIN"
      :max="SENSITIVITY_MAX"
      step="0.05"
      aria-label="滑动灵敏度"
    />

    <span class="sens-tip" role="tooltip">滑动灵敏度：{{ label }}×</span>
  </div>
</template>

<style scoped>
.sens-panel {
  position: relative;
  padding: 0.3rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, #101010 55%, transparent);
  backdrop-filter: blur(0.9rem) saturate(1.1);
  box-shadow: 0 0.6rem 2rem rgb(0 0 0 / 0.32);
  transition: box-shadow 180ms ease;
}

.sens-panel:focus-within {
  box-shadow:
    0 0.6rem 2rem rgb(0 0 0 / 0.32),
    0 0 0 1px color-mix(in srgb, var(--wz-brand-soft) 55%, transparent);
}

/* 轨道：就是那圈「像边框一样」的圆角矩形，橙色在它内部从左往右填 */
.sens-track {
  position: relative;
  height: 0.95rem;
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.05);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
  overflow: hidden;
}

.sens-fill {
  height: 100%;
  border-radius: 0.5rem;
  background: linear-gradient(90deg, var(--wz-brand), var(--wz-brand-soft));
  box-shadow: 0 0 0.6rem hsl(var(--wz-brand-hue) 68% 55% / 0.45);
  transition: width 160ms ease;
}

/* 真正的控件：透明地铺满整块面板 */
.sens-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

/* tooltip：默认在条下方；宿主在下方（flip）时改到条上方 */
.sens-tip {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  padding: 0.28rem 0.5rem;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0.42rem;
  background: color-mix(in srgb, #0d0d0d 88%, transparent);
  backdrop-filter: blur(0.5rem);
  font-size: 0.68rem;
  line-height: 1.3;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--wz-text-primary);
  opacity: 0;
  transform: translateY(-0.15rem);
  pointer-events: none;
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.sens-panel:hover .sens-tip,
.sens-panel:focus-within .sens-tip {
  opacity: 1;
  transform: translateY(0);
}

.sens-panel.flip .sens-tip {
  top: auto;
  bottom: calc(100% + 0.4rem);
  transform: translateY(0.15rem);
}

.sens-panel.flip:hover .sens-tip,
.sens-panel.flip:focus-within .sens-tip {
  transform: translateY(0);
}
</style>
