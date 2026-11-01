/**
 * 样例数据：替代 theseus 后端
 *
 * 启动器前端从 `invoke()` 拿到的每一份数据都在这里硬编码。形状与
 * `helpers/types.d.ts` 的 `GameInstance`、`helpers/settings.ts` 的
 * `AppSettings` 对齐 —— 界面代码一行不用改。
 *
 * 日期一律 ISO 字符串：Rust 那边序列化出来就是字符串，前端用 dayjs 解析。
 */

const LIBRARY_PATH = '/mock/minecraft'

function instance(over: {
  id: string
  name: string
  game_version: string
  loader: 'vanilla' | 'fabric' | 'forge' | 'quilt' | 'neoforge'
  loader_version?: string
  icon?: string
  last_played?: string
}): Record<string, unknown> {
  const created = '2026-01-01T00:00:00.000Z'
  return {
    id: over.id,
    path: `${LIBRARY_PATH}/instances/${over.name}`,
    install_stage: 'installed',
    launcher_feature_version: '3.4.0',
    name: over.name,
    icon_path: over.icon ?? null,
    icon_config: null,
    library_format: 'modrinth',
    game_version: over.game_version,
    protocol_version: 775,
    loader: over.loader,
    loader_version: over.loader_version ?? null,
    group_ids: [],
    synced_options: {
      resource_packs: false,
      data_packs: false,
      game_options: false,
      command_history: false,
      multiplayer_servers: false,
      creative_hotbars: false,
      screenshots: false,
    },
    link: null,
    shared_instance: null,
    quarantined: false,
    update_channel: 'release',
    created,
    modified: created,
    last_played: over.last_played ?? null,
    submitted_time_played: 0,
    recent_time_played: 0,
    java_path: null,
    extra_launch_args: [],
    custom_env_vars: [],
    memory: { min: null, max: 4096 },
    force_fullscreen: false,
    game_resolution: [854, 480],
    hooks: { pre_launch: '', wrapper: '', post_exit: '' },
    visible_tabs: { files: true, worlds: true, screenshots: true },
  }
}

/** 15 个样例实例，第一个是 26.3（计划里约定的排序） */
export const INSTANCES = [
  instance({ id: 'i-26-3', name: '26.3', game_version: '26.3', loader: 'fabric', loader_version: '0.17.2', last_played: '2026-10-30T12:00:00.000Z' }),
  instance({ id: 'i-fo', name: 'Fabulously Optimized', game_version: '1.21.8', loader: 'fabric', loader_version: '0.16.10' }),
  instance({ id: 'i-rlcraft', name: 'RLCraft', game_version: '1.12.2', loader: 'forge', loader_version: '14.23.5.2860' }),
  instance({ id: 'i-create', name: 'Create: Astral', game_version: '1.20.1', loader: 'forge', loader_version: '47.3.0' }),
  instance({ id: 'i-dungeons', name: 'Minecraft Dungeons II', game_version: '26.1', loader: 'vanilla' }),
  instance({ id: 'i-vanilla', name: '纯净生存', game_version: '26.3', loader: 'vanilla' }),
  instance({ id: 'i-李', name: 'MCD 概念艺术服', game_version: '1.21.5', loader: 'fabric', loader_version: '0.16.9' }),
  instance({ id: 'i-sky', name: 'SkyBlock 挑战', game_version: '1.21.4', loader: 'fabric', loader_version: '0.16.5' }),
  instance({ id: 'i-pt', name: '光影测试', game_version: '1.21.8', loader: 'fabric', loader_version: '0.16.10' }),
  instance({ id: 'i-modpack', name: '整合包调试', game_version: '1.20.1', loader: 'neoforge', loader_version: '21.1.80' }),
  instance({ id: 'i-old', name: '1.7.10 回忆', game_version: '1.7.10', loader: 'forge', loader_version: '10.13.4.1614' }),
  instance({ id: 'i-quilt', name: 'Quilt 实验', game_version: '1.21.1', loader: 'quilt', loader_version: '0.27.0' }),
  instance({ id: 'i-plugin', name: '插件服测试', game_version: '1.21.8', loader: 'fabric', loader_version: '0.16.10' }),
  instance({ id: 'i-存档', name: '旧世界存档', game_version: '1.19.2', loader: 'fabric', loader_version: '0.15.11' }),
  instance({ id: 'i-空', name: '空白实例', game_version: '26.3', loader: 'vanilla' }),
]

