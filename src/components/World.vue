<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useCamera } from '@/composables/useCamera'
import { applyBlur, clearBlur, type BlurMode, type BlurTargets } from '@/engine/blur'
import { CAMERA } from '@/engine/constants'
import { staticSectionTransform } from '@/engine/world'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 相机世界
 *
 * DOM 五层（见 docs/DESIGN.md）：
 *   #stage              固定铺满视口，接管全部滚动
 *     .idle-drift-x/y   空闲晃动（CSS 合成动画）
 *       .blur-layer     运动模糊的 filter 加在这一层
 *         #viewport     提供透视
 *           #world      每帧被写的那一层
 *             section   内容块，静态摆放
 *
 * **模糊层必须是 #viewport 的祖先**：`filter` 是分组属性，会让元素的
 * `transform-style` 计算成 flat。加在 #world 或 #viewport 上都会当场
 * 摧毁 3D 场景（详见 engine/blur.ts 顶部注释）。
 */

const props = withDefaults(defineProps<{ blurMode?: BlurMode }>(), { blurMode: 'A' })

const camera = useCamera()
const worldEl = ref<HTMLElement | null>(null)
const layerEl = ref<HTMLElement | null>(null)
const streakEl = ref<HTMLElement | null>(null)
const feBlurEl = ref<SVGFEGaussianBlurElement | null>(null)

let detach: (() => void) | null = null
let stopFrame: (() => void) | null = null

onMounted(() => {
  if (!worldEl.value) return
  detach = camera.attachTo(worldEl.value)
  camera.goTo(0, { immediate: true })

  const targets: BlurTargets = {
    layer: layerEl.value!,
    streak: streakEl.value!,
    feBlur: feBlurEl.value,
  }

  // 订阅每帧状态，命令式写 DOM —— 不进 Vue 响应式（见 docs/DESIGN.md 第八节）
  stopFrame = camera.engine.subscribe((frame) => {
    applyBlur(targets, frame, props.blurMode)
  })
})

onBeforeUnmount(() => {
  stopFrame?.()
  stopFrame = null
  if (layerEl.value && streakEl.value) {
    clearBlur({ layer: layerEl.value, streak: streakEl.value, feBlur: feBlurEl.value })
  }
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
        <!-- 模糊层：必须是 #viewport 的祖先，否则 filter 会拍平 3D 场景 -->
        <div ref="layerEl" class="blur-layer">
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

    <!-- 方向性拖影：一道沿运动方向的光晕，把「糊」读成「拖」。
         不复制 DOM，只是叠在场景上的一层渐变。 -->
    <div ref="streakEl" class="streak-layer" aria-hidden="true" />

    <!-- 方案 B 用的各向异性模糊滤镜。常驻但 stdDeviation 为 0，
         只有切到 B 模式时才被 #world 的祖先层引用。 -->
    <svg class="blur-svg" aria-hidden="true">
      <defs>
        <filter id="wemzone-motion-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur ref="feBlurEl" in="SourceGraphic" stdDeviation="0 0" />
        </filter>
      </defs>
    </svg>
  </div>
</template>

<style scoped>
.blur-layer {
  position: absolute;
  inset: 0;
}

/* 拖影层：沿 --streak-angle 方向的一道亮带，两端渐隐 */
.streak-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    var(--streak-angle, 180deg),
    transparent 0%,
    color-mix(in srgb, var(--color-brand) 22%, transparent) 42%,
    color-mix(in srgb, var(--color-text-primary) 14%, transparent) 50%,
    color-mix(in srgb, var(--color-brand) 22%, transparent) 58%,
    transparent 100%
  );
  mix-blend-mode: screen;
}

.blur-svg {
  position: absolute;
  width: 0;
  height: 0;
}
</style>
