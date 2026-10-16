/**
 * 内容区配置
 *
 * 配置驱动：加一个区只改这里（外加一个对应的内容组件）。相机停靠点、导航标签、
 * 色相都从这里读。
 *
 * `enabled: false` 的条目会被相机与导航**完全跳过** —— 这是 Minecraft 区
 * 「预留不开发」的做法：结构上支持，上线时不出现。
 */

export interface SectionDef {
  /** 区块标识，同时用作 URL hash 与 Stop.id */
  id: string
  /** 导航与章节轴上显示的名字 */
  label: string
  /** 该区的品牌色相（deg）。不填则用全局 --brand-hue。 */
  hue?: number
  /** false = 预留但不上线（相机不停留、导航不出现） */
  enabled: boolean
}

export const SECTIONS: SectionDef[] = [
  { id: 'home', label: '首页', hue: 18, enabled: true },
  { id: 'launcher', label: 'Celestial Launcher', hue: 38, enabled: true },
  { id: 'works', label: '其它作品', hue: 210, enabled: true },
  { id: 'video', label: '视频', hue: 340, enabled: true },
  // 预留：以后做 Minecraft 玩家页（3D 模型 + 档案信息）。上线时不出现。
  { id: 'minecraft', label: 'Minecraft 玩家', enabled: false },
  { id: 'contact', label: '联系', hue: 160, enabled: true },
]

/** 当前启用的区块。相机与导航都只认这个。 */
export const ACTIVE_SECTIONS = SECTIONS.filter((s) => s.enabled)
