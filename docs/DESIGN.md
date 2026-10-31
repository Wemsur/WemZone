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
| 一次滚动只前进一区，滚多少都一样 | 需要意图识别 + 输入锁定 |
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
  uniform 首段过冲 0.485rem，centripetal 只有 0.250rem（内段为 0）。
- **Bézier**：要手工摆控制柄，改一个锚点得重调两个柄。CR 只依赖四个相邻锚点。
- **直线段 + smoothstep**：切线在锚点处不连续，相机会在每一站「拐一下」。

### 端点处理：半镜像幽灵点

`sample(s)` 对 `s` 的导数就是**相机沿路径的速度**。这一点决定了端点处理不能用
「复制端点」—— 复制会让端点处的切线变成零向量，曲线照样经过锚点，但相机在
首页附近几乎不动。

**实测**：一次滚轮 pull 让索引偏离 0.0123，在 s=1/2/3 处对应约 0.89rem 的
屏幕位移，而在 s=0 处只有 **0.03rem** —— 首页的果冻是其他区的 1/30，
用户会直接读成「首页没有果冻」。

幽灵点取 `P0 + 0.5·(P0 − P1)`（镜像方向、一半距离）。端点切线恢复到自然量级
（首页 pull 0.884rem，与其他区一致），过冲只从 0.193rem 涨到 0.250rem
（振幅的 0.96%，16px 根字号下约 4px）。

也试过完整镜像与外推：切线同样恢复，但过冲更大（0.267 / 0.27rem），没有额外
收益。半镜像是在「端点有速度」与「不过冲」之间实测最优点。
`spatial.test.ts` 里有两条回归测试守着这个性质（端点切线非零、端点与内段位移同量级）。

残余的 0.25rem 过冲**只出现在首段与末段**，内段是严格 0。

### 位置走 CR，标量走线性

`x` / `y` 决定路径形状，走 CR。`d` / `rx` / `ry` 走**线性插值** ——
转场的「先慢后快再慢」由力学系统提供（`physics.ts`），路径再套一次缓动会叠出
双重缓动，转场像「顿两下」。线性也保证这三个量不过冲。

**分工：spatial 只决定「形状」，physics 只决定「快慢」。二者正交。**

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

**R 的符号必须与 transform 里写的 `rotateX/rotateY` 逐字一致。**
这里踩过一个很隐蔽的坑：补偿矩阵用 `-rx` 计算，而 transform 写的是
`rotateX(+rx)`。两者反号，旋转带来的深度位移不但没被抵消、反而翻倍：
倾斜 3.2° 时区块被放大约 **46%**，落位时缩回去再弹一下 —— 用户看到的就是
「到达后突然缩小再放大」。`world.test.ts` 现在直接验证「看向点的深度
恒为 P−d」，这是「不缩放」的充要条件。

### 距离恒定，不做推拉

`#world` 把内容面推到 z = `P − d`，投影缩放 = `P / d`。每个 section 的
**静态** transform 带反向补偿 `scale(d_i / P)`，于是静止时净缩放 = 1 ——
**视觉大小恒定**。

**所有区块共用同一个 `d`（`DISTANCE_JITTER = 0`）。** 早先让每区距离抖动
±8rem，转场时 `d(t)` 变化，净缩放变成 `d_i/d(t)`：区块会在转场中先缩小
再放大，用户实测到的现象是「切换时先缩一下，到了再落下来，闪一下大的字」。

补偿是静态的，不进每帧循环。若做「每帧实时补偿」，每帧写入从 1 次变成
N 次，违背整个架构的性能前提 —— 所以用「距离恒定」而不是「每帧补偿」。

### 区块尺寸：按视野给，不能按内容给

区块要**铺满视野**，所以它的世界尺寸由相机距离决定，而不是由内容撑开：

```
区块世界宽度(rem) = 视口宽(px) / 根字号(px)
```

