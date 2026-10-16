<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { BlurMode } from '@/engine/blur'

/**
 * 运动模糊 A/B 调试面板（Phase 2 临时，Phase 5 会并入正式调参面板）
 *
 * 同一场景、同一条转场，A/B 即时切换，并显示实时帧率，
 * 用来判断哪个方案可以作生产方案。
 */

const props = defineProps<{ modelValue: BlurMode }>()
const emit = defineEmits<{ 'update:modelValue': [BlurMode] }>()

const fps = ref(0)
const frameMs = ref(0)
const worstMs = ref(0)

let raf = 0
let last = 0
let acc = 0
let count = 0
let worst = 0
let windowStart = 0

/**
 * 只在**转场期间**采样。
 *
 * 静止时引擎根本不排 rAF（这是设计目标），若常驻采样，测到的会是
 * 「预览标签页自己的 rAF」而不是引擎的开销，数字没有意义。
 * 所以面板自己也只在有帧的时候统计，空闲时显示 `—`。
 */
function tick(now: number): void {
  raf = 0
  if (last !== 0) {
    const dt = now - last
    frameMs.value = dt
    acc += dt
    count++
    if (dt > worst) worst = dt
  }
  last = now

  if (windowStart === 0) windowStart = now
  if (now - windowStart >= 500) {
    fps.value = count > 0 ? Math.round((count * 1000) / (now - windowStart)) : 0
    worstMs.value = Math.round(worst)
    acc = 0
    count = 0
    worst = 0
    windowStart = now
  }

  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (raf !== 0) cancelAnimationFrame(raf)
})

const options: { value: BlurMode; label: string }[] = [
  { value: 'off', label: '关闭' },
  { value: 'A', label: 'A 各向同性 + 拉伸 + 拖影' },
  { value: 'B', label: 'B SVG 各向异性' },
]

const current = computed({
  get: () => props.modelValue,
  set: (v: BlurMode) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="panel">
    <div class="row title">运动模糊 A/B</div>

    <label v-for="opt in options" :key="opt.value" class="row option">
      <input v-model="current" type="radio" :value="opt.value" />
      <span>{{ opt.label }}</span>
    </label>

    <div class="row stats">
      <span>{{ fps }} fps</span>
      <span>帧 {{ frameMs.toFixed(1) }}ms</span>
      <span>峰值 {{ worstMs }}ms</span>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 1rem;
  top: 1rem;
  z-index: 50;
  display: grid;
  gap: 0.375rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--surface-5);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--surface-2) 92%, transparent);
  backdrop-filter: blur(0.5rem);
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
  user-select: none;
}

.title {
  color: var(--color-text-primary);
  font-weight: 600;
  margin-bottom: 0.125rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option {
  cursor: pointer;
}

.option input {
  cursor: pointer;
  accent-color: var(--color-brand);
}

.stats {
  gap: 0.75rem;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-4);
  font-family: ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
</style>
