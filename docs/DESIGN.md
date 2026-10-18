# 设计与实现规范

> 本文写「为什么这样做」以及「为什么不那样做」。具体的函数签名与常量见代码
> （`src/engine/`），内容编排见 `docs/CONTENT.md`（Phase 4 起填充）。

## 零、这个项目和 Celestial-Web 的根本区别

Celestial-Web 是 **scrub 模型**：动画量是滚动位置的纯函数，滚多少动多少，手停动画就停。
它甚至用 CSS 强制禁用了全站所有 `transition` / `animation`。

WemZone 要的四件事与它**正面冲突**：

| 需求 | 为什么 scrub 做不到 |
|---|---|
| 微弱滚动 → 位移一下再弹回（果冻） | 需要弹簧物理 + 回正，scrub 只会停在滚到的位置 |
| 一次滚动只前进一区，滚多少都一样 | 需要意图识别 + 状态机 + 输入锁定 |
| 切换时先慢后快再慢 | 需要按时间走的补间，scrub 是位置驱动 |
| 无滚动时相机持续轻微晃动 | 需要常驻时间驱动的动画，正是它明令禁止的 |

所以驱动模型换成「意图识别 → 连续力学 → 摄像机状态」。
但**「状态 → 画面」那一层纯函数映射可以完整继承** —— `src/lib/ease.ts` 从
Celestial-Web 原样复制，零改动。

---

## 一、分层与数据流

```
input.ts ──Intent──▶ camera.ts (连续力学) ──displayIndex──▶ spatial.ts ──CameraPose──▶ world.ts
  wheel/touch/key       s, v, anchor, inputForce             centripetal CR      1 次 transform 写入
  physics.ts（a = 势能 + 阻尼 + 锚定 + 输入）                                        └─▶ blur.ts
  idle.ts（CSS 动画，合成线程，与 rAF 解耦）
```

**核心不变量：每帧主线程只写 1 次 transform**（转场峰值最多再加 1 次 filter）。
几何在启动时全部算完，**帧循环内零 `getBoundingClientRect`**。这是相对
Celestial-Web 最大的结构差异 —— 它每帧要读每个 section 的 rect。

---

## 二、空间模型（`spatial.ts`）

每区一个 `Stop { id, x, y, d, rx, ry }`。相机路径穿过所有停靠点。

### 为什么是 centripetal Catmull-Rom

停靠点在 Y 上等距、X 上左右交替，是一条**折线状的锚点序列**。

- **uniform CR**：急转处会过冲 —— 相机甩出脊线外再拉回来，看起来像打嗝。
  centripetal（α = 0.5）从数学上杜绝 cusp 与 overshoot。实测本项目里
  uniform 首段过冲 0.485rem，centripetal 只有 0.193rem。
- **Bézier**：要手工摆控制柄，改一个锚点得重调两个柄。CR 只依赖四个相邻锚点。
- **直线段 + smoothstep**：切线在锚点处不连续，相机会在每一站「拐一下」。

### 端点处理：复制而非镜像

试过三种「幽灵点」替代方案（镜像 `2·P[0]−P[1]`、线性外推、半镜像），
实测在本项目这种左右交替的折线锚点上**它们全都比复制端点更差**
（首段过冲 0.25~0.28rem vs 0.19rem）。原因是镜像/外推把端点切线拉向
「折回」方向，而这个方向恰好与首段真实走向相冲。复制端点让端点切线为零
（自然起步），是这里最平顺的选择。

残余的 0.19rem 过冲（约 0.7% 振幅）**只出现在首段**，内段是严格 0。
对相机路径来说这点过冲反而像「入弯」，观感自然。

### 位置走 CR，标量走线性

`x` / `y` 决定路径形状，走 CR。`d` / `rx` / `ry` 走**线性插值** ——
转场的「先慢后快再慢」由时间缓动提供（`tween.ts`），路径再套一次缓动会叠出
双重缓动，转场像「顿两下」。线性也保证这三个量不过冲。

**分工：spatial 只决定「形状」，camera/tween 只决定「快慢」。二者正交。**

---

## 三、CSS 3D 写出（`world.ts`）

### DOM 四层，只有第 3 层每帧被写

```
#stage (fixed, overflow:hidden)
  .blur-layer                     ← filter 加在这里（#viewport 外面）
    .drift-outer                  ← 空闲晃动的平移分量（无透视放大）
      #viewport                   perspective: 120rem; perspective-origin 固定
        .drift-inner              ← 空闲晃动的旋转分量（在透视里）
          #world                  transform: <每帧写>
            section[data-i]       transform: <静态，启动时写一次>
```

