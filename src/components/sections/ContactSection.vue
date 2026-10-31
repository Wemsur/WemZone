<script setup lang="ts">
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
 * **待补**：B 站空间地址与邮箱。GitHub 已确认是 Wemsur。
 */
const LINKS = [
  { label: 'GitHub', href: 'https://github.com/Wemsur', hint: '@Wemsur' },
  // TODO(等待用户提供)：B 站 UID / 空间地址
  { label: 'Bilibili', href: 'https://space.bilibili.com/', hint: '@Wemsur' },
  // TODO(等待用户提供)：邮箱
  { label: 'Email', href: 'mailto:', hint: '待补充' },
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
  padding: 2rem;
  box-sizing: border-box;
  text-align: center;
}

.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  color: var(--wz-text-tertiary);
  opacity: 0.7;
}

.statement {
  margin: 0;
  font-size: 1.6rem;
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
  font-size: 1rem;
  letter-spacing: 0.08em;
  transition: color 200ms ease;
}

.hint {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
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
</style>
