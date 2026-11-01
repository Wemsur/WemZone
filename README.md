# WemZone / 庭域 WemZone

Wemsur 的个人主页。**不是传统竖直滚动网页，而是一整块无限延伸的 3D 平面** ——
内容区块错落分布（向下延伸、左右交替），由一个虚拟摄像机控制当前看哪一部分。

## 开发

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 类型检查 + 构建
npm run typecheck  # 只做类型检查
npm test           # 引擎单元测试
```

## 当前进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 脚手架（Vite + Vue 3 + TS + Tailwind 3 + SCSS） | ✅ 完成 |
| Phase 1 | 相机引擎（占位方块，无真内容） | ✅ 完成 |
| Phase 1.5 | vendor 启动器组件库，打通管线 | ✅ 完成 |
| Phase 2 | 运动模糊 A/B 原型 + 基础交互 | ✅ 完成 |
| Phase 3 | 背景系统（每区独立场景，随区块移动） | ✅ 完成 |
| Phase 4 | 内容填充（首页/启动器占位/其它作品/视频/联系） | ✅ 完成（文案待你改） |
| Phase 5 | 交互调参 + 移动端适配 + 无障碍/打印兜底 + 生产 API | ✅ 完成（部署待做） |
| Phase 6 | 启动器 5 页面复刻 | 🚧 进行中（外壳 + 外观设置页完成，其余 4 页待做） |

## 文档

| 文件 | 内容 |
|---|---|
| [docs/DISCOVERY.md](docs/DISCOVERY.md) | 三轮需求访谈全文、已确认决策表、核实过的技术事实 |
| [docs/DESIGN.md](docs/DESIGN.md) | 架构决策与理由（为什么这样做、为什么不那样做） |
| `~/.claude/plans/40-a-41-b-bubbly-dolphin.md` | 分阶段开发路径（会话计划文件） |

## 部署

静态站点 + 一个 Serverless 函数：

- `npm run build` 产出 `dist/`，直接托管即可（`base: './'`，可放子路径）。
- `api/bilibili/videos.ts` 是 B 站代理（Vercel 会自动识别 `api/` 目录）。
  没有它站点也能跑 —— 前端会退回构建时快照 `src/data/videos.json`。
- 刷新快照：`node scripts/fetch-bilibili.mjs`。

## 硬性约束

1. **「庭域」出现时必须跟 WemZone**。
2. **动画量由摄像机状态驱动，不是滚动位置** —— 与 Celestial-Web 的 scrub 模型相反。
3. **每帧主线程只写 1 次 transform**（`#world`），帧内零 `getBoundingClientRect`。
4. **`IDLE` 时不排 rAF** —— 空闲晃动交给 CSS 合成动画，静止时主线程零开销。
5. **引擎永不逐帧写响应式状态** —— 连续数据走 `useCameraFrame` 命令式写 DOM。
6. **复刻件的视觉效果必须与 Celestial Launcher 完全相同**（Phase 6 的硬验收）。

## 技术栈

Vue 3.5 + Vite 6 + TypeScript + **Tailwind 3.4.19**（与 Celestial Launcher 同源，
不是 Celestial-Web 的 v4）+ SCSS + Vitest。引擎是框架无关的 vanilla TS。

启动器的 UI 组件库（`@modrinth/ui` 等）以源码形式 vendor 在 `src/vendor/`，
接线方式见 [docs/DESIGN.md](docs/DESIGN.md) 第十一节。