/** `library_list` 返回的是 LibrariesConfig，不是数组 */
export const LIBRARIES = {
  libraries: [{ name: '主库', path: LIBRARY_PATH, type: 'modrinth' }],
  migrated: true,
  active_library_path: LIBRARY_PATH,
}

export const SETTINGS = {
  max_concurrent_downloads: 6,
  max_concurrent_writes: 6,
  theme: 'customdark',
  locale: 'zh-CN',
  default_page: 'Home',
  collapsed_navigation: false,
  hide_nametag_skins_page: false,
  advanced_rendering: true,
  native_decorations: true,
  toggle_sidebar: false,
  sync_theme_across_devices: false,
  sync_behavior_across_devices: false,
  sync_features_across_devices: false,
  show_files_tab_in_instances: true,
  show_worlds_tab_in_instances: true,
  show_screenshots_tab_in_instances: true,
  show_skin_selector_in_sidebar: false,
  telemetry: false,
  discord_rpc: false,
  personalized_ads: false,
  extra_launch_args: [],
  custom_env_vars: [],
  memory: { min: null, max: 4096 },
  force_fullscreen: false,
  game_resolution: [854, 480],
  hide_on_process_start: false,
  hooks: { pre_launch: '', wrapper: '', post_exit: '' },
  custom_dir: null,
  prev_custom_dir: null,
  migrated: true,
  developer_mode: false,
  feature_flags: {},
  skipped_update: null,
  pending_update_toast_for_version: null,
  auto_download_updates: false,
  version: 1,
}

/** 标签：游戏版本 / 加载器 / 分类 */
export const GAME_VERSIONS = ['26.3', '26.1', '1.21.8', '1.21.5', '1.21.4', '1.21.1', '1.20.1', '1.19.2', '1.12.2', '1.7.10'].map(
  (v, i) => ({
    version: v,
    version_type: 'release',
    date: '2026-06-01T00:00:00.000Z',
    major: i === 0,
  }),
)

export const LOADERS = [
  { name: 'vanilla', supported_project_types: ['mod', 'modpack', 'resourcepack', 'shader', 'datapack'] },
  { name: 'fabric', supported_project_types: ['mod', 'modpack'] },
  { name: 'forge', supported_project_types: ['mod', 'modpack'] },
  { name: 'neoforge', supported_project_types: ['mod', 'modpack'] },
  { name: 'quilt', supported_project_types: ['mod', 'modpack'] },
]

export const CATEGORIES = [
  { name: 'adventure', project_type: 'modpack', header: 'categories' },
  { name: 'optimization', project_type: 'modpack', header: 'categories' },
  { name: 'technology', project_type: 'modpack', header: 'categories' },
  { name: 'magic', project_type: 'modpack', header: 'categories' },
]


/* ---------------------------------------------------------------------------
   浏览页（Discover）的样例数据
   ---------------------------------------------------------------------------
   Browse 页走的是 `plugin:cache|get_search_results_v3`（Rust 侧的搜索缓存）。
   这里返回一份固定结果，形状对齐 `Labrinth.Search.v3.ResultSearchProject`。
   icon_url 用 null：界面会画默认方块图标，和没有自定义图标的实例一致。
--------------------------------------------------------------------------- */