注意**不能再乘 `d/P`**：静态 transform 里的 `scale(d/P)` 已经做了一次距离补偿，
再乘一次会让区块被缩小两次（实测只剩视野的 23%）。

实现上用 `World.vue` 里一个 100vw×100vh 的隐形探针量出「一屏等于多少 rem」，
写进每个 section 的内联宽高。任意窗口尺寸、任意相机距离下，当前区块都恰好铺满
视野。内容组件必须 `width/height: 100%` 填满这个盒子 —— 一旦它自己定尺寸，
区块又会被内容反向决定，退回「屏幕中间一小块」。

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
- **但「果冻」是事件级的**：每个未提交的 wheel 事件都立刻发一个 `pull`，
  所以手指还在滑的时候相机就已经在动。早先只在手势静默结束后发一次，
  结果是「微滑的整个过程相机一动不动，抬手才动一下」—— 用户直接反馈
  「触控板微滑没变化」。

**实测**（浏览器里真派发事件）：一次触控板猛滑（8 个手指事件 + 50 个衰减的
惯性事件）→ 恰好前进 1 格；单格滚轮只抖不切；两格滚轮仍然只抖。

### 阈值

滚轮一格约 100px < `STEP_THRESHOLD_PX`(750) → **只抖不切**（pull），
与访谈确认的「滚轮一格算微弱」一致。两格（约 200px）仍不够，需要连续
7–8 格才越过阈值。这是用户明确要求的「把只抖不切的范围调大」。

触控板猛滑：速度分支（≥4 px/ms 且累计 ≥240px）在滑到 240px 时就提交，
**但只对「触控板式」的小步事件生效**（`TRACKPAD_MAX_EVENT_PX`，见下）。

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

### 实测轨迹（k=450, c=42, sat=0.5, ζeff≈0.70）

```
t(ms)   s        v
    0   0.000    0.00     ← 起步
   54   0.168    3.78
  104   0.339    3.23     ← 越过势垒，速度略降
  150   0.494    3.62
  200   0.699    4.43     ← 速度峰值（中段）
  250   0.900    3.24
  300   0.995    0.89
  350   1.008   -0.05     ← 过冲约 35px 屏幕位移
  404   1.003   -0.10     ← 迅速拉回
  454   1.000   -0.02     ← 回到正确位置
  612   1.000    0.00     ← 吸附落位
```

总时长约 0.61 秒。**过冲是刻意的**（用户要求「带冲力，超过正确位置一点后
迅速拉回」）。注意回程明显比去程快：过冲后锚定力与势能都指向目标（叠加），
而去程中势能是在抵抗离开当前井（部分抵消）。这个不对称是物理自带的，
不是额外写的规则。

**过冲量随积分步长变化，所以必须用固定步长。** 同一个 k/c，dt=16.7ms 时
过冲只有 1.03%，dt=1/240s 时是 3.9% —— 差 3.8 倍。详见下面「固定步长」。

### 为什么锚定力要饱和（`PHYSICS_ANCHOR_SATURATION`）

线性锚定 `k·(anchor − s)` 在 k 大时会**起步即巅峰**：k=350 时 33ms 就冲到
7.5 索引/秒，完全没有「慢」的开头。改成 `k·sat·tanh(d/sat)`：

- 近处（|d| ≪ sat）→ 力仍是 `k·d`，**刚度不变**，落位与果冻手感不受影响；
- 远处（|d| ≫ sat）→ 力封顶在 `k·sat`，起步不会被猛推。

附带好处是它更像真实引力：距离越远力越大，但有上限。
sat=0.5 时中段速度曲线仍是「慢-快-慢」，且在势垒处有一次轻微降速 ——
这正是「每个区块中心对相机有引力」该有的观感。

### 落位吸附：阈值按像素定，不按索引拍脑袋

收敛到最后，引擎会把 `s` 直接吸附到整数索引。**吸附量就是用户看到的那一下瞬移**，
所以阈值必须用像素反推：

