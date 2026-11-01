<script setup lang="ts">
import { PROJECTS } from '@/data/projects'
import { ACTIVE_SECTIONS } from '@/sections'

/**
 * 打印版
 *
 * 整站是「一块 3D 平面 + 固定舞台」，直接打印只会得到当前那一屏，
 * 而且 `position: fixed` 的内容会在每页重复。所以打印时隐藏舞台，
 * 换成一页线性文档（见 main.css 的 `@media print`）。
 *
 * 内容与线上保持同一份数据源：区块名来自 sections.ts、项目来自
 * projects.ts、联系方式是固定的三条。
 */
const LINKS = [
  { label: 'GitHub', text: 'github.com/Wemsur', href: 'https://github.com/Wemsur' },
  { label: 'Bilibili', text: 'space.bilibili.com/1826712095', href: 'https://space.bilibili.com/1826712095' },
  { label: 'Email', text: 'iexamplecom@outlook.com', href: 'mailto:iexamplecom@outlook.com' },
]
</script>

<template>
  <article class="print-doc">
    <header>
      <h1>庭域 WemZone</h1>
      <p class="lead">Wemsur 的个人主页 · wemsur.top</p>
    </header>

    <section>
      <h2>页面</h2>
      <ul>
        <li v-for="s in ACTIVE_SECTIONS" :key="s.id">{{ s.label }}</li>
      </ul>
    </section>

    <section>
      <h2>其它作品</h2>
      <ul>
        <li v-for="p in PROJECTS" :key="p.name">
          <strong>{{ p.name }}</strong> —— {{ p.desc }}
          <span class="url">{{ p.href }}</span>
        </li>
      </ul>
    </section>

    <section>
      <h2>联系</h2>
      <ul>
        <li v-for="l in LINKS" :key="l.label">
          {{ l.label }}：{{ l.text }}
        </li>
      </ul>
    </section>
  </article>
</template>

<style>
/* 只在打印时出现；屏幕上一律不渲染（避免被搜索引擎/读屏当成正文重复） */
.print-doc {
  display: none;
}

@media print {
  .print-doc {
    display: block;
    max-width: 42rem;
    margin: 0 auto;
    padding: 0 1rem;
    color: #111;
    font-family: 'HarmonyOS Sans SC', -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
    font-size: 11pt;
    line-height: 1.7;
  }

  .print-doc h1 {
    margin: 0 0 0.2rem;
    font-size: 22pt;
    letter-spacing: 0.08em;
  }

  .print-doc h2 {
    margin: 1.4rem 0 0.4rem;
    font-size: 12pt;
    letter-spacing: 0.12em;
    border-bottom: 1px solid #ccc;
    padding-bottom: 0.2rem;
  }

  .print-doc p,
  .print-doc ul {
    margin: 0.2rem 0;
  }

  .print-doc ul {
    padding-left: 1.1rem;
  }

  .print-doc li {
    margin: 0.15rem 0;
    break-inside: avoid;
  }

  .print-doc .lead,
  .print-doc .url {
    color: #555;
  }

  .print-doc .url {
    display: block;
    font-size: 9pt;
    word-break: break-all;
  }
}
</style>
