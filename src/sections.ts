/**
 * 内容区配置
 *
 * 配置驱动：加一个区只改这里（外加一个对应的内容组件）。相机停靠点、导航标签、
 * 色相都从这里读。
 *
 * `enabled: false` 的条目会被相机与导航**完全跳过** —— 这是 Minecraft 区
 * 「预留不开发」的做法：结构上支持，上线时不出现。
 */

/**
 * 背景构成。每个区块的背景是**各自独立设计**的，不是同一张背景换颜色。
 * 具体构成见 `components/background/` 下对应的场景组件。
 */
export type BackgroundKind = 'home' | 'launcher' | 'works' | 'video' | 'contact'

export interface SectionDef {
  /** 区块标识，同时用作 URL hash 与 Stop.id */
  id: string
  /** 导航与章节轴上显示的名字 */
  label: string
  /** 该区的品牌色相（deg）。不填则用全局 --brand-hue。 */
  hue?: number
  /** 该区的背景场景（见 BackgroundKind） */
  background: BackgroundKind
  /** false = 预留但不上线（相机不停留、导航不出现） */
  enabled: boolean
}

export const SECTIONS: SectionDef[] = [
  // 首页：背景图 + 遮罩 + 白色呼吸光晕 + 微弱点阵
  { id: 'home', label: '首页', hue: 18, background: 'home', enabled: true },
  // 启动器：流体 + 流动像素（呼应其官网）
  { id: 'launcher', label: 'Celestial Launcher', hue: 38, background: 'launcher', enabled: true },
  // 其它作品：点阵 + 均匀起伏的波形 + 光晕
  { id: 'works', label: '其它作品', hue: 210, background: 'works', enabled: true },
  // 视频：呼吸光晕 + 流动像素 + 背景图 + 边缘渐隐
  { id: 'video', label: '视频', hue: 340, background: 'video', enabled: true },
  // 预留：以后做 Minecraft 玩家页（3D 模型 + 档案信息）。上线时不出现。
  { id: 'minecraft', label: 'Minecraft 玩家', background: 'contact', enabled: false },
  // 联系：最安静的一屏，几乎只有渐变
  { id: 'contact', label: '联系', hue: 160, background: 'contact', enabled: true },
]

/** 当前启用的区块。相机与导航都只认这个。 */
export const ACTIVE_SECTIONS = SECTIONS.filter((s) => s.enabled)