```
屏幕放大 = P/(P−z) = 120/34 ≈ 3.53
1 索引   = 72rem = 1152px 世界坐标
1px 屏幕 ≈ 1/(3.53 × 1152) ≈ 2.46e-4 索引
```

早先 `epsS = 2e-3` → 吸附跳变约 **0.8px**，用户直接反馈「最后突然吸过去一下」。
现在 `REST_EPS_S = 1.5e-5`、`REST_EPS_V = 5e-4`，实测最坏跳变约 **0.067px**。

**只压位置阈值不够**：跳变的上限其实是 `epsS + v·dt` —— 最后一个未吸附的帧
可能只是「差一点点没过检查」，下一帧就跳过去了。所以速度阈值也要一起收紧。

### 为什么用半隐式欧拉 + 固定步长

显式欧拉在弹簧系统上会随 dt 增大而发散。半隐式（先更新速度、再用新速度
更新位置）对谐振子是无条件稳定的（辛积分器），实现只有两行。

但**半隐式欧拉仍然有数值阻尼**：步长越大，阻尼被低估得越多。实测同一条
切换，dt=16.7ms 的过冲是 1.03%，dt=1ms 是 2.67% —— 也就是说手感会随
刷新率变化，慢放时看到的轨迹也和正常速度不一样。

所以模拟时间攒进累加器，永远用 `FIXED_STEP = 1/240s` 推进。
60Hz / 144Hz / 慢放 0.25× 得到**同一条轨迹**，只是真实时长不同。
输入力的半衰期衰减也按固定步长做，同样与帧率无关。

累加器上限 0.5s：标签页切回来时不会一次补几千步。

### 停帧

当相机静止在目标井、且没有待处理输入力时，`tick` 返回 false 让 rAF 停下
—— 这是「静止时主线程零开销」的实现。空闲晃动交给 CSS 合成动画（第七节）。

---

## 六、输入力与帧纪律（`input.ts` / `scheduler.ts`）

### 滚动在力学里是「外力」，不是「位置」

`pull` 意图不再直接改位移，而是往系统里注入力。**每个 wheel 事件都立即注入一次**
（用单事件的 delta，不用累计量 —— 累计量在慢滑时会持续增长，把轻滑放大成猛推）。

力的大小走**饱和曲线**而不是线性：

```
force   = PULL_FORCE_MAX   · tanh(|Δ| / PULL_FORCE_SATURATION_PX)
impulse = PULL_IMPULSE_MAX · tanh(|Δ| / PULL_IMPULSE_SATURATION_PX)
```

**为什么必须饱和**：触控板一次微滑累计只有几像素，线性映射算出来的力约等于零，
用户会直接说「触控板微滑没反应」。饱和曲线把小输入抬到可感知量级，
同时不让大输入失控。实测（k=450、Fmax=10、sat=50px）：

| 输入 | 屏幕位移 |
|---|---|
| 10 个 4px 事件（触控板微滑） | 约 20px |
| 滚轮一格（100px） | 约 31px |
| 滚轮两格（200px） | 约 59px |

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

## 九、运动模糊（已实现，A/B 可切换）

CSS 的 `blur()` 是各向同性的，像失焦不像运动。两套方案：

- **A（默认）**：各向同性 blur（封顶 6px）+ 沿运动轴拉伸（`scale`）。
- **B**：SVG 各向异性 `feGaussianBlur`（`stdDeviation="sx sy"`，真正的方向性）。
  作用在大面积 DOM 子树上很慢，**只作对比**。

**模糊量是速度的连续函数，没有开关。** 早先把 `velocity`（索引/秒）误当成
索引/毫秒又乘了 1000，任何运动都瞬间顶到上限 —— 表现为「静止 → 突然糊死 →
突然清晰」，与运动没有衔接。现在死区之上用 smoothstep 连续升起，
实测一次转场 blur 走 4.85 → 3.63 → 2.38 → 1.08 → 0.61 → 0.19 → 0，
全程无跳变。

