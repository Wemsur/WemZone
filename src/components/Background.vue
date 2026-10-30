<script setup lang="ts">
import ContactScene from '@/components/background/ContactScene.vue'
import HomeScene from '@/components/background/HomeScene.vue'
import LauncherScene from '@/components/background/LauncherScene.vue'
import VideoScene from '@/components/background/VideoScene.vue'
import WorksScene from '@/components/background/WorksScene.vue'
import type { BackgroundKind } from '@/sections'

/**
 * 一个区块的背景 —— **作为区块的一部分，在 3D 世界里跟着它走**
 *
 * 不是 screen-space 的全局背景。它挂在 `.world-section` 里，随相机平移、
 * 随区块一起进出视野；点阵、流体、光晕都是这个区块自己的，不是全站共用一张。
 *
 * 尺寸比区块本身更大（见 `World.vue` 的 `.section-bg`，约 160% × 185%），
 * 于是：
 *  - 区块居中时，视野内永远看不到背景的边缘（不出现黑边）；
 *  - 相邻区块的背景在区块之间**重叠**，各自的边缘渐隐在重叠区交汇，
 *    形成空间上的渐变融合，而不是硬切。
 *
 * 用户在访谈里对每区背景有各自的明确要求，对应下面五个场景组件。
 */
defineProps<{ kind: BackgroundKind; hue: number }>()
</script>

<template>
  <div class="bg">
    <HomeScene v-if="kind === 'home'" :hue="hue" />
    <LauncherScene v-else-if="kind === 'launcher'" :hue="hue" />
    <WorksScene v-else-if="kind === 'works'" :hue="hue" />
    <VideoScene v-else-if="kind === 'video'" :hue="hue" />
    <ContactScene v-else :hue="hue" />
  </div>
</template>

<style scoped>
.bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* 场景里的 transform 会用到这两个变量。背景现在跟着区块在 3D 世界里
     移动，不再需要额外的屏幕视差，所以默认是 0 —— 但保留变量名，
     以后想给某一层加「比区块更慢」的视差时可以直接写。 */
  --bg-px: 0rem;
  --bg-py: 0rem;
}
</style>
