<script setup lang="ts">
import {
  DitheringShapes,
  DitheringTypes,
  ShaderFitOptions,
  defaultObjectSizing,
  ditheringFragmentShader,
  getShaderColorFromString,
} from '@paper-design/shaders'
import { ref } from 'vue'

import { hsl } from '@/engine/background'

import { useShaderLayers } from './useShaderLayers'

/**
 * 视频区背景 —— 用户要求（原文）：
 *
 *   「背景使用呼吸光晕 + 流动像素（没有流体，只是像素，从 Celestial 背景里
 *     提取出像素的流动）+ 一个像主页那样的背景图片 + 视野外边缘渐变消失」
 *
 * 与启动器区的区别是**没有流体层**：这里只有抖动像素。
 * 像素层用 `screen` 混合、底色设纯黑 —— 黑在 screen 下等于透明，
 * 所以像素是「浮在背景图上的光点」，而不是盖住图片的一块幕布。
 */
const props = defineProps<{ hue: number }>()

const ditherHost = ref<HTMLDivElement | null>(null)

const sizing = {
  u_fit: ShaderFitOptions.cover,
  u_scale: defaultObjectSizing.scale,
  u_rotation: defaultObjectSizing.rotation,
  u_originX: defaultObjectSizing.originX,
  u_originY: defaultObjectSizing.originY,
  u_offsetX: defaultObjectSizing.offsetX,
  u_offsetY: defaultObjectSizing.offsetY,
  u_worldWidth: defaultObjectSizing.worldWidth,
  u_worldHeight: defaultObjectSizing.worldHeight,
}

useShaderLayers([
  {
    host: ditherHost,
    fragment: ditheringFragmentShader,
    uniforms: {
      ...sizing,
      // 纯黑底 + screen 混合 = 只有像素发光，图片原样透出来
      u_colorBack: getShaderColorFromString('#000000'),
      u_colorFront: getShaderColorFromString(hsl(props.hue, 58, 48)),
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes['4x4'],
      u_pxSize: 2.5,
    },
    speed: 0.09,
  },
])
</script>

<template>
  <div class="scene" :style="{ '--hue': hue }">
    <!-- 1. 背景图 + 遮罩。比视口大，边缘在视野外渐隐 -->
    <div class="photo" />
    <div class="photo-mask" />

    <!-- 2. 流动像素（没有流体） -->
    <div ref="ditherHost" class="pixels" />

    <!-- 3. 呼吸光晕 -->
    <div class="glow glow-a" />
    <div class="glow glow-b" />

    <!-- 4. 边缘渐隐 -->
    <div class="edge" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #121212;
}

.photo {
  position: absolute;
  inset: -12%;
  background-image:
    var(--video-bg-image, none),
    radial-gradient(ellipse 78% 62% at 68% 26%, hsl(var(--hue) 26% 22%) 0%, transparent 62%),
    radial-gradient(ellipse 66% 58% at 22% 74%, #1c1a1f 0%, transparent 64%),
    linear-gradient(155deg, #191619 0%, #131315 52%, #0f1012 100%);
  background-size: cover;
  background-position: center;
  mask-image: radial-gradient(ellipse 88% 88% at 50% 50%, #000 55%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 88% 88% at 50% 50%, #000 55%, transparent 100%);
  transform: translate3d(var(--bg-px), var(--bg-py), 0) scale(1.04);
}

.photo-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(10 10 10 / 0.4) 0%,
    rgb(10 10 10 / 0.3) 48%,
    rgb(10 10 10 / 0.58) 100%
  );
}

/* 像素层：screen 混合，黑底等于透明 */
.pixels {
  position: absolute;
  inset: 0;
  transform: scale(1.02);
  mix-blend-mode: screen;
  opacity: 0.24;
}

/* 呼吸光晕：色相跟随本区 */
.glow {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: screen;
  pointer-events: none;
}

.glow-a {
  left: -16%;
  top: -20%;
  width: 72vw;
  height: 72vw;
  background: radial-gradient(circle, hsl(var(--hue) 60% 52% / 0.24) 0%, transparent 62%);
  animation: video-breathe-a 15s ease-in-out infinite;
}

.glow-b {
  right: -18%;
  bottom: -24%;
  width: 78vw;
  height: 78vw;
  background: radial-gradient(circle, hsl(var(--hue) 45% 46% / 0.18) 0%, transparent 66%);
  animation: video-breathe-b 21s ease-in-out infinite;
}

@keyframes video-breathe-a {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

@keyframes video-breathe-b {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1.03);
  }
  50% {
    opacity: 0.12;
    transform: scale(0.93);
  }
}

/* 边缘渐隐：把四周压向底色，视野内不会看到硬边 */
.edge {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, transparent 34%, #080808 100%);
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