**刻意不做全屏拖影叠加层**：一条带色光晕并不对应真实运动，而且它用的是
`--color-brand`，会被启动器主题染成一片半透明绿（见第十节）。

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
| 端点复制幽灵点 | 首页果冻只有其他区的 1/30（0.03rem vs 0.89rem） | 端点切线是速度，用半镜像幽灵点 |
| 落位阈值按索引拍脑袋 | 最后一帧突然吸过去约 0.8px | 阈值按像素反推：`REST_EPS_S/V` |
| 区块尺寸由内容决定 | 区块只占视野 45%，像屏幕中间一小块 | 用探针量一屏 rem，写进 section 内联宽高 |
| 区块宽度乘了 `d/P` | 被缩小两次，只剩视野 23% | 距离补偿已在静态 transform 里，别再乘 |
| 启动器令牌劫持 | 拖影/自绘组件全变 Modrinth 绿 `#1bd96a` | 自用样式一律走 `--wz-*` 命名空间 |
| 高 k 线性锚定 | 起步即巅峰（33ms 冲到 7.5 索引/秒） | 锚定力用 `k·sat·tanh(d/sat)` 饱和 |
| 每区相机距离不同 | 转场时内容先缩后放，闪一下大的字 | 距离恒定（`DISTANCE_JITTER = 0`） |
| 积分步长跟着帧长走 | 过冲随刷新率变（16.7ms 1.03% / 1ms 2.67%） | 固定步长 `FIXED_STEP = 1/240s` + 累加器 |
| 旋转补偿符号反了 | 倾斜时区块放大 46%，落位时缩回再弹 | 补偿矩阵的 `a/b` 与 `rotateX/Y` 同号 |
| `.world-section` 用 `preserve-3d` | Zen（Gecko 159）上文字与卡片**逐帧消失又出现**，背景与 fixed 层不动 | 区块内两层共面，会进入 3D 排序且顺序不稳定；区块内不需要 3D，用默认 flat |
| SVG 里用 `rem` 定字号 | 总览标签比预期大一个根字号倍率（约 90px 高） | SVG 的 CSS 长度按**用户单位**算；尺寸按屏幕像素反推成世界单位（`worldPerPx()`） |
| `Engine.path` 写成值属性 | 调几何参数后区块不跟着动、相机却按新路径走了，视角偏到区块之间的背景 | 改成 getter：`rebuild()` 换的是闭包里的变量，属性必须现取 |

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
- 相机世界里的 section 由 `World.vue` 按视野给宽高，内容块**必须**
  `width/height: 100%` 填满它；自己写死宽度会让区块被内容反向决定。
- 需要游戏版本/加载器下拉时调 `ensureTagsLoaded()`（懒加载，不阻塞首屏）。

---

## 十二、调试：慢放与调参面板

两者都只在 `import.meta.env.DEV` 且宽版下出现（`App.vue` 的 `showDebug`）。

### 慢放（`engine/debug.ts`）

`setTimeScale(0.25)` 把引擎感知到的时间流速降到 1/4：同一次操作触发的
切换会走 4 倍长的真实时间，可以逐帧观察过冲、回弹、模糊与倾斜。

**它影响**：物理积分、输入力衰减、速度驱动的模糊与倾斜、空闲晃动
（CSS 动画时长通过 `--wz-time-scale` 缩放）。
**它不影响**：手势切分、提交冷却、滚轮/触控板阈值 —— 这些仍按真实时间走。

这是刻意的：慢放是为了「做一次正常操作，然后看它的动画」。如果连输入的
时间窗口也一起缩放，真实操作会被拆成多次手势，反而没法复现。

因为积分是固定步长（见第五节），慢放得到的**轨迹与正常速度完全一致**，
只是时长按比例拉长 —— 这正是「看清楚真正发生了什么」的前提。

时间倍率不进 localStorage：它是调试开关，刷新后应回到 1×。

### 调参面板（`components/TuningPanel.vue`）

