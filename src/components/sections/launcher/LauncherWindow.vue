<script setup lang="ts">
import { CompassIcon, DownloadIcon, HomeIcon, LibraryIcon, SettingsIcon } from '@modrinth/assets'
import { getCurrentInstance, ref } from 'vue'

import { installLauncherUi, LauncherUiProvider } from '@/launcher-ui/install'

import AppearancePage from './AppearancePage.vue'

/**
 * Celestial Launcher 小窗（Phase 6 第 1 步：壳 + 外观设置页）
 *
 * 用户要求：「后续再替换为分层 + 真实启动器小窗」。这里就是那个小窗：
 *
 *  - **外壳是复刻的**：左侧图标栏 + 标题栏 + 内容区，用启动器的令牌
 *    （`--surface-*` / `--color-*`）绘制，与启动器同一套观感；
 *  - **内容是 vendor 的真实组件**（Card / Toggle / Button / 图标），不是仿制品；
 *  - **整个模块是异步加载的**：vendor 的 UI barrel 会拉进约 900KB 的组件库，
 *    而这一窗只在启动器区附近才会出现 —— 让它跟着这一块的 chunk 走。
 *
 * 启动器需要的插件（FloatingVue / vue-i18n / vue-query / router）在这里装到
 * app 上。`installLauncherUi` 是幂等的，热更新重复挂载不会重复注册。
 */
const inst = getCurrentInstance()
if (inst?.appContext.app) installLauncherUi(inst.appContext.app)

const NAV = [
  { id: 'home', label: '主页', icon: HomeIcon },
  { id: 'browse', label: '浏览', icon: CompassIcon },
  { id: 'downloads', label: '下载', icon: DownloadIcon },
  { id: 'instances', label: '实例', icon: LibraryIcon },
  { id: 'settings', label: '设置', icon: SettingsIcon },
]

/** 当前页。这一版只有外观设置是真的，其余是占位（Phase 6 后续步骤补齐） */
const active = ref('settings')
</script>

<template>
  <LauncherUiProvider>
    <div class="lw">
      <!-- 左侧图标栏 -->
      <aside class="lw-rail">
        <div class="lw-brand" aria-hidden="true">C</div>

        <button
          v-for="item in NAV"
          :key="item.id"
          class="lw-rail-btn"
          :class="{ active: active === item.id }"
          type="button"
          :aria-label="item.label"
          :aria-current="active === item.id ? 'page' : undefined"
          @click="active = item.id"
        >
          <component :is="item.icon" class="lw-rail-icon" />
        </button>
      </aside>

      <!-- 内容区 -->
      <div class="lw-main">
        <header class="lw-titlebar">
          <span class="lw-title">Celestial</span>
          <span class="lw-sub">启动器预览</span>
        </header>

        <div class="lw-body">
          <AppearancePage v-if="active === 'settings'" />
          <div v-else class="lw-empty">
            <p>这一页还在复刻中。</p>
            <p class="lw-empty-hint">点左侧的设置图标回到外观设置。</p>
          </div>
        </div>
      </div>
    </div>
  </LauncherUiProvider>
</template>

<style scoped>
.lw {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--surface-4);
  border-radius: 0.6rem;
  background: var(--surface-2);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  box-shadow:
    0 1.6rem 4rem rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.04);
}

/* --- 左栏 --- */
.lw-rail {
  flex: 0 0 2.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.55rem 0;
  background: var(--surface-1);
  border-right: 1px solid var(--surface-3);
}

.lw-brand {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  margin-bottom: 0.45rem;
  border-radius: 0.45rem;
  background: var(--color-brand);
  color: var(--color-accent-contrast);
  font-weight: 700;
  font-size: 0.85rem;
}

.lw-rail-btn {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.lw-rail-btn:hover {
  background: var(--surface-3);
  color: var(--color-text-primary);
}

.lw-rail-btn.active {
  background: var(--surface-4);
  color: var(--color-text-primary);
}

.lw-rail-icon {
  width: 1.05rem;
  height: 1.05rem;
}

/* --- 主区 --- */
.lw-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.lw-titlebar {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--surface-3);
}

.lw-title {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.lw-sub {
  font-size: 0.66rem;
  color: var(--color-text-tertiary);
}

.lw-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.8rem 0.9rem 1rem;
  /* 滚动条压细，别抢画面的注意力 */
  scrollbar-width: thin;
}

.lw-empty {
  display: grid;
  place-content: center;
  gap: 0.3rem;
  height: 100%;
  text-align: center;
  color: var(--color-text-tertiary);
}

.lw-empty-hint {
  font-size: 0.68rem;
  opacity: 0.75;
}
</style>
