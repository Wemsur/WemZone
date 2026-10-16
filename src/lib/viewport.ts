import { ref } from 'vue'

/**
 * 视口形态
 *
 * 站点有两套版式，切换点只有一条媒体查询，而且 CSS 与 JS 必须完全一致 ——
 * 根字号由 CSS 的 @media 给，构图分支由这里的 narrow 给。两者若对不上，
 * 就会出现「按窄版排的元素被宽版的根字号放大」这种错位。所以查询串在这里
 * 定义一次，src/styles/main.css 里那条 @media 必须与它逐字相同。
 *
 * 判据是「竖着拿的窄屏」：
 *  - orientation: portrait 意味着高 ≥ 宽。16:9 的桌面画布放进这种视口里，
 *    要么缩到字看不清，要么左右被裁掉大半，只能换版式。
 *  - max-width: 900px 把竖屏平板也划进窄版（它同样容不下 100rem 宽的构图），
 *    同时把竖着摆的桌面显示器（1440×2560 这类）挡在外面 —— 那种视口够宽，
 *    桌面构图整体缩小仍然成立。
 *
 * 手机横过来（宽 > 高）走宽版：那正好是桌面构图擅长的比例。
 */
export const NARROW_QUERY = '(max-width: 900px) and (orientation: portrait)'

const mql =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW_QUERY) : null

/** 当前是否窄版。全站共用这一个监听，组件里直接读它做构图分支。 */
export const narrow = ref(mql?.matches ?? false)

mql?.addEventListener('change', (e) => {
  narrow.value = e.matches
})

/** 窄版下滚动行程相对宽版的倍率。见 Stage.vue 的说明。 */
export const NARROW_LENGTH_RATIO = 0.62
