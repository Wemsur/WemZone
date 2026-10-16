/**
 * 相机引擎的类型定义
 *
 * 术语：
 *  - **世界坐标**：内容块所在的 3D 平面。X 向右、Y 向下、Z 向观察者。
 *    单位一律 rem（配合 main.css 的根字号等比缩放）。
 *  - **index**：连续索引。`index = 2.4` 表示「正从第 2 区走向第 3 区，走了 40%」。
 *    整数 index 就是「相机停在第 N 区」。
 *  - **Stop**：一个内容区的相机停靠点。内容块的位置由它派生。
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * 一个内容区的相机停靠点。
 *
 * 注意 `d`（相机到内容面的距离）与 `rx` / `ry`（静止基准倾角）是**该区自己的**，
 * 所以不同区块的镜头感可以不同 —— 这正是「每个内容区域摄像机到内容面的距离可以改变」。
 */
export interface Stop {
  /** 区块标识，同时用作 URL hash */
  id: string
  /** 世界 X（rem）。左右交替：0, +L, -L, +L, … */
  x: number
  /** 世界 Y（rem）。单调向下：0, -V, -2V, … */
  y: number
  /** 相机到内容面的距离（rem），必须 > 0 */
  d: number
  /** 静止俯仰角（deg） */
  rx: number
  /** 静止偏航角（deg） */
  ry: number
}

/** 相机在某一时刻的完整位姿。`sample()` 的输出。 */
export interface CameraPose {
  x: number
  y: number
  /** 相机到内容面的距离（rem） */
  d: number
  /** 俯仰角（deg） */
  rx: number
  /** 偏航角（deg） */
  ry: number
}

/** 输入层归一化后产出的「意图」。 */
export type Intent =
  /** 微弱滚动：给弹簧一个冲量，相机位移一下再弹回 */
  | { kind: 'pull'; delta: number }
  /** 提交：切换到相邻区 */
  | { kind: 'step'; dir: 1 | -1; speed: number }
  /** 直接跳转（键盘 Home/End、深链接、全览点击） */
  | { kind: 'jump'; index: number }

export type CameraStateName = 'IDLE' | 'PULL' | 'TRANSIT' | 'SETTLE'

/** 每帧交给订阅者的状态。 */
export interface CameraFrame {
  /** 连续索引 */
  index: number
  pose: CameraPose
  /** 标量速度（rem/ms），驱动运动模糊与动态倾斜 */
  velocity: number
  /** 运动方向的单位向量（屏幕空间） */
  dir: { x: number; y: number }
  state: CameraStateName
}
