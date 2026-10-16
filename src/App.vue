<script setup lang="ts">
import { computed } from 'vue'

import MobileWorld from '@/components/MobileWorld.vue'
import World from '@/components/World.vue'
import { provideCamera } from '@/composables/useCamera'
import { narrow } from '@/lib/viewport'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 应用外壳
 *
 * 两套版式，切换点只有一条媒体查询（见 lib/viewport.ts）：
 *  - 宽版：3D 平面 + 相机引擎（World.vue）
 *  - 窄版：原生竖直滚动 + snap（MobileWorld.vue）
 *
 * Phase 1 阶段两套都用占位方块，验证引擎与版式骨架。
 * 真内容在 Phase 4 填充。
 */

const camera = provideCamera()

/** 调试 HUD 只在宽版显示（窄版没有相机状态可看）。 */
const showHud = computed(() => !narrow.value)
</script>

<template>
  <MobileWorld v-if="narrow">
    <template v-for="section in ACTIVE_SECTIONS" :key="section.id" #[section.id]>
      <div class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </MobileWorld>

  <World v-else>
    <template v-for="section in ACTIVE_SECTIONS" :key="section.id" #[section.id]>
      <div class="placeholder">
        <span class="placeholder-index">{{ section.label }}</span>
      </div>
    </template>
  </World>

  <!-- 调试信息（Phase 1 临时，Phase 4 移除） -->
  <div v-if="showHud" class="hud">
    <div>区块 {{ camera.current.value }} / {{ ACTIVE_SECTIONS.length - 1 }}</div>
    <div>状态 {{ camera.state.value }}</div>
  </div>
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
