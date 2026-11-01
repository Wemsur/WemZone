// @ts-nocheck
/**
 * WemZone 改动：启动器前端不再自己建一套 i18n。
 *
 * 原文件在模块加载时创建第二个 vue-i18n 实例，并在 setLocale 里 fetch
 * `../../../packages/ui/src/locales/*.json` —— 这个相对路径在 WemZone 里指向
 * 仓库外，Vite 会回落到 index.html，`response.json()` 直接抛
 * 「Unexpected token '<'」，整个启动流程失败。
 *
 * 站点的 `installLauncherUi()` 已经建好唯一的 i18n（vendor + 启动器页面的
 * 文案都合并进去了，见 launcher-ui/install.ts），这里直接复用并代理 setLocale。
 */
import { i18n, setLauncherLocale } from '@/launcher-ui/install'

export default i18n

export async function setLocale(requestedLocale: string): Promise<void> {
  setLauncherLocale(requestedLocale)
}
