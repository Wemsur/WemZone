<script setup lang="ts">
import { Button, Card, Toggle } from '@modrinth/ui'
import { ref } from 'vue'

/**
 * 启动器 · 外观设置页（Phase 6 第 1 页）
 *
 * 用的是 vendor 的**真实组件**（Card / Toggle / Button），不是仿制品。
 * 文案是 WemZone 自己的中文（站点语言），控件行为留在本地状态 ——
 * 这一版是「壳 + 第一页」的可视复刻，真正接启动器的设置后端的部分在
 * Phase 6 后续步骤里补（届时用 mock invoke 层）。
 *
 * 页面内容按启动器外观设置的常见项来排：主题色、背景、动效。
 */
const COLORS = ['#db6944', '#3aa675', '#3b82f6', '#a855f7', '#e11d48', '#f59e0b']

const themeColor = ref<string>(COLORS[0])
const background = ref<'default' | 'custom'>('default')
const animations = ref(true)
const blur = ref(true)
</script>

<template>
  <div class="appearance">
    <h2 class="title">外观设置</h2>
    <p class="lead">主题色、背景与界面动效。</p>

    <Card>
      <template #header>
        <span class="card-title">主题色</span>
      </template>

      <div class="swatches">
        <button
          v-for="c in COLORS"
          :key="c"
          class="swatch"
          :class="{ on: themeColor === c }"
          type="button"
          :style="{ background: c }"
          :aria-label="`主题色 ${c}`"
          :aria-pressed="themeColor === c"
          @click="themeColor = c"
        />
      </div>

      <div class="preview">
        <span class="preview-dot" :style="{ background: themeColor }" />
        <Button type="colored" :color="'brand'">主按钮</Button>
        <Button type="outlined">次按钮</Button>
      </div>
    </Card>

    <Card>
      <template #header>
        <span class="card-title">背景</span>
      </template>

      <div class="tiles">
        <button
          class="tile"
          type="button"
          :class="{ on: background === 'default' }"
          @click="background = 'default'"
        >
          <span class="tile-art tile-art--default" />
          <span class="tile-label">默认</span>
        </button>
        <button
          class="tile"
          type="button"
          :class="{ on: background === 'custom' }"
          @click="background = 'custom'"
        >
          <span class="tile-art tile-art--custom" />
          <span class="tile-label">自定义图片</span>
        </button>
      </div>
    </Card>

    <Card>
      <template #header>
        <span class="card-title">界面</span>
      </template>

      <div class="row">
        <span class="row-label">界面动效</span>
        <Toggle v-model="animations" />
      </div>
      <div class="row">
        <span class="row-label">背景模糊</span>
        <Toggle v-model="blur" />
      </div>
    </Card>
  </div>
</template>

<style scoped>
.appearance {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.lead {
  margin: -0.45rem 0 0;
  font-size: 0.75rem;
  color: var(--color-secondary);
}

.card-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.swatches {
  display: flex;
  gap: 0.45rem;
  padding: 0.1rem 0 0.55rem;
}

.swatch {
  width: 1.35rem;
  height: 1.35rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition:
    transform 160ms ease,
    outline-color 160ms ease;
}

.swatch:hover {
  transform: scale(1.1);
}

.swatch.on {
  outline-color: var(--color-text-primary);
}

.preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  margin-right: 0.15rem;
}

.tiles {
  display: flex;
  gap: 0.55rem;
}

.tile {
  flex: 1;
  padding: 0.35rem;
  border: 1px solid var(--surface-4);
  border-radius: 0.5rem;
  background: var(--surface-1);
  cursor: pointer;
  transition: border-color 160ms ease;
}

.tile.on {
  border-color: var(--color-brand);
}

.tile-art {
  display: block;
  height: 2.4rem;
  border-radius: 0.35rem;
}

.tile-art--default {
  background:
    radial-gradient(ellipse 60% 80% at 30% 30%, #3a3633 0%, transparent 70%),
    linear-gradient(150deg, #232323, #161616);
}

.tile-art--custom {
  background:
    radial-gradient(ellipse 60% 80% at 70% 30%, #3d4a5c 0%, transparent 70%),
    linear-gradient(150deg, #2a3340, #15181d);
}

.tile-label {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.68rem;
  color: var(--color-secondary);
  text-align: center;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.22rem 0;
}

.row-label {
  font-size: 0.75rem;
  color: var(--color-text-primary);
}
</style>
