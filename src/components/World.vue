<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import Background from '@/components/Background.vue'
import OverviewLayer from '@/components/OverviewLayer.vue'
import { useCamera } from '@/composables/useCamera'
import { applyBlur, clearBlur, type BlurMode, type BlurTargets } from '@/engine/blur'
import { CAMERA } from '@/engine/constants'
import { staticSectionTransform } from '@/engine/world'
import { sectionBgMask } from '@/lib/bgMask'
import { overviewOn } from '@/lib/overview'
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

/** 总览层只在开发时挂载（它读引擎内部路径、画调试轨迹） */
const isDev = import.meta.env.DEV

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
    // 总览是看地图，不是运动：不要把它糊掉
    if (overviewOn.value) {
      clearBlur(targets)
      return
    }
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

/**
 * 每个区块的静态 transform（位置 + 距离补偿），启动时算一次。
 * 调参面板改了几何参数后，`geometryVersion` 变化会让这里重算。
 */
function sectionStyle(index: number): Record<string, string> {
  // 读取版本号建立响应式依赖（值本身不参与计算）。
  void camera.geometryVersion.value
  const stop = camera.engine.path.stops[index]
  // 总览时关掉距离补偿：镜头在很远处，按 d_i/P 补偿会让区块缩成小点、
  // 间距却不变，看到的就不是「整个平面」了。见 OverviewLayer.vue。
  return { transform: staticSectionTransform(stop, CAMERA.PERSPECTIVE, !overviewOn.value) }
}

/**
 * 让每个区块**占满视野**。
 *
 * 相机在距离 d 处看内容面时，可见世界范围是：
 *
 *     可见宽度(rem) = 视口宽(px) · d / P / 根字号(px)
 *
 * 但区块的静态 transform 里**已经带了** `scale(d/P)` 的距离补偿
 * （见 engine/world.ts）。所以这里不能再乘一次 `d/P` ——
 * 否则区块会被缩小两次，屏幕上只剩视野的 (d/P)²。
 *
 * 正确的写法是：区块在世界里占「一屏宽」（100vw 对应的 rem），
 * 距离补偿把它投到屏幕上正好是一屏。于是任意窗口尺寸、任意相机距离下，
 * 每个区块都恰好铺满视野。
 */
const probe = ref<HTMLElement | null>(null)
const viewportRem = reactive({ w: 0, h: 0 })

/** 区块出血系数：与 sectionSize() 里的 k 一致 */
const SECTION_BLEED = 1.04
/** 背景相对区块的高度倍率：与 main.css 的 .section-bg 一致 */
const BG_FACTOR = 2

/**
 * 区块背景的竖直渐隐带 —— 按真实几何算（见 lib/bgMask.ts）。
 *
 * 关键点是**渐隐带以两区中点为中心**：这样相邻两块背景在过渡时正好
 * 一进一出、在中点交汇；写死百分比时，默认间距下勉强成立，改间距就错位。
 */
function bgMaskStyle(index: number): Record<string, string> {
  if (viewportRem.h === 0) return {}
  void camera.geometryVersion.value
  const stops = camera.engine.path.stops
  const sectionH = viewportRem.h * SECTION_BLEED
  const prev = stops[index - 1]
  const next = stops[index + 1]
  const spacing =
    next && prev
      ? (next.y - prev.y) / 2
      : next
        ? next.y - stops[index].y
        : prev
          ? stops[index].y - prev.y
          : sectionH
  const { mask, heightPct } = sectionBgMask({ sectionH, bgFactor: BG_FACTOR, spacing })
  // 用连字符键：Vue 会对它们走 setProperty，`-webkit-` 前缀才会被原样保留
  return {
    'mask-image': mask,
    '-webkit-mask-image': mask,
    height: `${heightPct.toFixed(2)}%`,
  }
}

function measureViewport(): void {
  if (!probe.value) return
  const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  viewportRem.w = probe.value.clientWidth / rootFont
  viewportRem.h = probe.value.clientHeight / rootFont
}

let resizeObserver: ResizeObserver | null = null

/** 该区块内容应该占据的世界尺寸（rem）。 */
function sectionSize(): Record<string, string> {
  if (viewportRem.w === 0) return {}
  // 出血：空闲晃动会把整个视口平移最多约 13px，转场时还有最多 3.2° 的动态
  // 倾斜会让投影略微缩水。区块按 100% 给就会在晃动到极端时露出一条背景。
  // 4% 的出血保证任何姿态下都铺满视野（内容外侧应留出安全边距）。
  const k = SECTION_BLEED
  return {
    width: `${(viewportRem.w * k).toFixed(3)}rem`,
    height: `${(viewportRem.h * k).toFixed(3)}rem`,
  }
}
onMounted(() => {
  measureViewport()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measureViewport)
    if (probe.value) resizeObserver.observe(probe.value)
  }
  window.addEventListener('resize', measureViewport)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', measureViewport)
})
</script>

<template>
  <div id="stage">
    <!-- 视野探针：一个 100vw × 100vh 的隐形盒子，只用来量「一屏等于多少 rem」。
         放在 #viewport 外面，所以不受透视影响。 -->
    <div ref="probe" class="viewport-probe" aria-hidden="true" />

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
                :style="{ ...sectionStyle(i), ...sectionSize() }"
              >
                <!-- 该区块自己的背景：在 3D 世界里跟着区块一起移动。
                     尺寸比区块大，相邻区块的背景在区块之间重叠并交叉渐隐。 -->
                <div
                  :class="['section-bg', { 'section-bg--last': i === ACTIVE_SECTIONS.length - 1 }]"
                  :style="bgMaskStyle(i)"
                  aria-hidden="true"
                >
                  <Background :kind="section.background" :hue="section.hue ?? 18" />
                </div>

                <div class="section-content">
                  <slot :name="section.id" :index="i" />
                </div>
              </section>

              <!-- 开发用总览：轨迹与停靠点画在世界坐标里，跟着 3D 场景一起投影 -->
              <OverviewLayer v-if="isDev" />
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

/* 视野探针：只量尺寸，不参与渲染 */
.viewport-probe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  visibility: hidden;
}

.blur-svg {
  position: absolute;
  width: 0;
  height: 0;
}
</style>
