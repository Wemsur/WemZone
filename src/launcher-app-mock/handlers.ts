/**
 * `invoke()` 的命令表
 *
 * 只覆盖界面真正会读的数据；其余命令按名字猜一个空值返回（见文件末尾）。
 * 原则：**宁可返回空值，也不要抛错** —— 启动器启动时会打一批与界面无关的
 * 命令（广告、更新、遥测），抛错会让整页白屏；返回空值等价于「功能关闭」。
 */

import {
  ACCOUNT,
  CATEGORIES,
  CURSEFORGE_ENTRY,
  CURSEFORGE_SUMMARY,
  GAME_VERSIONS,
  INSTANCES,
  LIBRARIES,
  LOADERS,
  SEARCH_PROJECTS,
  SEARCH_RESULT_V3,
  SETTINGS,
} from './data'

type Args = Record<string, unknown>
type Handler = (args: Args) => unknown

const getByIds = (args: Args): unknown[] => {
  const ids = (args.ids ?? args.instanceIds ?? args.instance_ids) as string[] | undefined
  if (!Array.isArray(ids)) return INSTANCES
  return INSTANCES.filter((i) => ids.includes(i.id as string))
}

const findInstance = (args: Args): unknown =>
  INSTANCES.find((i) => i.id === (args.instanceId ?? args.id)) ?? null

