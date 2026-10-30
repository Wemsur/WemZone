<script setup lang="ts">
import {
  DitheringShapes,
  DitheringTypes,
  ShaderFitOptions,
  defaultObjectSizing,
  ditheringFragmentShader,
  getShaderColorFromString,
  meshGradientFragmentShader,
} from '@paper-design/shaders'
import { ref } from 'vue'

import { ditherColors, meshColors } from '@/engine/background'

import { useShaderLayers } from './useShaderLayers'

/**
 * 启动器区背景 —— 用户要求（原文）：
 *
 *   「与其官网类似的流体 + 流动像素 背景」
 *
 * 与参考站 Celestial-Web 的 FluidBackground 同源：
 * 下层 MeshGradient 是流体色团，上层 Dithering（warp / 4×4）是抖动点阵，
 * 用 soft-light 混进流体里。
 *
 * 与参考站的关键差别：那边 `speed=0`、时间由滚动推进；这里必须常驻流动
 * （用户要求静止时也在动），所以 `speed > 0`。场景不可见时由
 * `useShaderLayers` 暂停。
 */
const props = defineProps<{ hue: number }>()

const meshHost = ref<HTMLDivElement | null>(null)
const ditherHost = ref<HTMLDivElement | null>(null)

/** 两层共用的取景参数：铺满视口（cover），不旋转不偏移 */
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

const { back, front } = ditherColors(props.hue)

useShaderLayers([
  {
    host: meshHost,
    fragment: meshGradientFragmentShader,
    uniforms: {
      ...sizing,
      u_colors: meshColors(props.hue).map(getShaderColorFromString),
      u_colorsCount: 6,
      u_distortion: 0.8,
      u_swirl: 0.1,
      u_grainMixer: 0,
      u_grainOverlay: 0.01,
    },
    speed: 0.16,
  },
  {
    host: ditherHost,
    fragment: ditheringFragmentShader,
    uniforms: {
      ...sizing,
      u_colorBack: getShaderColorFromString(back),
      u_colorFront: getShaderColorFromString(front),
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes['4x4'],
      u_pxSize: 2.5,
    },
    speed: 0.07,
  },
])
</script>

<template>
  <div class="scene">
    <div ref="meshHost" class="mesh" />
    <div ref="ditherHost" class="dither" />
    <div class="scrim" />
    <div class="vignette" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #141414;
}

.mesh {
  position: absolute;
  inset: 0;
  transform: scale(1.03);
  filter: saturate(1.06);
}

.dither {
  position: absolute;
  inset: 0;
  transform: scale(1.015);
  mix-blend-mode: soft-light;
  opacity: 0.6;
}

.scrim {
  position: absolute;
  inset: 0;
  background: #151515;
  opacity: 0.46;
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, transparent 38%, #0b0b0b 100%);
  opacity: 0.45;
}
</style>