**两个必须记住的约束**：

1. `.drift-*` 带 transform（动画），而带 transform 的元素会成为后代绝对定位的
   包含块。它们默认高度为 0（里面只有绝对定位的子元素），于是 `#viewport` 用
   `inset: 0` 会塌成 0 高。**必须显式 `position: absolute; inset: 0`。**
2. `filter` 是分组属性，会让元素的 `transform-style` 变成 `flat`，而 `flat`
   **截断透视** —— `#viewport` 的 `perspective` 传到 `flat` 那一层就不再往下传。
   所以 `.blur-layer` 必须在 `#viewport` **外面**。

### 相机平移全进 `#world`，不写 `perspective-origin`

纯 `translate` 本身就有 z 相关视差（屏幕位移 = `tx·P/(P−z)`），所以
`perspective-origin` 并非「唯一能产生真实视差的做法」。固定它少一次写入，
也避免部分浏览器上改它触发层重新分配。

### 每帧的变换：平移量必须抵消旋转

摄像机在 (px, py)、距内容面 d、带倾角 (rx, ry)。变换是：

```
translate3d(tx, ty, tz) rotateX(rx) rotateY(ry)
  其中 t = (0, 0, P − d) − R·(px, py, 0)
```

小角度下 R ≈ I，`t ≈ (−px, −py, P − d)`，但**大角度下这一项不能省** ——
否则全览模式里内容会跑偏。

### 距离变、大小不变

`#world` 把内容面推到 z = `P − d`，投影缩放 = `P / d`。每个 section 的
**静态** transform 带反向补偿 `scale(d_i / P)`，于是：

- 静止时净缩放 = `(P/d_i)·(d_i/P) = 1` —— **视觉大小恒定**。
- 转场途中 `d(t)` 连续变化，净缩放 = `d_i/d(t)` —— 内容随镜头推拉轻微缩放，
  落位精确回到 1。这正是「推拉镜头」该有的观感。

**补偿是静态的，不进每帧循环。** 若做「每帧实时补偿」，每帧写入从 1 次变成
N 次，违背整个架构的性能前提。

`transform-origin` 必须是 `0 0`：静态 transform 是
`translate3d(x,y,0) scale(s) translate(-50%,-50%)`，只有在原点为左上角时，
(x, y) 才正好落在内容块中心。

`PERSPECTIVE = 120rem`，不用 Celestial-Web 的 160：160 太远，投影接近正交，
z 相关视差几乎看不见。

---

## 四、输入层（`input.ts`）

### 核心难题：触控板惯性

精密触控板一次滑动产生 **50–200 个 wheel 事件**，手指抬起后还有衰减的动量尾巴。
若逐事件判「够不够一格」，一次猛滑会连切三四区。

判据必须是**手势级而非事件级**：

- 维护 `accum / lastT / committed`，手势之间靠 `GESTURE_GAP_MS` 的静默切分。
- **一次手势最多提交一个 step**：`committed` 一旦置真，本次手势剩下的事件
  （含整条惯性尾巴）全部丢弃。
- 提交后还有 `GESTURE_COOLDOWN_MS` 冷却，吃掉尾巴余波。

**实测**：模拟一次触控板猛滑（8 个手指事件 + 50 个衰减的惯性事件）→ 恰好前进 1 格。

### 阈值

滚轮一格约 100px < `STEP_THRESHOLD_PX`(150) → **只抖不切**（pull），
与访谈确认的「滚轮一格算微弱」一致。两格连击（约 200px）越过阈值 → step。
触控板猛滑：速度分支（≥3 px/ms 且累计 ≥40px）在滑到 40px 时就提交。

---

## 五、连续力学（`physics.ts` / `camera.ts`）

**没有状态机。** 相机是一个受力运动的质点，整站只有一个方程：

```
a = F_势能 + F_阻尼 + F_锚定 + F_输入
```

果冻回弹、切换、落位都是它的不同能量状态，不是不同代码路径。

### 势能：每个区块中心是一个吸引中心

```
U(s) = (k / (2π)²) · (1 − cos 2πs)
F(s) = −dU/ds = −(k / 2π) · sin(2πs)
```

极小值在整数 `s`（区块中心），极大值在半整数（区块之间）。
近井底时 `F ≈ −k·(s − i)`，是标准谐振子，`ω = √k`。