直接读写 `CAMERA` 这个可变普通对象，引擎每帧现读，所以拖动立刻生效。
几何类参数（间距 / 振幅 / 距离 / 透视）会触发 `rebuildStops()` 重建路径。
改动自动存 localStorage，可恢复默认或导出成可粘回 `constants.ts` 的片段。

**改默认值时要升 `STORAGE_KEY` 版本号**（当前 `wemzone.tuning.v3`）：旧存档
会静默盖掉新默认值 —— 踩过一次（`DISTANCE_JITTER: 8` 把「距离恒定」的修复
完全覆盖）。

### 总览（`components/OverviewLayer.vue`，仅 DEV）

调参面板的「打开总览」或按 `O`。打开后：

- 引擎的 `setOverview(true, d)` 让 `frame.pose` 换成「对准平面质心、距离 d、
  倾角 0」——只改渲染位姿，`phys.s` 不动，所以滚动仍在改索引；
- 每个区块的静态 transform 关掉距离补偿（`compensate = false`）。否则镜头在
  很远处时区块按 `d_i/d` 缩成小点、间距却不变，看到的不是平面本身；
- 世界坐标里画一条相机轨迹（虚线）、各停靠点与区块名，以及相机当前位置。
  轨迹随几何重建重算 —— 改间距 / 振幅时，能直接看出「路径是否仍穿过区块中心」。

距离由调用方按「整个平面占屏幕 78%」算出来（宽高各算一次取大者）。
线宽用 `vector-effect: non-scaling-stroke`：整张图在屏幕上缩到约 0.1 倍，
普通 stroke 会一起缩成看不见。

DEV 下还暴露了 `window.__camera`，可以在控制台读连续索引 / 速度或跳区。

---

## 十三、背景系统（`components/background/`）

**每个区块一套独立的背景场景**，不是一张全局背景换颜色。这是用户逐区指定的：

| 区块 | 背景构成 |
|---|---|
| 首页 | 背景图 + 遮罩 + 大型白色微弱**呼吸光晕**（三处轮换）+ 微弱点阵 |
| Celestial Launcher | 与官网类似的**流体 + 流动像素**（MeshGradient + Dithering） |
| 其它作品 | **点阵**（圆点→圆角方形）+ 均匀分布的**起伏波形** + 光晕 |
| 视频 | **呼吸光晕 + 流动像素**（只有像素、没有流体）+ 背景图 + 边缘渐隐 |
| 联系 | 最安静的一屏，**几乎只有渐变** |

### 背景在 3D 世界里跟着区块移动

背景**挂在 `.world-section` 里**（`.section-bg`），和内容一起被相机的
`#world` transform 推动：区块进出视野时，它的点阵、流体、光晕也一起移动。
**不是** screen-space 的全局背景。

尺寸是区块的 170% × 200%（区块本身已经是 104% 视口）。这样：

- 区块居中时，视野内永远看不到背景的边缘 —— 不出现黑边；
- 相邻区块的背景在区块之间**重叠**。区块间距 72rem、背景半高 58.5rem，
  所以重叠 45rem，两区的重叠区以「中点」为中心对称分布。

`mask-composite: intersect` 把竖/横两条渐隐叠加（`-webkit-mask-composite:
source-in` 是 WebKit 的等价写法）。

**竖直渐隐是上下对称的**，各 36rem（`transparent 3.85% → #000 34.62% →
#000 65.38% → transparent 96.15%`）。早先只在顶边渐隐，指望下一区的背景
盖住上一区的底边 —— 但区块是**按 DOM 顺序**叠放的，上一区的底边恰好露在
下一区顶边之上，实测就是「每个区块背景的下边缘硬截断」。对称渐隐后两块
背景在重叠区里同时半透明、互相透出，过渡是空间上的交叉溶解。

