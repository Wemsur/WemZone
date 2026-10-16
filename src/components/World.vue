<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useCamera } from '@/composables/useCamera'
import { CAMERA } from '@/engine/constants'
import { staticSectionTransform } from '@/engine/world'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 相机世界
 *
 * DOM 四层（见 docs/DESIGN.md）：
 *   #stage      固定铺满视口，接管全部滚动
 *     .idle-drift-x/y   空闲晃动（CSS 合成动画）
 *       #viewport       提供透视
 *         #world        每帧被写的那一层
 *           section     内容块，静态摆放
 *
 * 每帧只有 #world 的 transform 被写一次。
 */

const camera = useCamera()
const worldEl = ref<HTMLElement | null>(null)
let detach: (() => void) | null = null

onMounted(() => {
  if (!worldEl.value) return
  detach = camera.attachTo(worldEl.value)
  // 初始定位：不带动画地落到第一个区块
  camera.goTo(0, { immediate: true })
})

onBeforeUnmount(() => {
  detach?.()
  detach = null
})

/** 每个区块的静态 transform（位置 + 距离补偿），启动时算一次。 */
function sectionStyle(index: number): Record<string, string> {
  const stop = camera.engine.path.stops[index]
  return { transform: staticSectionTransform(stop, CAMERA.PERSPECTIVE) }
}
</script>

<template>
  <div id="stage">
    <div class="idle-drift-x">
      <div class="idle-drift-y">
        <div id="viewport" :style="{ '--perspective': `${CAMERA.PERSPECTIVE}rem` }">
          <div ref="worldEl" id="world">
            <section
              v-for="(section, i) in ACTIVE_SECTIONS"
              :key="section.id"
              class="world-section"
              :data-i="i"
              :data-id="section.id"
              :style="sectionStyle(i)"
            >
              <slot :name="section.id" :index="i" />
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
