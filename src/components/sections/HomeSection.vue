<script setup lang="ts">
import Wordmark from '@/assets/wemzone-wordmark.svg?component'

/**
 * 首页内容
 *
 * 站点名是**一个整体标识**：「庭域」用玄宗体（SIL OFL，可嵌入），
 * 紧跟「WemZone」—— 后者用飞扬体的 7 个字母转成的静态 SVG。
 *
 * 铁律：任何时候出现「庭域」，后面必须跟着 WemZone。
 * 所以这两段永远在同一个 lockup 里，不拆开、不单独使用「庭域」。
 *
 * 一言与顶栏在后续步骤接入（Phase 4.2 的剩余部分）。
 */
</script>

<template>
  <div class="home">
    <div class="lockup">
      <span class="tingyu">庭域</span>
      <Wordmark class="wordmark" aria-label="WemZone" role="img" />
    </div>
    <p class="tagline">Wemsur?那是个什么</p>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1.1rem;
  padding: 2rem;
  box-sizing: border-box;
  text-align: center;
}

.lockup {
  display: flex;
  align-items: baseline;
  gap: 0.9rem;
  /* 让标识在背景的呼吸光晕上略微「浮」起来 */
  filter: drop-shadow(0 0 2.4rem hsl(var(--wz-brand-hue) 60% 50% / 0.22));
}

.tingyu {
  font-family: 'XuanZong', serif;
  font-size: 5.6rem;
  line-height: 0.92;
  letter-spacing: 0.04em;
  color: var(--wz-text-primary);
  /* 玄宗体本身笔画很重，稍微压一点亮度免得抢过 WemZone */
  opacity: 0.94;
}

.wordmark {
  height: 2.05rem;
  width: auto;
  color: var(--wz-brand-soft);
  /* SVG 的 viewBox 基线在字体 ascender 上，往下压一点与汉字视觉对齐 */
  transform: translateY(0.08rem);
}

.tagline {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.16em;
  color: var(--wz-text-tertiary);
  opacity: 0.85;
}

@media (max-width: 900px) and (orientation: portrait) {
  .tingyu {
    font-size: 4rem;
  }
  .wordmark {
    height: 1.5rem;
  }
}
</style>