对称渐隐的代价是重叠处会漏出一点页面底色（半透明叠半透明），所以首页/
视频区的图片背景额外加了一层 `.photo-bleed`：同一张图模糊、纵向拉伸后
向下延伸，图片淡出处接的是「图片的延续」而不是黑。

首尾区块用同一套对称渐隐（`.section-bg--last` 已无独立样式）。

### 窄版（手机竖屏）

手机上一节就是整屏（约 52rem），比宽版的 72rem 间距紧凑得多。背景若仍按
200% 高，相邻背景会从**本屏中间**就开始叠上来，看起来像「下一区的颜色从
屏幕中线升起」。所以窄版把 `.section-bg` 收到 150% 高（`main.css` 里的
窄版媒体查询，必须写在 `.section-bg` 基础规则**之后**才生效）。

### WebGL 只在需要的地方

只有启动器区（流体 + 像素）与视频区（像素）用 Paper Shaders；其余是纯 CSS
（渐变、点阵、SVG 波形）。WebGL 场景由 `useShaderLayers` 每 250ms 读一次
宿主元素投影后的矩形，完全在视野外就 `setSpeed(0)`，离屏区块不排帧。

### 常驻动画的取舍

参考站的流体是「滚动即时间、静止即冻结、静止零开销」。用户明确要求
**静止时也持续流动**，所以这里 `speed > 0`。代价用性能档控制（`lib/perf.ts`）：
高档 1280×720 双着色器，中档 960×540，低档 640×360 且去掉点阵；
`prefers-reduced-motion` 时完全退化成静态 CSS 渐变。

### 背景图

首页与视频区已接入用户提供的概念艺术图（`assets/bg/home-bg.jpg` /
`video-bg.jpg`），由 `.photo` 铺满，再用 `mask` 在**它自己的边缘**渐隐 ——
那条边永远在视口外，所以视野内看不到接缝、也不会出现黑边。图片层比视口
大 12%，`cover` 铺满；底部另有一层 `.photo-bleed`（模糊 + 纵向拉伸）向下
延伸，接住图片淡出后的区域。

---

## 十四、B 站数据管线（`scripts/fetch-bilibili.mjs`）

视频区的内容来自 B 站空间（UID `1826712095`），不写死。难点有三层：

1. **CORS**：浏览器不能直连 B 站接口，必须服务端代理。
2. **WBI 签名**：`x/space/wbi/arc/search` 要求从 nav 接口取两个密钥，
   按固定置换表拼出 mixin key，再对排序后的参数做 md5（`w_rid`）。
3. **风控**：不带 `buvid3` cookie 会直接返回风控 HTML；实测还需要浏览器式的
   `Origin` / `Sec-Fetch-*` 头与 `dm_*` 指纹参数，否则返回 `-352` 或 `412`。

流程：

```
scripts/fetch-bilibili.mjs  ──► src/data/videos.json（构建时快照）
        │
        └─ Vite 开发中间件 /api/bilibili/videos ──► 前端优先请求（实时）
                                                      失败则用快照
```

- `node scripts/fetch-bilibili.mjs` 手动刷新快照；接口风控是**偶发**的，
  失败重试一次通常就过。
- 封面的 B 站图床有防盗链：Referer 为 localhost 时返回 403。前端 `<img>` 必须
  带 `referrerpolicy="no-referrer"`。
- 生产环境对应 `api/bilibili/videos.ts`（Vercel Serverless，Phase 5 接入）；
  在它上线前，前端一直用构建时快照，不会空。

---

## 十五、用户偏好：滑动灵敏度（`lib/preferences.ts`）

相机是连续力学的：一次手势能不能越过势垒，取决于**这次手势累计了多少滚动
像素**。而「多少像素」在不同设备上差一个数量级 —— 精密触控板滑一次往往只有
一百多像素，廉价鼠标滚轮滚一格就是 100px。同一套阈值，在一台机器上「轻轻
一划就翻页」，在另一台上「滑得手酸也不动」。

所以把阈值整体缩放交给用户，而不是塞进调试面板：

