<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BlurDebugPanel from '@/components/BlurDebugPanel.vue'
import MobileWorld from '@/components/MobileWorld.vue'
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

/** 运动模糊方案。Phase 2 用面板手动切换，Phase 5 定稿后写死。 */
const blurMode = ref<BlurMode>('A')

/** 用户要求减少动效时，模糊一并关掉（相机那边已经跳过了弹簧与补间）。 */
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const effectiveBlur = computed<BlurMode>(() => (reduceMotion.value ? 'off' : blurMode.value))

/** 调试 UI 只在 DEV + 宽版显示。 */
const showDebug = computed(() => import.meta.env.DEV && !narrow.value)

/** 按 B 键循环切换模糊方案。 */
function onKey(e: KeyboardEvent): void {
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
      <div class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </MobileWorld>

  <World v-else :blur-mode="effectiveBlur">
    <template v-for="section in ACTIVE_SECTIONS" :key="section.id" #[section.id]>
      <div class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </World>

  <!-- 调试信息（Phase 2 临时，Phase 4/5 移除） -->
  <div v-if="showDebug" class="hud">
    <div>区块 {{ camera.current.value }} / {{ ACTIVE_SECTIONS.length - 1 }}</div>
    <div>状态 {{ camera.state.value }}</div>
    <div>按 B 切换模糊方案</div>
  </div>

  <BlurDebugPanel v-if="showDebug" v-model="blurMode" />
</template>

<style scoped>
/* Phase 1 的占位方块：刻意做得比最终设计显眼，
   用来肉眼验证相机引擎（路径 / 弹簧 / 切换 / 晃动）。Phase 4 会被真内容替换。 */
.placeholder {
  width: 46rem;
  max-width: 90%;
  aspect-ratio: 16 / 9;
  display: grid;
  place-items: center;
  border: 0.125rem solid var(--color-brand);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--surface-4) 92%, transparent);
  box-shadow: 0 0 4rem color-mix(in srgb, var(--color-brand) 22%, transparent);
}

.placeholder-index {
  font-size: 2.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.08em;
  text-align: center;
}

.hud {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-tertiary);
  pointer-events: none;
  user-select: none;
}
</style>
