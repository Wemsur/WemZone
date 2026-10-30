<script setup lang="ts">
/**
 * Phase 1.5 验收页：渲染**真正的** @modrinth/ui 组件，用来肉眼确认
 * vendor 管线（alias / SVG loader / Tailwind preset / i18n / provider）全部通了。
 *
 * 这不是最终页面 —— Phase 4 会用真实内容替换。这里只做「同一性」对照：
 * 左边是 vendor 的 Button，右边是同一份 Button 源码在启动器里的样子，
 * 用来快速发现「结构对但没样式」这类接线错误。
 */
import { SpinnerIcon } from '@modrinth/assets'
import { Button, IconButton, IntlFormatted, Toggle } from '@modrinth/ui'
import { ref } from 'vue'

import { LauncherUiProvider } from '@/launcher-ui/install'

const clicked = ref(0)
const loading = ref(false)
const toggled = ref(true)

function onClick(): void {
  clicked.value++
  loading.value = true
  window.setTimeout(() => (loading.value = false), 900)
}
</script>

<template>
  <LauncherUiProvider>
    <section class="vendor-demo">
      <h1 class="vendor-demo__title">Phase 1.5 · vendor 组件验收</h1>
      <p class="vendor-demo__lead">
        下面每个按钮都是 vendor 进来的 <code>@modrinth/ui</code> 原组件，未做任何包装。
      </p>

      <div class="vendor-demo__row">
        <Button>默认按钮</Button>
        <Button type="colored" color="brand">品牌色</Button>
        <Button type="outlined" color="blue">描边</Button>
        <Button type="quiet">安静</Button>
      </div>

      <div class="vendor-demo__row">
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button size="md">md</Button>
        <Button size="lg">lg</Button>
        <Button size="xl">xl</Button>
      </div>

      <div class="vendor-demo__row">
        <Button :loading="loading" @click="onClick">
          <SpinnerIcon v-if="loading" />
          点我（{{ clicked }}）
        </Button>
        <Button disabled>禁用</Button>
        <IconButton label="图标按钮">
          <SpinnerIcon />
        </IconButton>
      </div>

      <div class="vendor-demo__row">
        <Toggle v-model="toggled" />
        <span class="vendor-demo__value">Toggle: {{ toggled }}</span>
        <!-- IntlFormatted 直接依赖 injectI18n()，是 useVIntl 那条链的代表 -->
        <IntlFormatted :message-id="{ id: 'label.yes' }" />
      </div>

      <p class="vendor-demo__hint">
        检查点：按钮高度/圆角/字重/内阴影是否与启动器一致；hover 是否变亮；
        图标是否随按钮尺寸缩放（<code>removeViewBox: false</code> 生效的证据）。
      </p>
    </section>
  </LauncherUiProvider>
</template>

<style scoped>
.vendor-demo {
  /* 尺寸由 .world-section 按视野给（width/height 内联），这里只管填满。
     早先写死 46rem 并注释「与占位方块一致」—— 那正是区块只占视野 45% 的
     来源：区块尺寸被内容反向决定，而相机距离 d 根本没有参与。 */
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--surface-2) 62%, transparent);
  border: 1px solid var(--surface-4);
}

.vendor-demo__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-contrast);
}

.vendor-demo__lead,
.vendor-demo__hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-base);
}

.vendor-demo__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.vendor-demo__value {
  font-size: 0.875rem;
  color: var(--color-base);
}

code {
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
  background: var(--surface-4);
  font-family: var(--mono-font);
  font-size: 0.9em;
}
</style>
