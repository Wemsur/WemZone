<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import Wordmark from '@/assets/wemzone-wordmark.svg?component'
import { useCamera, useCameraFrame } from '@/composables/useCamera'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 首页顶部栏
 *
 * 用户要求：
 *   「首页只是使用顶部一个轻微的渐变（直接显示在浏览窗口顶部）上面放：
 *     logo + 庭域WemZone，右侧放 github 图标、bilibili 图标什么的，
 *     然后最右侧有三个横杠的图标，点击出现下拉框用于导航到下面的位置」
 *   「首页的顶部需要在滑动向下一个页面时快速消失（上滑 + 渐隐），
 *     而回到首页区域的时候顶栏又要回来」
 *
 * 所以它是 **screen-space** 的（直接贴在窗口顶部，不随 3D 世界倾斜），
 * 可见性由相机连续索引驱动：离开首页时上滑淡出，回到首页时滑下淡入。
 *
 * 注意：首页没有「统一卡片」—— 那张卡是给其它区块用的，首屏用这条顶栏代替。
 */
const camera = useCamera()

const bar = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

/** 只有相机接近首页时才可见。0.55 是「滑动多少就开始消失」。 */
const HIDE_AT = 0.55

useCameraFrame((frame) => {
  const el = bar.value
  if (!el) return
  const t = Math.max(0, Math.min(1, 1 - frame.index / HIDE_AT))
  // 上滑 + 渐隐：t=1 在原位，t=0 完全移出屏幕顶部
  el.style.opacity = t.toFixed(3)
  el.style.transform = `translate3d(0, ${(-(1 - t) * 120).toFixed(2)}%, 0)`
  el.style.pointerEvents = t > 0.6 ? 'auto' : 'none'
})

/** 下拉菜单：点外面 / Esc 关闭 */
function onDocPointerDown(e: PointerEvent): void {
  if (!menuOpen.value) return
  const target = e.target as Node | null
  if (bar.value && target && bar.value.contains(target)) return
  menuOpen.value = false
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKey)
})

function go(index: number): void {
  menuOpen.value = false
  camera.goTo(index)
}
</script>

<template>
  <header ref="bar" class="topbar">
    <!-- 轻微的顶部渐变，不是一条实心栏 -->
    <div class="topbar-fade" aria-hidden="true" />

    <div class="topbar-inner">
      <a class="brand" href="#home" @click.prevent="go(0)">
        <!-- logo：与 favicon 同一笔 W -->
        <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M7 10l4 12 5-8 5 8 4-12"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="name">庭域</span>
        <Wordmark class="wordmark" aria-label="WemZone" role="img" />
      </a>

      <div class="actions">
        <a
          class="icon"
          href="https://github.com/Wemsur"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
        </a>

        <a
          class="icon"
          href="https://space.bilibili.com/1826712095"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="哔哩哔哩"
        >
          <!-- 简化的 B 站电视机：圆角矩形 + 两根天线 -->
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6.4 3.2 9 5.6h6L17.6 3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <rect
              x="2.6"
              y="5.6"
              width="18.8"
              height="13.6"
              rx="4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M8.4 10.4v3.4M15.6 10.4v3.4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </a>

        <button
          class="icon menu-btn"
          type="button"
          :aria-expanded="menuOpen"
          aria-label="导航"
          @click="menuOpen = !menuOpen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 导航下拉 -->
    <nav v-if="menuOpen" class="menu" aria-label="区块导航">
      <button
        v-for="(section, i) in ACTIVE_SECTIONS"
        :key="section.id"
        class="menu-item"
        :class="{ current: camera.current.value === i }"
        type="button"
        @click="go(i)"
      >
        <span class="menu-index">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="menu-label">{{ section.label }}</span>
      </button>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  pointer-events: none;
  will-change: transform, opacity;
}

/* 轻微渐变：从顶部一点暗色过渡到完全透明，不是一条实心栏 */
.topbar-fade {
  position: absolute;
  inset: 0;
  height: 9rem;
  background: linear-gradient(
    to bottom,
    rgb(10 10 10 / 0.55) 0%,
    rgb(10 10 10 / 0.22) 42%,
    transparent 100%
  );
  mask-image: linear-gradient(to bottom, #000 0%, #000 60%, transparent 100%);
}

.topbar-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.6rem;
  pointer-events: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--wz-text-primary);
  text-decoration: none;
}

.mark {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--wz-brand-soft);
}

.name {
  font-family: 'XuanZong', serif;
  font-size: 1.35rem;
  line-height: 1;
  letter-spacing: 0.04em;
}

.wordmark {
  height: 0.72rem;
  width: auto;
  color: var(--wz-brand-soft);
  transform: translateY(0.04rem);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.icon {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--wz-text-tertiary);
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease;
}

/* 不重要的按钮不要边框：悬停时只给一点底色与提亮 */
.icon:hover {
  color: var(--wz-text-primary);
  background: rgb(255 255 255 / 0.05);
}

.icon svg {
  width: 1.15rem;
  height: 1.15rem;
}

.menu-btn {
  padding: 0;
}

.menu {
  position: absolute;
  top: calc(100% - 0.2rem);
  right: 1.4rem;
  min-width: 14rem;
  padding: 0.4rem;
  border: 1px solid var(--wz-surface-4);
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--wz-surface-2) 94%, transparent);
  backdrop-filter: blur(0.75rem);
  box-shadow: 0 0.8rem 2.4rem rgb(0 0 0 / 0.45);
  pointer-events: auto;
  display: grid;
  gap: 0.1rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--wz-text-tertiary);
  font-size: 0.86rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.menu-item:hover {
  background: rgb(255 255 255 / 0.05);
  color: var(--wz-text-primary);
}

.menu-item.current {
  color: var(--wz-text-primary);
}

.menu-index {
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
  color: var(--wz-brand-soft);
  opacity: 0.75;
}

.menu-item.current .menu-index {
  opacity: 1;
}
</style>
