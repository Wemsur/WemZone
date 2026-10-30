<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { useCamera } from '@/composables/useCamera'
import type { BlurMode } from '@/engine/blur'
import { CAMERA } from '@/engine/constants'

/**
 * 调参面板（仅 DEV + 宽版）
 *
 * 直接读写 `CAMERA` 这个**可变普通对象** —— 引擎每帧现读，所以拖动滑块
 * 立刻生效，不需要重启或重建。几何类参数（间距 / 振幅 / 距离）改完调
 * `rebuildStops()` 让区块重排。
 *
 * 面板自身不进每帧循环：数值只在用户拖动时更新，HUD 那几项用低频定时器。
 */

const props = defineProps<{ blurMode: BlurMode }>()
const emit = defineEmits<{ 'update:blurMode': [BlurMode] }>()

const camera = useCamera()

/* ---- 常量定义：分组 + 范围 ---- */

interface Knob {
  key: keyof typeof CAMERA
  label: string
  min: number
  max: number
  step: number
  /** 改完需要重建路径（几何类） */
  geometry?: boolean
  /** 说明，悬停显示 */
  hint?: string
}

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: '手感 · 力学',
    knobs: [
      { key: 'PHYSICS_K', label: '势能强度 k', min: 5, max: 800, step: 5, hint: '越大越"紧"，切换越快；落位与果冻的硬度' },
      { key: 'PHYSICS_DAMPING', label: '阻尼 c', min: 0, max: 120, step: 0.5, hint: 'ζeff = c/(2√(2k))；0.6 左右 = 一次可见过冲后收敛' },
      { key: 'PHYSICS_ANCHOR_SATURATION', label: '锚定饱和距离', min: 0.05, max: 2, step: 0.05, hint: '越小起步越柔、整体越慢；越大越接近纯线性弹簧（起步猛）' },
      { key: 'PHYSICS_MAX_SPEED', label: '速度上限', min: 1, max: 30, step: 0.5 },
    ],
  },
  {
    title: '手感 · 滚动输入',
    knobs: [
      { key: 'PULL_FORCE_MAX', label: '最大推力', min: 0, max: 12, step: 0.1, hint: '果冻幅度主要由它决定' },
      { key: 'PULL_FORCE_SATURATION_PX', label: '推力饱和点 (px)', min: 5, max: 300, step: 5, hint: '越小越"一碰就动"' },
      { key: 'PULL_IMPULSE_MAX', label: '最大冲量', min: 0, max: 1, step: 0.01 },
      { key: 'PULL_IMPULSE_SATURATION_PX', label: '冲量饱和点 (px)', min: 5, max: 300, step: 5 },
      { key: 'PULL_MAX_DELTA', label: '单次位移上限 (px)', min: 40, max: 800, step: 10 },
    ],
  },
  {
    title: '阈值',
    knobs: [
      { key: 'STEP_THRESHOLD_PX', label: '切换阈值 (px)', min: 100, max: 2000, step: 10, hint: '越大越"只抖不切"' },
      { key: 'STEP_SPEED_PX_MS', label: '猛滑速度 (px/ms)', min: 0.5, max: 20, step: 0.5 },
      { key: 'STEP_SPEED_MIN_PX', label: '猛滑最小累计 (px)', min: 40, max: 800, step: 10 },
      { key: 'TRACKPAD_MAX_EVENT_PX', label: '触控板单事件上限', min: 5, max: 200, step: 1, hint: '超过就不算触控板式小步' },
      { key: 'GESTURE_GAP_MS', label: '手势间隔 (ms)', min: 40, max: 600, step: 10 },
      { key: 'GESTURE_COOLDOWN_MS', label: '提交后冷却 (ms)', min: 0, max: 1000, step: 10 },
    ],
  },
  {
    title: '空间几何',
    knobs: [
      { key: 'VERTICAL_SPACING', label: '区块间距 (rem)', min: 20, max: 200, step: 1, geometry: true },
      { key: 'LATERAL_AMPLITUDE', label: '左右振幅 (rem)', min: 0, max: 80, step: 1, geometry: true },
      { key: 'BASE_DISTANCE', label: '基准距离 (rem)', min: 10, max: 120, step: 1, geometry: true },
      { key: 'DISTANCE_JITTER', label: '距离抖动 (rem)', min: 0, max: 40, step: 1, geometry: true },
      { key: 'PERSPECTIVE', label: '透视距离 (rem)', min: 40, max: 400, step: 5, geometry: true },
    ],
  },
  {
    title: '动态倾斜',
    knobs: [
      { key: 'TILT_VEL_GAIN', label: '倾斜增益', min: 0, max: 120, step: 1 },
      { key: 'TILT_MAX_DEG', label: '倾斜封顶 (°)', min: 0, max: 15, step: 0.1 },
    ],
  },
  {
    title: '运动模糊',
    knobs: [
      { key: 'BLUR_SPEED_GAIN', label: '模糊增益 (px/速度)', min: 0, max: 10, step: 0.1 },
      { key: 'BLUR_MAX_PX', label: '模糊上限 (px)', min: 0, max: 24, step: 0.5 },
      { key: 'BLUR_DEADZONE', label: '模糊死区 (速度)', min: 0, max: 2, step: 0.01, hint: '越小越早开始糊' },
      { key: 'STRETCH_SPEED_GAIN', label: '拉伸增益', min: 0, max: 0.2, step: 0.001 },
      { key: 'STRETCH_MAX', label: '拉伸上限', min: 0, max: 0.4, step: 0.005 },
    ],
  },
]