**为什么用周期余弦而不是对每个中心求 `1/r²` 引力**：`1/r²` 在中心处发散，
数值上会把相机吸成一个点；有限个中心的引力不周期，边缘区块的平衡点会偏移。
余弦势是「一整个晶格的中心」的平滑极限，形状一致、处处可导、无奇点。

### 两层职责：意图决定去哪，力学决定怎么走

| 层 | 决定什么 |
|---|---|
| **意图**（`input.ts`） | 目标井是哪个。一次手势最多 ±1，保证「一次滚动只走一格」 |
| **力学**（`physics.ts`） | 怎么走过去。轨迹的「先慢后快再慢」全部来自方程本身 |

**为什么需要「锚定」这一项**：纯物理阈值很诱人（滚得够猛就越过势垒），但实测不行 ——
真实滚轮是一串离散冲量，间隔约 50ms，阻尼在这段时间里已经耗散掉大半能量。
实测 k=30 时要连续 8 格才能勉强过去，而 k=20 时单次冲量要 dv=4.0，
输入量与「一格」的对应关系完全失控。用户要求「一次滚动只走一格」，
这个约束靠能量阈值**涌现**出来是不可控的（同样滚一格，快滚和慢滚差几倍）。

所以分成两层：意图层定目标，力学层走过程。物理仍然是连续的、没有状态机，
只是多了一个「目的地」。这没有削弱手感 —— 轨迹的「先慢后快再慢」全部来自方程。

### 实测轨迹（k=45, c=12, ζ≈0.89）

```
t(ms)   s       v
    0   0.000   0.000     ← 起步：速度从 0 加速
   48   0.089   2.023
  112   0.240   2.408     ← 峰值
  176   0.387   2.209
  240   0.520   2.023
  304   0.645   1.928
  432   0.867   1.481
  560   0.992   0.578     ← 开始减速
  624   1.014   0.231     ← 轻微过冲（2%）
  752   1.017  -0.073     ← 回弹
 1008   1.000  -0.025     ← 落位
```

总时长约 1.04 秒。过冲只有 2%，回弹很克制 —— 这就是 ζ≈0.89 的「果冻」。

### 为什么用半隐式欧拉

显式欧拉在弹簧系统上会随 dt 增大而发散。半隐式（先更新速度、再用新速度
更新位置）对谐振子是无条件稳定的（辛积分器），实现只有两行。
另外对 dt 做了子步切分，避免标签页切回来时一帧跨过好几个井。

### 停帧

当相机静止在目标井、且没有待处理输入力时，`tick` 返回 false 让 rAF 停下
—— 这是「静止时主线程零开销」的实现。空闲晃动交给 CSS 合成动画（第七节）。

---

## 六、输入力与帧纪律（`input.ts` / `scheduler.ts`）

### 滚动在力学里是「外力」，不是「位置」

`pull` 意图不再直接改位移，而是往系统里注入力：

```
inputForce += Δ · PULL_FORCE_GAIN        // 持续分量：按住滚轮时一直在推
velocity   += Δ · PULL_IMPULSE_GAIN      // 冲量分量：一次事件给一下初速
```

`inputForce` 以 **90ms 半衰期**指数衰减 —— 手指停下后力自然消失，
相机随后只受势能与阻尼支配。这就是「位移一下再弹回」的来源：
没有代码在检测「滚动结束了」，是力自己衰减掉了。

**为什么同时给力和冲量**：只给力则轻滚几乎无感（力在 90ms 内就衰减）；
只给冲量则快速连滚的动能不叠加（每个事件都是独立的初速覆盖）。
两者叠加后，缓慢滚动表现为「持续推、慢慢回」，快速滚动表现为「一下弹出去」。

### 帧纪律

`dt = min(now − last, 100)`，然后按 `substepCount()` 切成 ≤1/60s 的子步。
上限 100ms 防止标签页切回来后一帧走完一整段路；子步保证大步长下数值稳定。

**`dt` 用 `performance.now()` 而非帧计数** —— 与 `chase()` 用半衰期而非
「每帧百分比」是同一条理由：手感与刷新率无关（60Hz / 144Hz / 120Hz 一致）。

---

## 七、空闲晃动（`main.css` 的 `drift-*`）

需求要求「静止也活着」，与 Celestial-Web 的铁律相反，是**刻意取舍**。
解法不是放弃零开销，而是**把常驻动画从主线程挪到合成线程**：CSS 动画跑在
compositor 上，`IDLE` 时 rAF 完全不排，Performance 面板看不到持续的 frame 回调。

### 分两层，且平移在外、旋转在内

