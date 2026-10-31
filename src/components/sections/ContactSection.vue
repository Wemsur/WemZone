<script setup lang="ts">
import { useCamera } from '@/composables/useCamera'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 联系区
 *
 * 用户要求（原文）：
 *   「各平台入口 + 邮箱」
 *   「最安静的一屏，几乎只有渐变」
 *   「没有备案什么的信息」
 *   「这页没有『统一卡片』而是重新融入到页面中」
 *
 * 所以这里没有卡片、没有光晕、没有点阵 —— 只有几行文字与链接。
 * 统一卡片在这一区自动淡出（见 `UnifiedCard.vue` 的可见度曲线）。
 *
 */
const camera = useCamera()

/** 页脚导航：点击**瞬间**跳过去，不走相机轨迹 */
function go(i: number): void {
  camera.goTo(i, { immediate: true })
}

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/Wemsur', hint: '@Wemsur' },
  { label: 'Bilibili', href: 'https://space.bilibili.com/1826712095', hint: '1826712095' },
  { label: 'Email', href: 'mailto:iexamplecom@outlook.com', hint: 'iexamplecom@outlook.com' },
]
</script>

<template>
  <div class="contact">
    <p class="eyebrow">联系</p>
    <h2 class="statement">想聊点什么的话。</h2>

    <ul class="links">
      <li v-for="l in LINKS" :key="l.label">
        <a
          class="link"
          :href="l.href"
          :target="l.href.startsWith('mailto:') ? undefined : '_blank'"
          :rel="l.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'"
        >
          <span class="label">{{ l.label }}</span>
          <span class="hint">{{ l.hint }}</span>
        </a>
      </li>
    </ul>

    <!-- 页脚：整行。左侧是五个区块简名，右侧是外部链接 -->
    <footer class="footer">
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
    </footer>
  </div>
</template>

<style scoped>
.contact {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.4rem;
  /* 底部留出页脚那一行 */
  padding: 2rem 2rem 6.6rem;
  box-sizing: border-box;
  text-align: center;
}

.eyebrow {
  margin: 0;
  font-size: 0.86rem;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  color: var(--wz-text-tertiary);
  opacity: 0.7;
}

.statement {
  margin: 0;
  font-size: 2.3rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--wz-text-primary);
}

.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem 2.6rem;
  margin: 1.2rem 0 0;
  padding: 0;
  list-style: none;
}

/* 不重要的按钮不要边框：只有文字，悬停时底部浮起一层柔光 */
.link {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 0.2rem;
  color: var(--wz-text-default);
  text-decoration: none;
  position: relative;
}

.label {
  font-size: 1.2rem;
  letter-spacing: 0.08em;
  transition: color 200ms ease;
}

.hint {
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
  color: var(--wz-text-tertiary);
  opacity: 0.65;
}

/* 悬停：文字提亮 + 下方一道很淡的品牌色光晕（不是下划线） */
.link::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0.15rem;
  width: 60%;
  height: 0.7rem;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse, hsl(var(--wz-brand-hue) 68% 55% / 0.45), transparent 70%);
  opacity: 0;
  filter: blur(0.25rem);
  transition: opacity 240ms ease;
  pointer-events: none;
}

.link:hover .label {
  color: var(--wz-text-primary);
}

.link:hover::after {
  opacity: 1;
}

/* --- 页脚 --- */
.footer {
  position: absolute;
  left: 0;
  right: 0;
  /* 区块比视口大 4%（出血），底边在屏幕外 2%；空闲晃动还会让整个世界
     上下浮动约 19px —— 页脚要贴在可见底边内侧，取 4.5% 才不会被晃出屏幕 */
  bottom: 4.5%;
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
  .contact {
    gap: 1rem;
    padding: 2rem 1.35rem 4.4rem;
  }
  .statement {
    font-size: 1.72rem;
    line-height: 1.45;
    text-wrap: balance;
  }
  .links {
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    margin-top: 0.9rem;
  }
  .label {
    font-size: 1.05rem;
  }
  .hint {
    font-size: 0.72rem;
  }
  .footer {
    bottom: 0;
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
