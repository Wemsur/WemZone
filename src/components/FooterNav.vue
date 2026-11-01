<script setup lang="ts">
import { useCamera } from '@/composables/useCamera'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 页脚导航行
 *
 * 左侧是五个区块简名（点击**瞬间**跳过去），右侧是 GitHub / B 站。
 * 只是一个「行」，定位交给宿主：
 *  - 宽版：`SiteFooter.vue` 把它固定在视口底部（screen-space，不随相机晃动）；
 *  - 窄版：直接放在联系区内部（原生滚动，跟着页面走）。
 */
const camera = useCamera()

function go(i: number): void {
  camera.goTo(i, { immediate: true })
}
</script>

<template>
  <div class="footer-row">
    <nav class="foot-nav" aria-label="区块导航">
      <button
        v-for="(s, i) in ACTIVE_SECTIONS"
        :key="s.id"
        class="foot-link"
        :class="{ current: camera.current.value === i }"
        type="button"
        @click="go(i)"
      >
        {{ s.short ?? s.label }}
      </button>
    </nav>

    <div class="foot-social">
      <a
        class="foot-icon"
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
        class="foot-icon"
        href="https://space.bilibili.com/1826712095"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="哔哩哔哩"
      >
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
    </div>
  </div>
</template>

<style scoped>
.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 3rem calc(0.9rem + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  border-top: 1px solid rgb(255 255 255 / 0.06);
}

.foot-nav {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  flex-wrap: wrap;
}

.foot-link {
  padding: 0.1rem 0;
  border: 0;
  background: transparent;
  color: var(--wz-text-tertiary);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 180ms ease;
}

.foot-link:hover {
  color: var(--wz-text-primary);
}

.foot-link.current {
  color: var(--wz-brand-soft);
}

.foot-social {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.foot-icon {
  display: grid;
  place-items: center;
  color: var(--wz-text-tertiary);
  transition: color 180ms ease;
}

.foot-icon:hover {
  color: var(--wz-text-primary);
}

.foot-icon svg {
  width: 1.05rem;
  height: 1.05rem;
}

@media (max-width: 900px) and (orientation: portrait) {
  .footer-row {
    padding: 0.8rem 1.35rem calc(0.8rem + env(safe-area-inset-bottom, 0px));
  }
  .foot-nav {
    gap: 0.9rem;
  }
  .foot-link {
    font-size: 0.74rem;
  }
}
</style>
