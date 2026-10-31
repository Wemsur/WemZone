/**
 * 确定性洗牌
 *
 * 用在「每行内容各自打乱」的地方：同一 seed 得到同一顺序（同一次加载内稳定），
 * 不同行用不同 seed，于是行与行之间不会出现重复的斜线图案。
 */
export function shuffle<T>(input: readonly T[], seed: number): T[] {
  const a = input.slice()
  let s = seed >>> 0
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}
