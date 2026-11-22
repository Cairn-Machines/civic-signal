import { describe, it, expect } from 'vitest'
import { HERO_STAT_LABEL_COLOR, HERO_STAT_LABEL_SIZE } from '@/components/landing-page'

const PARCHMENT_BG = '#F5F1E8'

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('landing hero stats', () => {
  it('AC7 label colour has contrast of at least 4.5 on the parchment background', () => {
    expect(contrast(HERO_STAT_LABEL_COLOR, PARCHMENT_BG)).toBeGreaterThanOrEqual(4.5)
  })

  it('AC7 label font size is at least 12px', () => {
    expect(HERO_STAT_LABEL_SIZE).toBeGreaterThanOrEqual(12)
  })
})
