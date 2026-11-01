/**
 * 启动器 UI 的运行时接线 —— Provider 全家桶。
 *
 * 模板来自 `CelestialLauncher/packages/ui/.storybook/preview.ts` 的
 * `StorybookProvider`，但做了两处 WemZone 需要的调整：
 *   1. 用 `GenericModrinthClient`（ofetch，纯浏览器）而不是 `TauriModrinthClient` —— 不需要 Tauri
 *   2. 通知管理器实现成真实可用的内存版，而不是 Storybook 的占位
 *
 * 为什么需要这些：vendor 的 734 个组件里，大量组件在 `setup()` 里直接
 * `injectXxx()`，而 `createContext` 的实现是「没有 provider 就 throw」
 * （不是静默降级）。所以只要渲染到依赖某个 provider 的组件，缺一个就白屏。
 */

// 样式与 install 绑定在一起：只有真正加载启动器组件库时才下载这 300KB CSS，
// 并且一定排在 main.css 之后（vendor 令牌要覆盖 WemZone 的同名令牌）。
import '@/styles/launcher.scss'

import { GenericModrinthClient, type Labrinth } from '@modrinth/api-client'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import FloatingVue from 'floating-vue'
import type { App } from 'vue'
import { defineComponent, h, provide, ref, type Ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  AbstractPopupNotificationManager,
  AbstractWebNotificationManager,
  buildLocaleMessages,
  createMessageCompiler,
  I18N_INJECTION_KEY,
  provideFilePicker,
  provideModrinthClient,
  provideNotificationManager,
  providePopupNotificationManager,
  provideTags,
  type CrowdinMessages,
  type I18nContext,
  type NotificationPanelLocation,
  type PopupNotification,
  type WebNotification,
} from '@/vendor/ui'

/** 只保留 en-US。其余 32 种语言在 vendor 时已删除，这里 glob 不会命中。 */
// 注意：import.meta.glob 的模式是相对路径，不认 tsconfig 的 paths 别名。
const localeModules = import.meta.glob<{ default: CrowdinMessages }>(
  '../vendor/ui/locales/*/index.json',
  { eager: true },
)

export const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messageCompiler: createMessageCompiler(),
  missingWarn: false,
  fallbackWarn: false,
  messages: buildLocaleMessages(localeModules),
})

/**
 * 内存版通知管理器。
 *
 * 上游 Storybook 用的是同样的思路；这里保留完整实现而不是 stub，
 * 因为通知相关组件（NotificationPanel / PopupNotificationPanel）
 * 会真的读写这些状态。WemZone 不需要持久化。
 */
class MemoryWebNotificationManager extends AbstractWebNotificationManager {
  private readonly state = ref<WebNotification[]>([])
  private readonly locationState = ref<NotificationPanelLocation>('right')

  getNotificationLocation(): NotificationPanelLocation {
    return this.locationState.value
  }

  setNotificationLocation(location: NotificationPanelLocation): void {
    this.locationState.value = location
  }

  getNotifications(): WebNotification[] {
    return this.state.value
  }

  protected addNotificationToStorage(notification: WebNotification): void {
    this.state.value.push(notification)
  }

  protected removeNotificationFromStorage(id: string | number): void {
    const index = this.state.value.findIndex((n) => n.id === id)
    if (index > -1) this.state.value.splice(index, 1)
  }

  protected removeNotificationFromStorageByIndex(index: number): void {
    this.state.value.splice(index, 1)
  }

  protected clearAllNotificationsFromStorage(): void {
    this.state.value.splice(0)
  }
}

class MemoryPopupNotificationManager extends AbstractPopupNotificationManager {
  private readonly state = ref<PopupNotification[]>([])

  getNotifications(): PopupNotification[] {
    return this.state.value
  }

  protected addNotificationToStorage(notification: PopupNotification): void {
    this.state.value.push(notification)
  }

  protected removeNotificationFromStorage(id: string | number): void {
    const index = this.state.value.findIndex((n) => n.id === id)
    if (index > -1) this.state.value.splice(index, 1)
  }

  protected clearAllNotificationsFromStorage(): void {
    this.state.value.splice(0)
  }
}

/** 纯浏览器 client：不碰 Tauri，走 fetch/ofetch。 */
export const modrinthClient = new GenericModrinthClient({
  userAgent: 'wemzone/0.1.0',
})

/** 标签（游戏版本 / 加载器）是全站共享的异步数据，用一个模块级 ref 缓存。 */
export const gameVersions: Ref<Labrinth.Tags.v2.GameVersion[]> = ref([])
export const loaders: Ref<Labrinth.Tags.v2.Loader[]> = ref([])

