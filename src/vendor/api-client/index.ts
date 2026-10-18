// @ts-nocheck
// vendor 差异：删除了 `platform/tauri` 的导出（以及该文件本身）。
// 它只在 Tauri 运行时下有意义，且静态 import 了 `@tauri-apps/plugin-http`，
// 留着会让 Vite 解析失败。WemZone 只用 GenericModrinthClient。
export { AbstractModrinthClient } from './core/abstract-client'
export { AbstractFeature, type FeatureConfig } from './core/abstract-feature'
export {
	AbstractSyncClient,
	type SyncConnection,
	type SyncConnectOptions,
	type SyncEventHandler,
	type SyncEventOfType,
	type SyncEventType,
	type SyncStatus,
	type SyncStatusHandler,
	type SyncStatusState,
} from './core/abstract-sync'
export { AbstractUploadClient } from './core/abstract-upload-client'
export {
	AbstractWebSocketClient,
	type WebSocketConnection,
	type WebSocketEventHandler,
	type WebSocketStatus,
} from './core/abstract-websocket'
export { ModrinthApiError, ModrinthServerError } from './core/errors'
export { type AuthConfig, AuthFeature } from './features/auth'
export {
	type CircuitBreakerConfig,
	CircuitBreakerFeature,
	type CircuitBreakerState,
	type CircuitBreakerStorage,
	InMemoryCircuitBreakerStorage,
} from './features/circuit-breaker'
export { type NodeAuth, type NodeAuthConfig, NodeAuthFeature } from './features/node-auth'
export { PANEL_VERSION, PanelVersionFeature } from './features/panel-version'
export { type BackoffStrategy, type RetryConfig, RetryFeature } from './features/retry'
export { type VerboseLoggingConfig, VerboseLoggingFeature } from './features/verbose-logging'
export type { InferredClientModules } from './modules'
export * from './modules/types'
export { GenericModrinthClient } from './platform/generic'
export type { NuxtClientConfig } from './platform/nuxt'
export { NuxtCircuitBreakerStorage, NuxtModrinthClient } from './platform/nuxt'
export { GenericSyncClient } from './platform/sync-generic'
export { XHRUploadClient } from './platform/xhr-upload-client'
export { clearNodeAuthState, nodeAuthState, setNodeAuthState } from './state/node-auth'
export * from './types'
export { withJWTRetry } from './utils/jwt-retry'
export { getNodeWebSocketUrl } from './utils/node-url'
export { pingWebSocketUrl, type WebSocketPingOptions } from './utils/pingtest'
export {
	type ParsedSseEvent,
	type ParsedSseItem,
	type ParsedSseRetry,
	parseSyncEventData,
	SseParser,
} from './utils/sse'
export type { Override, RawDecimal } from './utils/types'
