/**
 * 「其它作品」的项目清单
 *
 * 访谈 Q34 选了「手写」（可控、能精选），所以这里是一份静态数据，
 * 不从 GitHub API 拉。
 *
 * **文案待确认**：名称与链接取自 `~/github-project/` 下各仓库的 remote，
 * 描述只写了足以区分项目的一句话。想改文案 / 增删项目，只动这个文件。
 */

export interface Project {
  /** 项目名 */
  name: string
  /** 一句话描述 */
  desc: string
  /** 外部链接 */
  href: string
  /** 右上角的小标签（技术栈 / 类型） */
  tag: string
}

export const PROJECTS: Project[] = [
  {
    name: 'Celestial Launcher',
    desc: '基于 Modrinth 的 Minecraft 启动器，加了分屏、翻译与主题定制。',
    href: 'https://github.com/Wemsur/modrinth',
    tag: 'Tauri · Vue',
  },
  {
    name: 'Celestial-Web',
    desc: 'Celestial 的站点：整页由滚动位置驱动的纯函数动画。',
    href: 'https://github.com/Wemsur/Celestial-Web',
    tag: 'Vue · CSS 3D',
  },
  {
    name: 'Celestial Plugin Store',
    desc: '启动器插件商店，插件的发现、安装与热重载。',
    href: 'https://github.com/Wemsur/Celestial-Plugin-Store',
    tag: 'TypeScript',
  },
  {
    name: 'celestial-hitokoto',
    desc: '给启动器主页加一条会轮换的一言。',
    href: 'https://github.com/Wemsur/celestial-hitokoto',
    tag: '插件',
  },
  {
    name: 'Celestial Docs',
    desc: 'Celestial 系列的使用与开发文档。',
    href: 'https://github.com/Wemsur/Celestial-docs',
    tag: '文档',
  },
  {
    name: 'YangYiSongRequest',
    desc: '校园广播点歌系统：排队、审核与播放。',
    href: 'https://github.com/OnionSchool/YangYiSongRequest',
    tag: 'Web',
  },
]
