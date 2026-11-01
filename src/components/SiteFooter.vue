<script setup lang="ts">
import { ref } from 'vue'

import FooterNav from '@/components/FooterNav.vue'
import { useCameraFrame } from '@/composables/useCamera'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 宽版页脚（screen-space）
 *
 * 与首页顶栏同一套做法：**固定在视口里**，不随 3D 世界倾斜、也不跟着
 * 空闲晃动移动。可见性由相机连续索引驱动 —— 接近最后一个区块时从下方
 * 滑上来，离开时滑回去。
 *
 * 之前它挂在联系区里，会跟着相机的晃动上下浮动（实测 ±19px），还会被
 * 区块的 4% 出血推到屏幕外。
 */
const bar = ref<HTMLElement | null>(null)

const LAST = ACTIVE_SECTIONS.length - 1

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

useCameraFrame((frame) => {
  const el = bar.value
  if (!el) return
  // 倒数第二个区还没走完就开始露头；到最后一区完全展开
  const t = smoothstep(LAST - 0.8, LAST - 0.2, frame.index)
  el.style.opacity = t.toFixed(3)
  el.style.transform = `translate3d(0, ${((1 - t) * 110).toFixed(1)}%, 0)`
  el.style.pointerEvents = t > 0.6 ? 'auto' : 'none'
})
</script>

<template>
  <footer ref="bar" class="site-footer">
    <div class="footer-fade" aria-hidden="true" />
    <FooterNav />
  </footer>
</template>

<style scoped>
.site-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 36;
  opacity: 0;
  transform: translate3d(0, 110%, 0);
  pointer-events: none;
  will-change: transform, opacity;
}

/* 底部一层很淡的渐变，让页脚不像是直接贴在场景上（对应顶栏那条） */
.footer-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgb(10 10 10 / 0.55) 0%,
    rgb(10 10 10 / 0.22) 55%,
    transparent 100%
  );
  mask-image: linear-gradient(to top, #000 0%, #000 45%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, #000 0%, #000 45%, transparent 100%);
}

.site-footer :deep(.footer-row) {
  position: relative;
}
</style>
