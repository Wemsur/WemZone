<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useCamera, useCameraFrame } from '@/composables/useCamera'
import { CAMERA } from '@/engine/constants'
import { overviewOn } from '@/lib/overview'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 开发用总览层
 *
 * 打开后（调参面板的「总览」按钮，或按 O）：
 *  1. 让引擎把镜头拉到平面质心正前方、距离远到整个平面放得下；
 *  2. 在**世界坐标里**画出相机轨迹与各停靠点 —— 它跟着 3D 世界一起被
 *     投影，所以轨迹和区块在屏幕上的位置天然对齐，改几何参数时一眼能
 *     看出「路径是否仍穿过区块中心」。
 *
 * ## 为什么关掉区块的距离补偿
 *
 * 正常模式每个区块带 `scale(d_i / P)`，镜头在 d_i 处看它正好一屏。
 * 总览镜头在很远处，若仍带着这个补偿，区块会按 `d_i / d_总览` 缩成小点，
 * 而区块间距（72rem）不变 —— 看到的是「一串孤立的小块」，不是平面本身。
 * 所以总览时区块用 `compensate = false`（见 World.vue），世界尺寸回到
 * 设计尺寸，拉远后整张地图是等比例的。
 *
 * 轨迹的坐标是世界坐标（rem）。SVG 的 viewBox 直接取世界包围盒，
 * 元素尺寸也用 rem，于是 **1 个用户单位 = 1rem**，点直接写世界坐标即可。
 */
const camera = useCamera()

/** 当前停靠点。geometryVersion 变化时重算（引擎的 path 不是响应式的）。 */
const stops = computed(() => {
  void camera.geometryVersion.value
  return camera.engine.path.stops
})

const margin = 24
const bounds = computed(() => {
  const list = stops.value
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of list) {
    minX = Math.min(minX, s.x)
    maxX = Math.max(maxX, s.x)
    minY = Math.min(minY, s.y)
    maxY = Math.max(maxY, s.y)
  }
  // 一个区块大约就是一屏（宽高由 World.vue 按视口量出来），两边各留半个
  const halfW = viewportRem().w / 2
  const halfH = viewportRem().h / 2
  return {
    x: minX - halfW - margin,
    y: minY - halfH - margin,
    w: maxX - minX + halfW * 2 + margin * 2,
    h: maxY - minY + halfH * 2 + margin * 2,
  }
})

const viewBox = computed(() => {
  const b = bounds.value
  return `${b.x} ${b.y} ${b.w} ${b.h}`
})

const svgStyle = computed(() => {
  const b = bounds.value
  return {
    left: `${b.x}rem`,
    top: `${b.y}rem`,
    width: `${b.w}rem`,
    height: `${b.h}rem`,
  }
})

/** 相机轨迹：沿路径等距采样。 */
const pathPoints = computed(() => {
  void camera.geometryVersion.value
  const path = camera.engine.path
  const n = 240
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const p = path.sample((i / n) * path.last)
    pts.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`)
  }
  return pts.join(' ')
})

function viewportRem(): { w: number; h: number } {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return { w: window.innerWidth / root, h: window.innerHeight / root }
}

/**
 * 总览需要的镜头距离：让整个平面占屏幕的 `FILL`。
 *
 * 可见世界高度 = 视口高(rem) · d / P；要求 ≥ 平面高 / FILL。
 * 宽高各算一次取大者。
 */
const FILL = 0.78
function overviewDistance(): number {
  const P = CAMERA.PERSPECTIVE
  const vp = viewportRem()
  const b = bounds.value
  const dW = (b.w * P) / (vp.w * FILL)
  const dH = (b.h * P) / (vp.h * FILL)
  return Math.max(dW, dH)
}

function apply(): void {
  if (!overviewOn.value) {
    camera.engine.setOverview(false)
    return
  }
  camera.engine.setOverview(true, overviewDistance())
  // setOverview 的 emitFrame 发生在 v-if 挂载 SVG 之前，marker 还是 null；
  // 等 DOM 更新完再手动放一次，否则标记停在 (0, 0)。
  void nextTick(placeMarker)
}

/** 把相机标记放到「当前索引在轨迹上的位置」。 */
function placeMarker(): void {
  const el = marker.value
  if (!el) return
  const p = camera.engine.path.sample(camera.engine.displayIndex)
  el.setAttribute('cx', p.x.toFixed(2))
  el.setAttribute('cy', p.y.toFixed(2))
}

watch(overviewOn, apply)
watch(
  () => camera.geometryVersion.value,
  () => {
    if (overviewOn.value) apply()
  },
)

/* ---- 当前相机在轨迹上的位置 ---- */
const marker = ref<SVGCircleElement | null>(null)

useCameraFrame(() => placeMarker())

/* ---- 键盘：O 切换 ---- */
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'o' && e.key !== 'O') return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  overviewOn.value = !overviewOn.value
}

function onResize(): void {
  if (overviewOn.value) apply()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  if (overviewOn.value) apply()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  if (overviewOn.value) camera.engine.setOverview(false)
})
</script>

<template>
  <svg
    v-if="overviewOn"
    class="overview-svg"
    :viewBox="viewBox"
    :style="svgStyle"
    aria-hidden="true"
  >
    <!-- 轨迹 -->
    <polyline class="ov-path" :points="pathPoints" />

    <!-- 停靠点 + 区块名 -->
    <g v-for="(s, i) in stops" :key="s.id">
      <circle class="ov-stop" :cx="s.x" :cy="s.y" r="3.2" />
      <text class="ov-label" :x="s.x + 6" :y="s.y - 5">{{ ACTIVE_SECTIONS[i]?.label }}</text>
    </g>

    <!-- 相机当前位置 -->
    <circle ref="marker" class="ov-camera" r="4.4" />
  </svg>
</template>

<style scoped>
/* 0×0 的世界原点盒子里的绝对定位 SVG：位置与尺寸都由世界包围盒给出 */
.overview-svg {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  z-index: 5;
}

/* 线宽用 non-scaling-stroke：总览时整张图被缩到 ~0.13 倍，
   普通 stroke 会一起缩成看不见。 */
.ov-path {
  fill: none;
  stroke: var(--wz-brand);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 6 5;
  opacity: 0.85;
  vector-effect: non-scaling-stroke;
}

.ov-stop {
  fill: var(--wz-brand-soft);
  stroke: #0b0b0b;
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}

.ov-camera {
  fill: #fff;
  stroke: var(--wz-brand);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.ov-label {
  fill: var(--wz-text-tertiary);
  font-size: 4.6rem;
  font-family: var(--font-sans);
  opacity: 0.8;
}
</style>