function modpack(over: {
  id: string
  slug: string
  name: string
  summary: string
  downloads: number
  follows: number
  categories: string[]
  loaders: string[]
  versions: string[]
  color?: number
}): Record<string, unknown> {
  return {
    project_id: over.id,
    project_types: ['modpack'],
    all_project_types: ['modpack'],
    slug: over.slug,
    author: '样例数据',
    author_id: null,
    organization: null,
    organization_id: null,
    name: over.name,
    summary: over.summary,
    categories: over.categories,
    display_categories: over.categories,
    downloads: over.downloads,
    follows: over.follows,
    icon_url: null,
    date_created: '2024-01-01T00:00:00.000Z',
    date_modified: '2026-09-01T00:00:00.000Z',
    license: 'MIT',
    gallery: [],
    featured_gallery: null,
    color: over.color ?? null,
    loaders: over.loaders,
    versions: over.versions,
    disclosure_types: [],
  }
}

export const SEARCH_PROJECTS = [
  modpack({ id: 'mp-fo', slug: 'fabulously-optimized', name: 'Fabulously Optimized', summary: '让 Minecraft 跑得更快、更好看的一体化整合包。', downloads: 18694984, follows: 12000, categories: ['optimization'], loaders: ['fabric'], versions: ['26.3', '1.21.8'], color: 0x5b8cff }),
  modpack({ id: 'mp-rlcraft', slug: 'rlcraft', name: 'RLCraft', summary: '硬核生存：真实环境、更强的怪物、更深的探索。', downloads: 40000000, follows: 30000, categories: ['adventure', 'challenging'], loaders: ['forge'], versions: ['1.12.2'], color: 0xff5b5b }),
  modpack({ id: 'mp-create-astral', slug: 'create-astral', name: 'Create: Astral', summary: '以机械动力为核心的科技整合包。', downloads: 5200000, follows: 6100, categories: ['technology'], loaders: ['forge'], versions: ['1.20.1'], color: 0xffa64d }),
  modpack({ id: 'mp-better-mc', slug: 'better-mc', name: 'Better MC', summary: '在原版基础上扩充生物群系、结构与内容。', downloads: 9000000, follows: 8000, categories: ['adventure'], loaders: ['fabric'], versions: ['1.21.4'], color: 0x63c76a }),
  modpack({ id: 'mp-all-of-fabric', slug: 'all-of-fabric', name: 'All of Fabric', summary: 'Fabric 生态里几乎所有主流模组的合集。', downloads: 3100000, follows: 3400, categories: ['technology', 'magic'], loaders: ['fabric'], versions: ['1.21.1'], color: 0xb06bff }),
  modpack({ id: 'mp-dawncraft', slug: 'dawncraft', name: 'DawnCraft', summary: '高难度 RPG 冒险整合包，探索与战斗并重。', downloads: 2400000, follows: 2900, categories: ['adventure', 'magic'], loaders: ['forge'], versions: ['1.20.1'], color: 0x8a6bff }),
]

/** `plugin:cache|get_search_results_v3` 的返回形状 */
export const SEARCH_RESULT_V3 = {
  result: {
    hits: SEARCH_PROJECTS,
    page: 1,
    hits_per_page: 20,
    total_hits: SEARCH_PROJECTS.length,
  },
}


/* ---------------------------------------------------------------------------
   默认 Minecraft 账号（离线）
   ---------------------------------------------------------------------------
   形状对齐 `AccountsCard.vue` 的 `MinecraftCredential`：profile + offline + active。
--------------------------------------------------------------------------- */
export const ACCOUNT = {
  profile: { id: '00000000-0000-0000-0000-000000000001', name: 'Wemsur' },
  offline: true,
  active: true,
}