一个元素只能有一条 `transform`（两条动画会互相覆盖），所以分两层。
关键是**哪一层在透视容器里**：

| 分量 | 位置 | 为什么 |
|---|---|---|
| 平移 `translate3d` | `#viewport` **外面** | 在透视容器内做平移会被投影放大：内容在 z ≈ 1300px 处，缩放系数 `P/(P−z) ≈ 3.5`，1px 的 3D 位移变成 3.5px 屏幕位移 |
| 旋转 `rotateX/Y` | `#viewport` **里面** | 旋转本身不产生位移，但让不同深度的内容移动不同距离 —— 这才是「相机在浮动」的来源。视口边缘横移几个像素读起来是「整页在滑」，零点几度的倾斜读起来才是「相机在飘」 |

### 幅度是按实测反推的，不能凭直觉写

**踩过的坑**：

- 平移 0.85rem 放进透视容器 → 屏幕偏移 **153px**（约视口 10%），完全失控。
- 旋转 1.4° → 屏幕跨度 **64px**（约视口 4%），仍然过大。
- 最终值：平移 ±0.12rem、旋转 ±0.15° → 跨度约视口 **0.55%–0.73%**（约 9–11px），
  既「轻微」又看得见。

`src/engine/drift.test.ts` 会读 CSS 校验这些幅度落在区间内 —— 改数值时必须同步改测试。

### 周期互质

11s 与 17s 互质 → 合成 187s 的拍频，肉眼永远看不出规律。这正是需求里
「两个不同频率正弦叠加」要的效果。

---

## 八、与 Vue 的边界

**引擎永不逐帧写响应式状态。**

- `useCamera()` 只暴露**离散**状态（`current` 整数区块号、`state` 状态名）。
  `current` 只在整数变化时更新 → 响应式更新频率从 60Hz 降到「每次切换 1 次」。
- 需要每帧数据的组件走 `useCameraFrame(cb)` **命令式订阅 + 直接写 DOM / CSS 变量**，
  完全不经过 Vue 渲染。
- 绝不 `ref()` 一个 pose 对象；若必须，用 `shallowRef` + `markRaw`。

---

## 九、运动模糊（Phase 2 待做）

CSS 的 `blur()` 是各向同性的，像失焦不像运动。两套方案：

- **A（预期生产）**：各向同性 blur（封顶 6px）+ 沿运动轴拉伸（`scaleX`）+
  方向性拖影叠加层（`mix-blend-mode: screen`，不复制 DOM，只画一道方向性光晕）。
- **B**：SVG 各向异性 `feGaussianBlur`（`stdDeviation="sx sy"`，真正的方向性）。
  **诚实评估：作用在大面积 DOM 子树上极慢** —— 每帧改 `stdDeviation` 会触发
  整个 filter region 的软件重光栅化。**只作原型对比。**

Phase 2 会把 A/B 都做出来给用户对比，附实测帧率。

---

## 十、踩过的坑（速查）

| 坑 | 症状 | 解法 |
|---|---|---|
| `.drift-*` 未显式定位 | `#viewport` 塌成 0 高，什么都不显示 | `position: absolute; inset: 0` |
| `filter` 加在透视容器内 | 3D 场景当场拍平，区块全部堆在中心 | 模糊层放 `#viewport` **外面** |
| 平移放进透视容器 | 晃动幅度被放大 3.5 倍，153px 的偏移 | 平移放外层，只有旋转留内层 |
| `IDLE` 未 `return false` | 循环永不停止，静止零开销失效 | 补 `else` 分支返回 false |
| `ensureFrame` 早退 | 首次转场后引擎永久死掉 | 导出 `wake()`，已注册时唤醒而非返回 |
| `transform-origin: 50% 50%` | 内容块中心偏移 (w/2, h/2) | 用 `0 0` |
| `tsconfig.node.json` 用 `noEmit` | TS6310：被引用的 project 不能禁用 emit | 改 `emitDeclarationOnly` + `outDir` |
| 预览标签页后台节流 | rAF 降到 ~1fps，转场看起来要好几秒 | 用假时钟的单元测试验证，别信后台标签页的计时 |
| 速度分支判「猛滑」 | 滚轮一格被当成猛滑，两格就翻页 | 判据是**粒度**不是速度：`TRACKPAD_MAX_EVENT_PX` |

---

## 十一、启动器组件库的 vendor 接线（Phase 1.5）

