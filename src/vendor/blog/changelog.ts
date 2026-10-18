// @ts-nocheck
/**
 * `@modrinth/blog` 的 4 行类型替身。
 *
 * 上游 `packages/blog` 只有一处被 vendor 的组件引用，而且只是 `import type`：
 * `ui/components/changelog/ChangelogEntry.vue` 用 `VersionEntry` 做 props 类型。
 * 真正的包含 3.5MB 硬编码的版本日志数据（113MB 含构建产物），vendor 它毫无意义 ——
 * 静态站不展示更新日志。
 *
 * 这里只补回被引用的那个类型，字段与上游 `packages/blog/changelog.ts` 一致。
 * 若将来 Phase 6 真要做「更新日志」页，再把上游那份数据搬进来替换本文件。
 */
import type dayjs from 'dayjs'

export type Product = 'web' | 'hosting' | 'app'

export type VersionEntry = {
  date: dayjs.Dayjs
  product: Product
  version?: string
  body: string
}
