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
const feBlurEl = ref<SVGFEGaussianBlurElement | null>(null)

let detach: (() => void) | null = null
let stopFrame: (() => void) | null = null

onMounted(() => {
  if (!worldEl.value) return
  detach = camera.attachTo(worldEl.value)
  camera.goTo(0, { immediate: true })

  const targets: BlurTargets = {
    layer: layerEl.value!,
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
  if (layerEl.value) {
    clearBlur({ layer: layerEl.value, feBlur: feBlurEl.value })
  }
  detach?.()
  detach = null
})

/** 每个区块的静态 transform（位置 + 距离补偿），启动时算一次。
 *  调参面板改了几何参数后，`geometryVersion` 变化会让这里重算。 */
function sectionStyle(index: number): Record<string, string> {
  // 读取版本号建立响应式依赖（值本身不参与计算）。
  void camera.geometryVersion.value
  const stop = camera.engine.path.stops[index]
  return { transform: staticSectionTransform(stop, CAMERA.PERSPECTIVE) }
}
</script>

<template>
  <div id="stage">
    <!-- 模糊层：filter 是分组属性，会让这一层的 transform-style 变成 flat，
         而 flat 会**截断透视**（#viewport 的 perspective 传到这里就不再往下传）。
         所以它必须在 #viewport 的**外面** —— 3D 场景先正确渲染完，
         再对渲染结果做模糊。 -->
    <div ref="layerEl" class="blur-layer">
      <!-- 空闲晃动的**平移**分量：刻意放在 #viewport 外面。
           在透视容器内做平移会被投影放大（内容在 z≈1300px 处，放大 3.5 倍），
           实测 0.85rem 的位移会变成 153px 的屏幕偏移，完全不是「轻微」。 -->
      <div class="drift-outer">
        <div id="viewport" :style="{ '--perspective': `${CAMERA.PERSPECTIVE}rem` }">
          <!-- 空闲晃动的**旋转**分量：必须留在透视里。
               旋转让不同深度的内容移动不同距离，这才是「相机在浮动」的观感；
               视口边缘横移几个像素读起来只是「整页在滑」。 -->
          <div class="drift-inner">
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

.blur-svg {
  position: absolute;
  width: 0;
  height: 0;
}
</style>