目标：**渲染的必须是启动器本人**，不是仿制品。为此把上游的包以**源码**形式
复制进 `src/vendor/`，让 WemZone 的构建链直接编译它们。

### 11.1 搬了什么、没搬什么

| 上游 | 落点 | 处理 |
|---|---|---|
| `packages/ui/src`（377 个 `.vue`） | `src/vendor/ui/` | 整体搬。删 `stories/`（120 文件）、除 `en-US` 外的 32 种语言 |
| `packages/assets` | `src/vendor/assets/` | 整体搬（312 图标 + `omorphia.scss` + `styles/` + branding） |
| `packages/utils` | `src/vendor/utils/` | 整体搬 |
| `packages/api-client/src`（116 文件） | `src/vendor/api-client/` | 搬，删 `platform/tauri.ts`（见 11.4） |
| `tooling-config/tailwind/tailwind-preset.ts` | `src/vendor/tooling/` | 原文搬入，只改 import 路径 |
| `packages/blog` | `src/vendor/blog/changelog.ts` | **只补 4 行类型**。真包含 3.5MB 硬编码版本日志，且唯一引用是 `import type` |

体积：`src/vendor/` 约 12MB（不含 `node_modules`），`ui/` 6MB、`assets/` 5.3MB。

### 11.2 七条接线，缺一条就白屏或没样式

**① `#ui/*` alias（229 个文件）**

上游 `packages/ui/package.json` 有 `"imports": { "#ui/*": "./src/*" }`。
vendor 后 `src/` 被拍平，所以 alias 指向 `src/vendor/ui/*`。
`vite.config.ts` 与 `tsconfig.json` 的 `paths` **两处都要配** ——
Vite 管构建、TS 管类型，少一个就是「能跑但编辑器满屏红」或反之。

同一批 alias 还有 `@modrinth/{ui,assets,utils,api-client}`。
**必须用正则**而不是字符串 find：字符串形式的 alias 在 `@modrinth/ui/src/x`
这类子路径上会匹配错（`@modrinth/ui` 先命中，把 `/src/x` 当成子路径拼）。

**② `vite-svg-loader` 的 svgoConfig 逐字节相同**

```ts
svgoConfig: { plugins: [{ name: 'preset-default', params: { overrides: {
  removeViewBox: false,      // 去掉后 SVG 不能随容器缩放
  cleanupIds: { minify: false }, // id 被重编号 → 同页多图标 <use>/clipPath 串味
} } }] }
```

验收证据：演示页里图标 `viewBox="0 0 24 24"` 保留、渲染为 16px。

**③ `sass` + `silenceDeprecations: ['import']`**

`omorphia.scss` 及其 6 个子文件全用 legacy `@import`。不静默会刷几百行弃用警告。

**④ Tailwind content glob 必须覆盖 vendor**

最易漏，症状是「DOM 结构对、但完全没样式」——Tailwind 只扫描 `content`
里出现过的类名来生成 CSS。`tailwind.config.ts` 里显式写了
`./src/vendor/**/*.{vue,ts,js}`（虽然 `./src/**` 理论上已覆盖，显式写是为了
文档化这条依赖，防止将来收窄 content 时静默失效）。

**⑤ i18n：`vue-i18n@10` + `intl-messageformat` + `provideI18n()`**

**203 个组件硬依赖 `useVIntl`，缺了直接 throw（不是静默降级）。**
`useVIntl` 走的是自定义的 `I18N_INJECTION_KEY`，不是 vue-i18n 的 `useI18n` ——
两个都要给：`app.use(i18n)` + `app.provide(I18N_INJECTION_KEY, context)`。
消息用 `buildLocaleMessages()` + `createMessageCompiler()` 装配，
后者是 `IntlMessageFormat` 的薄封装（ICU 语法，含复数/选择）。

**⑥ Provider 全家桶**

模板抄自 `packages/ui/.storybook/preview.ts` 的 `StorybookProvider`。
**关键修正**：`provide()` 只能在组件 `setup()` 里调用，不能放在 `app.use()`
旁边。初版写错时的症状是 5 条 `[Vue warn]: provide() can only be used inside setup()`
＋ 组件注入时 throw。所以做成了 `LauncherUiProvider` 组件，包住所有用到
vendor 组件的子树。

用 `GenericModrinthClient`（ofetch，纯浏览器），不需要 Tauri。

**⑦ FloatingVue 的两个 theme + teleport 目标 + ClientOnly**

- `app.use(FloatingVue, { themes: { 'ribbit-popout': …, 'dismissable-prompt': … } })`
  —— 这两个 theme 名写死在组件模板里，是硬依赖。
