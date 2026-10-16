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

所以驱动模型换成「意图识别 → 状态机 → 弹簧/补间 → 摄像机状态」。
但**「状态 → 画面」那一层纯函数映射可以完整继承** —— `src/lib/ease.ts` 从
Celestial-Web 原样复制，零改动。

---

## 一、分层与数据流

```
input.ts ──Intent──▶ camera.ts (状态机) ──displayIndex──▶ spatial.ts ──CameraPose──▶ world.ts
  wheel/touch/key      IDLE/PULL/TRANSIT/SETTLE              centripetal CR      1 次 transform 写入
  spring.ts (PULL) / tween.ts (TRANSIT)                                              └─▶ blur.ts
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

## 五、状态机（`camera.ts`）

| 状态 | 含义 | 帧循环 |
|---|---|---|
| `IDLE` | 停在整数 index，只余 CSS 空闲晃动 | **不排 rAF**（零主线程开销） |
| `PULL` | 微弱滚动给了弹簧冲量，相机偏离后回弹 | rAF 跑，弹簧解析积分 |
| `TRANSIT` | 提交了 step，index 从 i 缓动到 i±1 | rAF 跑，补间 |
| `SETTLE` | 补间到达后的短吸收 | rAF 跑 |

**踩过的两个坑**（由单元测试与浏览器插桩发现）：

1. **`IDLE` 必须 `return false`**。初版漏了 `else` 分支，IDLE 会一路落到
   末尾的 `return true`，循环永不停止 —— 整个「静止零开销」的设计失效。
2. **循环停掉后必须能重新唤醒**。回调返回 false 后循环停止，但回调**仍留在
   集合里**；若 `ensureFrame()` 用 `if (stopFrame) return` 直接返回，
   引擎在第一次转场后就永久死掉了。解法是 `scheduler.ts` 导出 `wake()`，
   `ensureFrame()` 在已注册时改调 `wake()`。

### 边界

index 0 处 `step(−1)`、index last 处 `step(+1)` → 不转移，改发一次 `pull`
（橡皮筋回弹），给用户「到头了」的反馈。

---

## 六、弹簧与补间

**共用**帧循环 + 合成点 + dt 纪律（`dt = min(now − last, 100)`），
**不共用**同一条曲线。

### PULL 用解析解弹簧-阻尼

```
x(t) = e^(-ζω₀t)·(A·cos(ω_d t) + B·sin(ω_d t)) + target,   ω_d = ω₀√(1−ζ²)
```

- **为什么不用欧拉积分**：欧拉积分手感随帧率变（60Hz 与 144Hz 过冲量不同），
  除非每帧切子步。解析解对任意 dt 精确 —— 与 `chase()` 用半衰期而非
  「每帧百分比」是同一条理由：帧率无关。单元测试验证了「一大步 ≈ 多小步」。
- `ζ = 0.55`（欠阻尼，1–2 次可见回弹，就是「果冻」）；`ω₀ = 14 rad/s`（周期约 450ms）。
- 冲量同时给位移与速度，于是「位移一下 → 弹回 → 过冲」。

### TRANSIT 用固定时长补间

- **为什么不能用 `chase()`**：指数追赶只有「快 → 慢」，**没有「慢」的开头**，
  而需求明确要「先慢后快再慢」。所以必须是固定时长 + ease-in-out。
- `easeInOutCubic`，时长随提交速度调节（380–620ms）。轻轻推 → 舒展；猛滑 → 干脆。

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