/* ---- 持久化 ---- */

const STORAGE_KEY = 'wemzone.tuning.v1'

/** 当前值与默认值的快照。默认值在模块加载时抓一次，用于「恢复默认」。 */
const DEFAULTS: Record<string, number> = {}
for (const g of GROUPS) for (const k of g.knobs) DEFAULTS[k.key] = CAMERA[k.key] as number

/** 每次改动递增，用来触发滑块重绘（CAMERA 不是响应式的）。 */
const revision = ref(0)

function read(key: keyof typeof CAMERA): number {
  void revision.value
  return CAMERA[key] as number
}

function write(knob: Knob, value: number): void {
  const v = Number.isFinite(value) ? value : (DEFAULTS[knob.key] as number)
  ;(CAMERA as Record<string, number>)[knob.key] = v
  revision.value++
  save()
  if (knob.geometry) scheduleRebuild()
}

let rebuildTimer = 0
/** 几何参数拖动时每帧重建路径太浪费，合并成一次。 */
function scheduleRebuild(): void {
  if (rebuildTimer !== 0) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(() => {
    rebuildTimer = 0
    camera.rebuildStops()
  }, 120)
}

function save(): void {
  try {
    const out: Record<string, number> = {}
    for (const g of GROUPS) for (const k of g.knobs) out[k.key] = CAMERA[k.key] as number
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out))
  } catch {
    // 隐私模式 / 配额满：调参面板不该因此报错
  }
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as Record<string, number>
    for (const g of GROUPS) {
      for (const k of g.knobs) {
        if (typeof data[k.key] === 'number' && Number.isFinite(data[k.key])) {
          ;(CAMERA as Record<string, number>)[k.key] = data[k.key]
        }
      }
    }
    revision.value++
  } catch {
    // 损坏的存档：忽略，用默认值
  }
}

function resetAll(): void {
  for (const g of GROUPS) for (const k of g.knobs) (CAMERA as Record<string, number>)[k.key] = DEFAULTS[k.key]
  revision.value++
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  camera.rebuildStops()
}

/** 导出成可直接粘回 constants.ts 的片段。 */
const exported = ref('')
const copied = ref(false)

function exportValues(): void {
  const lines: string[] = []
  for (const g of GROUPS) {
    lines.push(`  /* ${g.title} */`)
    for (const k of g.knobs) {
      const v = CAMERA[k.key] as number
      lines.push(`  ${k.key}: ${Number.isInteger(v) ? v : Number(v.toFixed(4))},`)
    }
  }
  exported.value = lines.join('\n')
  copied.value = false
}

async function copyExport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exported.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* 剪贴板不可用：文本已经显示出来，可以手动选 */
  }
}

/* ---- HUD（低频） ---- */

const hud = reactive({ index: 0, state: 'IDLE', speed: 0 })
let hudTimer = 0

function sampleHud(): void {
  const f = camera.engine.displayIndex
  hud.index = Math.round(f * 1000) / 1000
  hud.state = camera.state.value
  // velocity 不在公开接口里；用两次采样估速度太粗糙，直接读状态名即可。
  hud.speed = 0
}

onMounted(() => {
  load()
  // 载入存档后几何可能已经变了，重建一次
  camera.rebuildStops()
  hudTimer = window.setInterval(sampleHud, 120)
})

onBeforeUnmount(() => {
  if (hudTimer !== 0) window.clearInterval(hudTimer)
  if (rebuildTimer !== 0) window.clearTimeout(rebuildTimer)
})

