<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import MobileWorld from '@/components/MobileWorld.vue'
import PrintDoc from '@/components/PrintDoc.vue'
import HomeSection from '@/components/sections/HomeSection.vue'
import ContactSection from '@/components/sections/ContactSection.vue'
import HomeTopBar from '@/components/sections/HomeTopBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import VideoSection from '@/components/sections/VideoSection.vue'
import LauncherSection from '@/components/sections/LauncherSection.vue'
import WorksSection from '@/components/sections/WorksSection.vue'
import UnifiedCard from '@/components/sections/UnifiedCard.vue'
import TuningPanel from '@/components/TuningPanel.vue'
import World from '@/components/World.vue'
import { provideCamera } from '@/composables/useCamera'
import { useDeepLink } from '@/composables/useDeepLink'
import { useMediaQuery } from '@/composables/useMediaQuery'
import type { BlurMode } from '@/engine/blur'
import { narrow } from '@/lib/viewport'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 应用外壳
 *
 * 两套版式，切换点只有一条媒体查询（见 lib/viewport.ts）：
 *  - 宽版：3D 平面 + 相机引擎（World.vue）
 *  - 窄版：原生竖直滚动 + snap（MobileWorld.vue）
 *
 * Phase 2 阶段：占位方块 + 运动模糊 A/B 原型。
 * 真内容在 Phase 4 填充。
 */

const camera = provideCamera()

/** 深链接：URL hash ↔ 当前区块（含前进/后退支持）。 */
useDeepLink(camera)

/**
 * 运动模糊方案。
 *
 * Phase 2 的 A/B 原型已定稿为 **A**（各向同性 blur + 沿运动轴拉伸）。
 * B（SVG 各向异性 feGaussianBlur）实测在整页 DOM 子树上极慢，只留作开发
 * 对比：生产构建里无论怎么切都只用 A，连 B 键也不响应。
 */
const blurMode = ref<BlurMode>('A')

/** 用户要求减少动效时，模糊一并关掉（相机那边已经跳过了弹簧与补间）。 */
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const effectiveBlur = computed<BlurMode>(() =>
  reduceMotion.value ? 'off' : import.meta.env.DEV ? blurMode.value : 'A',
)

/** 调试 UI 只在 DEV + 宽版显示。 */
const showDebug = computed(() => import.meta.env.DEV && !narrow.value)

/** 按 B 键循环切换模糊方案。 */
function onKey(e: KeyboardEvent): void {
  // A/B 对比是开发工具，生产构建里不响应
  if (!import.meta.env.DEV) return
  if (e.key !== 'b' && e.key !== 'B') return
  const order: BlurMode[] = ['off', 'A', 'B']
  blurMode.value = order[(order.indexOf(blurMode.value) + 1) % order.length]
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <MobileWorld v-if="narrow">
    <template v-for="section in ACTIVE_SECTIONS" :key="section.id" #[section.id]>
      <HomeSection v-if="section.id === 'home'" />
      <LauncherSection v-else-if="section.id === 'launcher'" />
      <WorksSection v-else-if="section.id === 'works'" />
      <VideoSection v-else-if="section.id === 'video'" />
      <ContactSection v-else-if="section.id === 'contact'" />
      <div v-else class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </MobileWorld>

  <World v-else :blur-mode="effectiveBlur">
    <template v-for="section in ACTIVE_SECTIONS" :key="section.id" #[section.id]>
      <HomeSection v-if="section.id === 'home'" />
      <LauncherSection v-else-if="section.id === 'launcher'" />
      <WorksSection v-else-if="section.id === 'works'" />
      <VideoSection v-else-if="section.id === 'video'" />
      <ContactSection v-else-if="section.id === 'contact'" />
      <div v-else class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </World>

  <!-- 首页顶栏：screen-space，离开首页时上滑淡出 -->
  <HomeTopBar v-if="!narrow" />

  <!-- 统一卡片：全站只有一张，跟随相机在区块锚点间沿曲线移动 -->
  <UnifiedCard v-if="!narrow" />
  <SiteFooter v-if="!narrow" />

  <!-- 调试信息（Phase 2 临时，Phase 4/5 移除） -->
  <div v-if="showDebug" class="hud">
    <div>区块 {{ camera.current.value }} / {{ ACTIVE_SECTIONS.length - 1 }}</div>
    <div>状态 {{ camera.state.value }}</div>
    <div>按 B 切换模糊方案</div>
  </div>

  <TuningPanel v-if="showDebug" v-model:blur-mode="blurMode" />

  <!-- 打印版：屏幕上是 display:none，只在 @media print 下替换掉 3D 舞台 -->
  <PrintDoc />
</template>

<style scoped>
/* Phase 1 的占位方块：刻意做得比最终设计显眼，
   用来肉眼验证相机引擎（路径 / 弹簧 / 切换 / 晃动）。Phase 4 会被真内容替换。

   **尺寸交给 .world-section**（它按视野算宽高）。这里只管视觉，不设 width，
   否则会把区块撑成内容尺寸、退回「屏幕中间一小块」。 */
.placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border: 0.125rem solid var(--wz-brand);
  border-radius: var(--radius-card);
  /* 半透明：背景是整站的主角之一，区块不能把它完全盖住 */
  background: color-mix(in srgb, var(--wz-surface-3) 45%, transparent);
  box-shadow: 0 0 4rem color-mix(in srgb, var(--wz-brand) 22%, transparent);
}

.placeholder-index {
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--wz-text-primary);
  letter-spacing: 0.08em;
  text-align: center;
}

.hud {
  position: fixed;
  left: 1rem;
  bottom: 4.2rem;
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--wz-text-tertiary);
  pointer-events: none;
  user-select: none;
}
</style>