- 区间 `0.4× – 2.5×`，默认 `1×`，存 `localStorage`（`wemzone.scroll-sensitivity.v1`）。
- 实现上缩放的是 **wheel 的位移**（`input.ts` 里 `delta *= sensitivity`），
  等价于 `STEP_THRESHOLD_PX / 倍率`。这样「更容易翻页」与「同样力度推得更远」
  是同一件事，不会出现「阈值降了但果冻没反应」的割裂。
- **不**缩放 `TRACKPAD_MAX_EVENT_PX` 的粒度判定：它区分的是滚轮的大事件
  与触控板的小事件，是设备属性，不是手感。
- 只影响**输入判定**，翻页之后的轨迹（过冲、回拉、果冻）永远一样。

UI 挂在「统一卡片」上：悬停整张卡片时，一条**与卡片等宽**的扁条从卡片下方
滑出（卡片在下半屏时自动翻到上方）。扁条外层是卡片本身的样子，内层是一圈
四边等距的圆角轨道（看起来像外框的描边），主题橙色按当前倍率从左往右填充：
`0.4× → 0%`，`2.5× → 100%`。**扁条里没有任何文字**，数值放在悬停出现的
tooltip 里（「滑动灵敏度：1×」）。

面板是卡片的绝对定位子元素，跟着卡片每帧的 `translate3d` 走；高度用
`padding` 而不是 `margin` 撑开，鼠标穿过「卡片 → 扁条」的空隙时不会丢失
`:hover`。真正的 `<input type=range>` 是透明铺满整块的，所以拖动、点击、
键盘都能用。扁条上的 `@wheel.stop` 阻止调滑块时顺手翻页。

卡片的类名是 `.unified-card` 而**不是** `.card`：启动器的 `classes.scss` 里
有一个全局 `.card`（带边框、背景），会静默渗到自己的卡片上 —— 实测表现为
「扁条怎么都跟卡片差 1.3px」。这和 `--wz-*` 令牌是同一个坑。

---

## 十六、窄版（手机竖屏）适配

两套版式由**同一条媒体查询**切换（`lib/viewport.ts` 的 `NARROW_QUERY` 与
`main.css` 的 `@media (max-width: 900px) and (orientation: portrait)` 必须
逐字一致）：宽版是 3D 平面 + 相机，窄版是原生竖直滚动 + `scroll-snap`。

窄版没有相机帧（`World.vue` 不挂载，引擎不 tick），所以任何「由相机连续
索引驱动」的效果都必须另找触发源：

| 效果 | 宽版触发 | 窄版触发 |
|---|---|---|
| 启动器入场（下落 + 左移） | 索引进入 0.90–1.18 | `IntersectionObserver` 50% 可见 |
| 作品 / 视频 marquee | 索引区间内跑 rAF | 自己跑 rAF，用可见性开关循环 |
| 区块导航 | 统一卡片（右侧浮卡） | 右侧圆点导航（滚动位置高亮） |

布局要点：

- `.mobile-inner` 必须撑满一节。各区内容组件都是 `height: 100%` 的（宽版由
  `.section-content` 给高度）；按内容收缩时视频区会直接塌成 0 高，首页的一言
  会压在标题上。
- 首页标识在竖屏必须一行放得下：CJK 可以在任意字之间断行，「庭域」会被折成
  两行，所以 `.tingyu` 加 `white-space: nowrap`、两侧 `flex: 0 0 auto`。
- 视频区倾斜角从 30° 收到 18°、卡片缩到 15rem；标题垫一层椭圆径向暗角
  （不是矩形遮罩，亮背景上会看出边）。
- 区块背景收到 150% 高（见第十三节）。
- `viewport-fit=cover` + `env(safe-area-inset-*)`：刘海/圆角/底部小白条。
- 卡片行的「悬停减速」只接受 `pointerType !== 'touch'`：触屏没有配对的
  `pointerleave`，手指划过一行会让它永久停住。