- `<div id="teleports">` —— 组件里大量 `<Teleport to="#teleports">`。
- `app.component('ClientOnly', …)` 与 `NuxtLink` —— Nuxt/Storybook 环境提供，
  静态站没有。`RouterLink` **不要**手动注册（vue-router 已注册，会警告冲突）。

### 11.3 样式加载顺序

```
main.css      Tailwind 指令 + WemZone 令牌 + 上游 tailwind-utilities.css
launcher.scss omorphia.scss（variables → normalize → classes → defaults …）
```

`launcher.scss` **不含** `@tailwind` 指令 —— 两份 CSS 各写一遍会产出两套完整
工具类。`tailwind-utilities.css` 含 `@layer utilities`，必须与
`@tailwind utilities` 同处一份 CSS，所以也放在 `main.css` 里。

**主题 class 必须挂 `<html class="dark-mode">`**：`variables.scss` 里
`html` 默认套 `.light-properties`，只有 `.dark-mode` 才切到暗色令牌。
不挂的症状是「组件结构对但颜色全反」。这是启动器组件的令牌选择，
与 WemZone 自己的 `--brand-hue` 主题系统是两回事。

### 11.4 vendor 差异清单（对上游源码的全部改动）

1. **删 `platform/tauri.ts`** 及其两个导出。它静态 import `@tauri-apps/plugin-http`，
   留着会让 Vite 解析失败；WemZone 只用 `GenericModrinthClient`。
2. **修 `ServerListing.vue` 的相对路径**：`../../../../assets/generated-icons`
   → `../../../assets/…`。上游从 `packages/ui/src/components/servers/` 出发是四级，
   vendor 后少了一层 `src/`。
3. **`@ts-nocheck`**：vendor 里所有 `.vue` 的 `<script>` 内与 `.ts` 文件首行。
   **理由**：上游 `packages/ui` 从来没有类型检查脚本，消费端 app 的
   `typecheck` 跑的又是根 `tsconfig.json`（`"files": []` + references）——
   也就是说这 129 个类型错误在上游**一直存在，只是从未被检查到**。
   在 vendor 处加 `@ts-nocheck` 只压制 vendor 内部，**WemZone 调用 vendor 的
   类型检查仍然生效**（`VendorDemo.vue` 的 props 错误照样报出来）。
   注：`<!-- @ts-nocheck -->` 在 SFC 顶层**无效**，必须放进 `<script>` 块内。
4. **删 telemetry**：vendor 的 ui 里本就没有 `posthog`/`@sentry` 引用
   （它们在 `apps/app-frontend` 页面层）。已确认零残留。
5. **`@modrinth/blog`** 用 `src/vendor/blog/changelog.ts` 的 4 行类型替身。
6. 删 `stories/`、非 `en-US` 语言、`.turbo/`、`node_modules` 软链、构建脚本。

### 11.5 验收结果

`src/components/VendorDemo.vue` 渲染了 vendor 的 `Button` / `IconButton` /
`Toggle` / `IntlFormatted`，实测（DevTools 读取的计算样式）：

| 检查点 | 结果 |
|---|---|
| 主题令牌 | `--surface-4: #34363c`、`--color-brand: #1bd96a`（启动器暗色原值） |
| Button md | 高 28.8px、圆角 9.6px、字重 600、`inset 0 0 0 1px #42444a` 内阴影 |
| 尺寸阶梯 | xs 22.4 / sm 25.6 / md 28.8 / lg 32 / xl 38.4px；xl 字重 800 |
| 类型变体 | base=`--surface-4`、colored=`#1bd96a`、outlined 透明+蓝字、quiet 透明+`--color-base` |
| SVG 图标 | `viewBox` 保留、随按钮尺寸渲染 16px |
| 交互 | 点击计数 +1、`loading` 时 `disabled` 与 `aria-busy="true"` |
| i18n | `IntlFormatted` 的 `label.yes` → `Yes` |

`npm run build` 与 `npx vitest run`（64 测试）均通过。

### 11.6 后续接页面时要注意

- 任何用到 vendor 组件的子树**必须**包在 `<LauncherUiProvider>` 里。
- 相机世界里的 section 是 `absolute` + 父级宽 0，内容块**必须显式给宽度**；
  `max-width: 90vw` 这类百分比/视口单位在 0 宽包含块下会算出荒谬值。
- 需要游戏版本/加载器下拉时调 `ensureTagsLoaded()`（懒加载，不阻塞首屏）。
