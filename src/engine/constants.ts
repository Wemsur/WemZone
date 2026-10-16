/**
 * 全部可调常量集中在这里
 *
 * Phase 5 的调参面板直接读写这个对象，所以它必须是**可变的普通对象**
 * （不是 `as const`，也不是散落的模块级 const），否则运行时改不动。
 */

export const CAMERA = {
  /* ---- 透视 ---- */
  /**
   * 透视距离（rem）。不用 Celestial-Web 的 160：160 太远，投影接近正交，
   * z 相关视差几乎看不见。120 在「透视明显」与「不产生鱼眼畸变」之间取平衡。
   */
  PERSPECTIVE: 120,

  /* ---- 空间模型 ---- */
  /** 相邻两区的垂直间距（rem，负值向下） */
  VERTICAL_SPACING: -56,
  /** 左右交替的横向振幅（rem） */
  LATERAL_AMPLITUDE: 26,
  /** 基准相机距离（rem） */
  BASE_DISTANCE: 34,
  /** 相机距离的抖动幅度（rem），让每区的镜头感不同 */
  DISTANCE_JITTER: 8,

  /* ---- 弹簧（PULL：微弱滚动的果冻回弹） ---- */
  /**
   * 阻尼比。ζ < 1 → 欠阻尼，有明显回弹但不振荡多次，就是「果冻」。
   * 0.55 约 1–2 次可见回弹。
   */
  SPRING_ZETA: 0.55,
  /** 固有角频率（rad/s）。14 → 周期约 450ms，回弹看得完整又不拖沓。 */
  SPRING_OMEGA: 14,
  /** 弹簧收敛判据（rem / rem/ms） */
  SPRING_EPS_X: 0.004,
  SPRING_EPS_V: 0.0002,
  /** 冲量 → 位移 / 速度的增益 */
  PULL_DISP_GAIN: 0.0006,
  PULL_VEL_GAIN: 0.004,
  /** 单次 pull 的最大位移（rem），防止猛滚把画面甩出去 */
  PULL_MAX_DISP: 3.2,

  /* ---- 补间（TRANSIT：切换的「先慢后快再慢」） ---- */
  /** 基准时长（ms） */
  TRANSIT_BASE_MS: 620,
  /** 提交速度对时长的削减（ms per px/ms） */
  TRANSIT_SPEED_GAIN: 26,
  TRANSIT_MIN_MS: 380,
  TRANSIT_MAX_MS: 700,

  /* ---- 输入 ---- */
  /** 一行 wheel 折算的像素 */
  WHEEL_LINE_PX: 16,
  /** 累计位移超过这个值 → 提交 step（滚轮一格约 100px，所以单格只抖不切） */
  STEP_THRESHOLD_PX: 150,
  /** 快速手势的判定：速度 ≥ 此值（px/ms）且累计 ≥ STEP_SPEED_MIN_PX → 立即提交 */
  STEP_SPEED_PX_MS: 3,
  STEP_SPEED_MIN_PX: 40,
  /** 手势间隔超过此值（ms）视为新手势 */
  GESTURE_GAP_MS: 160,
  /** 提交后的冷却（ms）：吞掉触控板惯性的尾巴 */
  GESTURE_COOLDOWN_MS: 260,
  /** 转场期间是否允许排队（0 = 忽略，与访谈一致） */
  QUEUE_DEPTH: 0,

  /* ---- 动态倾斜 ---- */
  /** 速度 → 倾斜角的增益（deg per rem/ms） */
  TILT_VEL_GAIN: 26,
  /** 动态倾斜封顶（deg） */
  TILT_MAX_DEG: 3.2,

  /* ---- 运动模糊 ---- */
  /** 速度 → blur 半径（px per rem/ms） */
  BLUR_SPEED_GAIN: 22,
  BLUR_MAX_PX: 6,
  /** 速度 → 沿运动轴的拉伸比例 */
  STRETCH_SPEED_GAIN: 0.22,
  STRETCH_MAX: 0.06,
  /** 拖影层最大不透明度 */
  STREAK_MAX_OPACITY: 0.18,

  /* ---- 帧循环 ---- */
  /** dt 上限（ms）：标签页切回来时不至于一帧跳完 */
  MAX_DT_MS: 100,
}
