export type LineCountInput = {
  height: number
  paddingTop: string | number
  paddingBottom: string | number
  borderTop: string | number
  borderBottom: string | number
  lineHeight: string | number
  fontSize: string | number
}

const num = (v: string | number): number => (typeof v === 'number' ? v : parseFloat(v))

const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback)

/** Number of text lines in a box from raw computed-style values. Always finite; `line-height: normal` falls back to 1.2 x font-size. */
export const countLines = (input: LineCountInput): number => {
  const fontSize = finiteOr(num(input.fontSize), 0)
  const lineHeight = finiteOr(num(input.lineHeight), 1.2 * fontSize)
  const inner =
    finiteOr(num(String(input.height)), 0) -
    finiteOr(num(input.paddingTop), 0) -
    finiteOr(num(input.paddingBottom), 0) -
    finiteOr(num(input.borderTop), 0) -
    finiteOr(num(input.borderBottom), 0)
  if (!(inner > 0) || !(lineHeight > 0)) return 0
  return Math.round(inner / lineHeight)
}
