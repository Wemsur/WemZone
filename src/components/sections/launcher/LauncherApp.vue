<script setup lang="ts">
import LauncherRoot from '@launcher/App.vue'
import launcherRouter from '@launcher/routes'
import { getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'

import { installLauncherUi, LauncherUiProvider } from '@/launcher-ui/install'

/**
 * 启动器页面复刻（Phase 6）
 *
 * **这一层不画任何界面**：里面就是 `CelestialLauncher/apps/app-frontend/src/App.vue`
 * 原样复制过来的那份应用（`src/launcher-app/`）。视觉、布局、路由、页面
 * 全部来自启动器本人的代码；我们只做两件事：
 *
 *  1. 把 Tauri 的 IPC 换成 `src/launcher-app-mock/` 的替身（数据硬编码）；
 *  2. 给这份应用装到 WemZone 的 Vue app 上（插件 / provider / 路由）。
 *
 * 尺寸：启动器窗口的逻辑尺寸是 **1280×800**（Tauri 配置里的默认窗口）。
 * 这里固定成这个尺寸再整体 `scale`，所以任何容器里都保持启动器的真实比例，
 * 不会因为嵌入位置不同而变形。
 */
const LOGICAL_W = 1280
const LOGICAL_H = 800

const stage = ref<HTMLElement | null>(null)
const outer = ref<HTMLElement | null>(null)
const scale = ref(0)

function fit(): void {
  const el = outer.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  scale.value = Math.min(w / LOGICAL_W, h / LOGICAL_H)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  fit()
  if (typeof ResizeObserver !== 'undefined' && outer.value) {
    ro = new ResizeObserver(fit)
    ro.observe(outer.value)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

// 插件必须在 setup 的同步阶段装上：子组件（App.vue）的 setup 会立刻
// inject i18n / vue-query / router 这些 provider，晚一步就会 throw。
const inst = getCurrentInstance()
if (inst?.appContext.app) {
  installLauncherUi(inst.appContext.app, { router: launcherRouter })
}
</script>

<template>
  <div ref="outer" class="launcher-outer">
    <div
      ref="stage"
      class="launcher-stage"
      :style="{
        width: `${LOGICAL_W}px`,
        height: `${LOGICAL_H}px`,
        transform: `scale(${scale || 1})`,
      }"
    >
      <LauncherUiProvider>
        <LauncherRoot />
      </LauncherUiProvider>
    </div>
  </div>
</template>

<style scoped>
.launcher-outer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 0.55rem;
  background: var(--surface-1);
  box-shadow:
    0 1.6rem 4rem rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.06);
}

.launcher-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
  overflow: hidden;
}
</style>