const blur = computed({
  get: () => props.blurMode,
  set: (v: BlurMode) => emit('update:blurMode', v),
})
</script>

<template>
  <aside class="tuner">
    <header class="tuner-head">
      <strong>调参面板</strong>
      <span class="mono">{{ hud.state }} · i={{ hud.index }}</span>
    </header>

    <div class="tuner-body">
      <section v-for="group in GROUPS" :key="group.title" class="group">
        <h3>{{ group.title }}</h3>

        <label v-for="knob in group.knobs" :key="knob.key" class="knob" :title="knob.hint">
          <span class="knob-label">{{ knob.label }}</span>
          <input
            type="range"
            :min="knob.min"
            :max="knob.max"
            :step="knob.step"
            :value="read(knob.key)"
            @input="write(knob, Number(($event.target as HTMLInputElement).value))"
          />
          <input
            class="knob-num"
            type="number"
            :min="knob.min"
            :max="knob.max"
            :step="knob.step"
            :value="read(knob.key)"
            @change="write(knob, Number(($event.target as HTMLInputElement).value))"
          />
        </label>
      </section>

      <section class="group">
        <h3>运动模糊方案</h3>
        <div class="seg">
          <button
            v-for="m in (['off', 'A', 'B'] as BlurMode[])"
            :key="m"
            :class="{ on: blur === m }"
            @click="blur = m"
          >
            {{ m === 'off' ? '关闭' : m }}
          </button>
        </div>
        <p class="note">按 B 键也可循环切换。模糊是速度的连续函数，没有开关阈值。</p>
      </section>

      <section class="group">
        <h3>操作</h3>
        <div class="actions">
          <button @click="resetAll">恢复默认</button>
          <button @click="exportValues">导出数值</button>
        </div>
        <pre v-if="exported" class="export">{{ exported }}</pre>
        <button v-if="exported" class="copy" @click="copyExport">
          {{ copied ? '已复制' : '复制到剪贴板' }}
        </button>
        <p class="note">改动会自动存到 localStorage，刷新后仍在。</p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.tuner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 60;
  width: 22rem;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wz-surface-5);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--wz-surface-2) 94%, transparent);
  backdrop-filter: blur(0.75rem);
  color: var(--wz-text-default);
  font-size: 0.75rem;
  user-select: none;
  box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 0.45);
}

.tuner-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--wz-surface-4);
  color: var(--wz-text-primary);
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: var(--wz-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.tuner-body {
  overflow-y: auto;
  padding: 0.25rem 0.875rem 0.875rem;
}

.group {
  padding-top: 0.625rem;
}

.group h3 {
  margin: 0 0 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wz-brand-soft);
}

.knob {
  display: grid;
  grid-template-columns: 1fr 5.5rem 3.6rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1875rem 0;
  cursor: pointer;
}

.knob-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

input[type='range'] {
  width: 100%;
  accent-color: var(--wz-brand);
  cursor: pointer;
}

.knob-num {
  width: 100%;
  padding: 0.125rem 0.25rem;
  border: 1px solid var(--wz-surface-4);
  border-radius: 0.25rem;
  background: var(--wz-surface-1);
  color: var(--wz-text-primary);
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.seg {
  display: flex;
  gap: 0.25rem;
}

.seg button,
.actions button,
.copy {
  flex: 1;
  padding: 0.3125rem 0.5rem;
  border: 1px solid var(--wz-surface-4);
  border-radius: 0.375rem;
  background: var(--wz-surface-1);
  color: var(--wz-text-default);
  font-size: 0.6875rem;
  cursor: pointer;
}

.seg button.on {
  border-color: var(--wz-brand);
  color: var(--wz-text-primary);
  background: var(--wz-brand-wash);
}

.actions {
  display: flex;
  gap: 0.375rem;
}

.copy {
  width: 100%;
  margin-top: 0.375rem;
}

.note {
  margin: 0.375rem 0 0;
  color: var(--wz-text-tertiary);
  font-size: 0.6875rem;
  line-height: 1.5;
}

.export {
  margin: 0.5rem 0 0;
  padding: 0.5rem;
  max-height: 12rem;
  overflow: auto;
  border-radius: 0.375rem;
  background: var(--wz-surface-1);
  color: var(--wz-text-tertiary);
  font-family: ui-monospace, monospace;
  font-size: 0.625rem;
  line-height: 1.45;
  user-select: text;
}
</style>