const HANDLERS: Record<string, Handler> = {
  /* ---- 启动 ---- */
  initialize_state: () => undefined,
  'plugin:utils|progress_bars_list': () => ({}),
  'plugin:utils|get_opening_command': () => null,
  'plugin:utils|get_os': () => 'windows',
  'plugin:utils|is_network_metered': () => false,
  'plugin:utils|should_disable_mouseover': () => false,
  'plugin:utils|open_path': () => undefined,
  'plugin:utils|highlight_in_folder': () => undefined,
  'plugin:utils|show_launcher_logs_folder': () => undefined,
  'plugin:utils|show_app_db_backups_folder': () => undefined,
  'plugin:utils|get_image_thumbnail': () => null,

  /* ---- 设置 ---- */
  'plugin:settings|settings_get': () => SETTINGS,
  'plugin:settings|settings_set': () => undefined,
  'plugin:settings|cancel_directory_change': () => undefined,
  // 这几个命令真实现返回**磁盘上的 JSON 字符串**；返回空串 = 「还没保存过」，
  // 调用方会退回默认值（返回对象会被 JSON.parse 成 "[object Object]"）
  load_ui_preferences: () => '',
  save_ui_preferences: () => undefined,
  load_translation_settings: () => '',
  save_translation_settings: () => undefined,
  load_translation_cache: () => '',
  save_translation_cache: () => undefined,
  clear_translation_cache: () => undefined,
  load_bg_blur_status: () => false,
  save_bg_blur_status: () => undefined,
  load_instance_card_icon_bg: () => null,
  save_instance_card_icon_bg: () => undefined,
  load_library_sort_directions: () => ({}),
  save_library_sort_directions: () => undefined,
  load_split_view_settings: () => null,
  save_split_view_settings: () => undefined,

  /* ---- 实例 ---- */
  'plugin:instance|instance_list': () => INSTANCES,
  'plugin:instance|instance_get_many': getByIds,
  'plugin:instance|instance_get': findInstance,
  'plugin:instance|instance_list_groups': () => [],
  'plugin:instance|instance_get_content_items': () => [],
  'plugin:instance|instance_get_installed_project_ids': () => [],
  'plugin:instance|instance_get_projects': () => [],
  'plugin:instance|instance_check_installed': () => false,
  'plugin:instance|instance_get_game_setting_locale_labels': () => ({}),
  'plugin:instance|instance_get_command_history': () => [],
  'plugin:instance|instance_list_screenshots': () => [],
  'plugin:instance|instance_list_screenshot_groups': () => [],
  'plugin:instance|instance_list_synced_packs': () => [],
  'plugin:instance|instance_list_synced_servers': () => [],

  /* ---- 内容库 ---- */
  'plugin:instance|library_list': () => LIBRARIES,
  'plugin:instance|library_default_path': () => '/mock/minecraft',
  'plugin:instance|library_set_active': () => undefined,
  'plugin:instance|library_add': () => undefined,
  'plugin:instance|library_remove': () => undefined,
  'plugin:instance|library_reorder': () => undefined,
  'plugin:instance|library_update_name': () => undefined,

  /* ---- 标签 ---- */
  'plugin:tags|tags_get_game_versions': () => GAME_VERSIONS,
  'plugin:tags|tags_get_loaders': () => LOADERS,
  'plugin:tags|tags_get_categories': () => CATEGORIES,
  'plugin:tags|tags_get_donation_platforms': () => [],
  'plugin:tags|tags_get_report_types': () => [],
  'plugin:metadata|metadata_get_game_versions': () => GAME_VERSIONS,
  'plugin:metadata|metadata_get_loader_versions': () => [],

  /* ---- 账号 ---- */
  'plugin:auth|get_users': () => [ACCOUNT],
  'plugin:auth|get_default_user': () => ACCOUNT.profile.id,
  'plugin:auth|set_default_user': () => undefined,
  'plugin:auth|check_reachable': () => true,
  'plugin:auth|create_offline_user': () => ACCOUNT,
  'plugin:auth|remove_user': () => undefined,
  'plugin:minecraft-skins|get_available_skins': () => [],
  'plugin:minecraft-skins|get_available_capes': () => [],

  /* ---- 内容源（CurseForge 样例） ---- */
  'plugin:content-sources|content_source_list': () => [CURSEFORGE_SUMMARY],
  'plugin:content-sources|content_source_get': () => CURSEFORGE_SUMMARY,
  'plugin:content-sources|content_source_read_entry': () => CURSEFORGE_ENTRY,
  'plugin:content-sources|content_source_set_enabled': () => CURSEFORGE_SUMMARY,
  'plugin:content-sources|content_source_storage_get': () => null,
  'plugin:content-sources|content_source_storage_set': () => undefined,
  'plugin:content-sources|content_source_storage_remove': () => undefined,
  'plugin:content-sources|content_source_storage_keys': () => [],
  'plugin:content-sources|content_source_settings_get': () => ({}),
  'plugin:content-sources|content_source_install': () => CURSEFORGE_SUMMARY,
  'plugin:content-sources|content_source_install_from_url': () => CURSEFORGE_SUMMARY,
  'plugin:content-sources|content_source_uninstall': () => undefined,
  'plugin:content-sources|content_source_latest_release': () => null,

  /* ---- 其它界面会用到的空数据 ---- */
  'plugin:ads|should_show_ads_consent_popup': () => false,
  'plugin:ads|perform_ads_consent_action': () => undefined,
  'plugin:friends|friends': () => [],
  'plugin:friends|friend_statuses': () => ({}),
  'plugin:process|process_get_all': () => [],
  'plugin:process|process_get_by_instance_id': () => [],
  'plugin:process|process_kill': () => undefined,
  'plugin:install|install_job_list': () => [],
  'plugin:instance|instance_list_game_options_sync_sources': () => [],
  'plugin:instance|instance_list_all_screenshots': () => [],
  'plugin:cache|purge_cache_types': () => undefined,
  // 浏览页：搜索走 Rust 侧的缓存命令，这里直接返回固定结果
  'plugin:cache|get_search_results_v3': () => SEARCH_RESULT_V3,
  'plugin:cache|get_search_results_v3_many': () => [SEARCH_RESULT_V3],
  'plugin:cache|get_search_results': () => SEARCH_RESULT_V3,
  'plugin:cache|get_search_results_many': () => [SEARCH_RESULT_V3],
  'plugin:cache|get_project_v3': (args) =>
    SEARCH_PROJECTS.find((p) => p.project_id === args.id || p.slug === args.id) ?? SEARCH_PROJECTS[0],
  'plugin:cache|get_project': (args) =>
    SEARCH_PROJECTS.find((p) => p.project_id === args.id || p.slug === args.id) ?? SEARCH_PROJECTS[0],
  'plugin:plugins|plugin_list': () => [],
  'plugin:onboarding-checklist|get_onboarding_checklist': () => ({
    has_created_instance: true,
    has_logged_into_minecraft: false,
    has_logged_into_modrinth: false,
    show_checklist: true,
  }),
  'plugin:plugins|plugin_get_plugins_enabled': () => false,

  /* ---- 启动器窗口自己的命令 ---- */
  show_window: () => undefined,
  is_dev: () => false,
  get_import_banner_setting: () => false,
  check_for_import: () => false,
  set_dont_show_import_modal: () => undefined,
  get_background_as_base64: () => null,
  delete_background: () => undefined,
  save_background_image: () => undefined,
  // 真实现返回响应体字符串、失败时抛字符串；这里直接抛 = 「所有更新源都失败」，
  // 前端会当作「已是最新」，不会去解构 null
  fetch_release_metadata: () => {
    throw 'HTTP 404: mock'
  },
  restart_app: () => undefined,
  install_cached_msi: () => undefined,
  download_and_run_msi: () => undefined,
}

/**
 * 兜底：按命令名猜一个不会让界面炸掉的空值。
 *
 *  - `*_list` / `*_many` / `get_*s` → `[]`
 *  - 其余 → `null`
 */
function guess(cmd: string): unknown {
  const name = cmd.includes('|') ? cmd.split('|')[1] : cmd
  if (/(_list|_many|_ids|s)$/.test(name)) return []
  return null
}

export function handle<T>(cmd: string, args: Args): T {
  const fn = HANDLERS[cmd]
  if (fn) return fn(args) as T
  return guess(cmd) as T
}
