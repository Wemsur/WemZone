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
  locale: 'en-US',
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