/* ---------------------------------------------------------------------------
   CurseForge 内容源（样例）
   ---------------------------------------------------------------------------
   内容源是「后端安装的插件」：`content_source_list` 给出 manifest，loader 再把
   entry 读出来执行 `activate(api)`，由它 `api.register(provider)`。这里把
   entry 的源码直接以字符串返回，loader 会用 blob URL 执行它。
--------------------------------------------------------------------------- */
export const CURSEFORGE_MANIFEST = {
  id: 'curseforge',
  name: 'CurseForge',
  version: '1.0.0',
  description: 'CurseForge 内容源（样例数据）',
  author: 'WemZone',
  homepage: 'https://www.curseforge.com',
  icon: null,
  color: '#f16436',
  detail_format: 'markdown',
  api_version: 1,
  entry: 'main.js',
  content_types: ['modpack', 'mod'],
  capabilities: {
    search: true,
    browse: true,
    detail: false,
    versions: false,
    resolve_download: false,
    open_download: false,
    update_check: false,
  },
  hosts: ['api.curseforge.com'],
  auth: null,
  manual_entry: [],
  settings: [],
}

export const CURSEFORGE_SUMMARY = {
  id: 'curseforge',
  dir_name: 'curseforge',
  path: '/mock/sources/curseforge',
  enabled: true,
  manifest: CURSEFORGE_MANIFEST,
  error: null,
}

/** entry 的源码：loader 会把它当 ES module 执行 */
export const CURSEFORGE_ENTRY = `
export function activate(api) {
  const packs = [
    {
      sourceId: 'curseforge', id: 'cf-rlcraft', contentType: 'modpack',
      name: 'RLCraft', summary: '硬核生存：真实环境、更强的怪物、更深的探索。',
      author: 'Shivaxi', downloads: 40000000, follows: 30000,
      publishedAt: '2019-06-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      gameVersions: ['1.12.2'], loaders: ['forge'], tags: ['Adventure', 'Hardcore'],
    },
    {
      sourceId: 'curseforge', id: 'cf-create-astral', contentType: 'modpack',
      name: 'Create: Astral', summary: '以机械动力为核心的科技整合包。',
      author: 'LudoCrypt', downloads: 5200000, follows: 6100,
      publishedAt: '2023-02-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
      gameVersions: ['1.20.1'], loaders: ['forge'], tags: ['Technology'],
    },
    {
      sourceId: 'curseforge', id: 'cf-dawncraft', contentType: 'modpack',
      name: 'DawnCraft', summary: '高难度 RPG 冒险整合包，探索与战斗并重。',
      author: 'DawnCraft Team', downloads: 2400000, follows: 2900,
      publishedAt: '2023-05-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
      gameVersions: ['1.20.1'], loaders: ['forge'], tags: ['Adventure', 'RPG'],
    },
    {
      sourceId: 'curseforge', id: 'cf-atm9', contentType: 'modpack',
      name: 'All the Mods 9', summary: '经典 ATM 系列，几乎所有主流模组一网打尽。',
      author: 'ATM Team', downloads: 12800000, follows: 15000,
      publishedAt: '2023-06-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
      gameVersions: ['1.20.1'], loaders: ['forge', 'neoforge'], tags: ['Technology', 'Magic'],
    },
    {
      sourceId: 'curseforge', id: 'cf-vault-hunters', contentType: 'modpack',
      name: 'Vault Hunters 3rd Edition', summary: 'RPG 地牢探险与科技结合的大型整合包。',
      author: 'Iskall85', downloads: 9700000, follows: 12000,
      publishedAt: '2022-11-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
      gameVersions: ['1.18.2'], loaders: ['forge'], tags: ['Adventure', 'RPG'],
    },
    {
      sourceId: 'curseforge', id: 'cf-better-mc', contentType: 'modpack',
      name: 'Better MC [FORGE]', summary: '在原版基础上扩充生物群系、结构与内容。',
      author: 'Luna Pixel Studios', downloads: 9000000, follows: 8000,
      publishedAt: '2021-09-01T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z',
      gameVersions: ['1.20.1'], loaders: ['forge'], tags: ['Adventure'],
    },
  ]

  function page(items) {
    return { items, total: items.length }
  }

  api.register({
    async browse() {
      return page(packs)
    },
    async search(request) {
      const q = String(request && request.query ? request.query : '').toLowerCase()
      const items = q ? packs.filter((p) => p.name.toLowerCase().includes(q)) : packs
      return page(items)
    },
  })
}
`