let tagsLoading: Promise<void> | null = null

/**
 * 懒加载标签数据。组件树里很多下拉框依赖它，但首屏不需要 ——
 * 所以不在 install 时阻塞，而是给个可重复调用的入口。
 */
export function ensureTagsLoaded(): Promise<void> {
  tagsLoading ??= modrinthClient.labrinth.state
    .build()
    .then((state) => {
      gameVersions.value = state.gameVersions
      loaders.value = state.loaders
    })
    .catch(() => {
      // 离线 / API 不可达时保持空数组：组件会显示空下拉框而不是崩溃
      tagsLoading = null
    })
  return tagsLoading
}

/**
 * 安装启动器 UI 需要的**插件**（app.use）与全局组件。
 *
 * provider 不在这里 —— `provide()` 只能在组件的 `setup()` 里调用，
 * 见下方的 `LauncherUiProvider`。
 *
 * 注意 `#teleports`：vendor 组件里大量使用
 * `<Teleport to="#teleports">`（弹窗、下拉、tooltip）。这个目标节点
 * 必须存在于 DOM 里，否则 Vue 会警告并且内容无处可去。
 */
export function installLauncherUi(app: App): void {
  // vendor 组件大量使用 <Teleport to="#teleports">，目标节点要先存在
  ensureTeleportTarget()

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  app.use(VueQueryPlugin, { queryClient })
  app.use(i18n)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  app.use(router)

  app.use(FloatingVue, {
    themes: {
      // 这两个 theme 是组件硬依赖（v-tooltip 的 theme 名写死在模板里），
      // 不注册的话 tooltip 会以未样式化状态出现或直接不显示。
      'ribbit-popout': {
        $extend: 'dropdown',
        placement: 'bottom-end',
        instantMove: true,
        distance: 8,
      },
      'dismissable-prompt': {
        $extend: 'dropdown',
        placement: 'bottom-start',
      },
    },
  })

  // Nuxt / Storybook 环境里由框架提供的全局组件。静态站没有它们，
  // 但 vendor 组件模板里会用到。
  //
  // RouterLink 不注册：vue-router 的 app.use 已经注册了它，再注册会警告。
  const LinkStub = defineComponent({
    name: 'LinkStub',
    inheritAttrs: false,
    props: { to: { type: [String, Object], default: '' } },
    setup(props, { attrs, slots }) {
      const href = () => {
        if (typeof props.to === 'string') return props.to || '#'
        if (props.to && typeof props.to === 'object' && 'path' in props.to) {
          const p = (props.to as { path?: unknown }).path
          return typeof p === 'string' ? p : '#'
        }
        return '#'
      }
      return () => h('a', { ...attrs, href: href() }, slots.default?.())
    },
  })
  const ClientOnlyStub = defineComponent({
    name: 'ClientOnly',
    setup(_, { slots }) {
      return () => slots.default?.()
    },
  })
  app.component('NuxtLink', LinkStub)
  app.component('ClientOnly', ClientOnlyStub)
}

/**
 * Provider 全家桶的宿主组件。
 *
 * **必须**包住任何使用 vendor 组件的子树：`createContext` 的实现是
 * 「没有 provider 就 throw」，而不是静默降级。这里把 provider 放进
 * `setup()`，这是 Vue 唯一允许 `provide()` 的时机。
 *
 * 模板里用法：
 *   <LauncherUiProvider><Button>…</Button></LauncherUiProvider>
 */
export const LauncherUiProvider = defineComponent({
  name: 'LauncherUiProvider',
  setup(_, { slots }) {
    provideNotificationManager(new MemoryWebNotificationManager())
    providePopupNotificationManager(new MemoryPopupNotificationManager())
    provideModrinthClient(modrinthClient)
    provideTags({ gameVersions, loaders })
    provideFilePicker({
      async pickImage() {
        return null
      },
      async pickModpackFile() {
        return null
      },
    })

    // useVIntl() 走的是 I18N_INJECTION_KEY（自定义 context），
    // 不是 vue-i18n 自带的 useI18n —— 两个都要给。
    const i18nContext: I18nContext = {
      locale: i18n.global.locale,
      t: (key, values) => i18n.global.t(key, values ?? {}) as string,
      setLocale: (newLocale) => {
        i18n.global.locale.value = newLocale
      },
    }
    provide(I18N_INJECTION_KEY, i18nContext)

    return () => slots.default?.()
  },
})

/** 确保 `<div id="teleports">` 存在。放在 body 末尾，z-index 由具体浮层控制。 */
export function ensureTeleportTarget(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('teleports')) return
  const el = document.createElement('div')
  el.id = 'teleports'
  document.body.appendChild(el)
}
