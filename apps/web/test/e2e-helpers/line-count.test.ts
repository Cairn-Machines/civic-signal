import { describe, expect, it } from 'vitest'
import { countLines } from '../../../../e2e/line-count'

const base = { paddingTop: '4px', paddingBottom: '4px', borderTop: '1px', borderBottom: '1px', fontSize: '10px' }

describe('countLines', () => {
  it('counts lines with a numeric line-height', () => {
    expect(countLines({ ...base, height: 10 + 12, lineHeight: '12px' })).toBe(1)
    expect(countLines({ ...base, height: 10 + 24, lineHeight: '12px' })).toBe(2)
  })

  it('line-height normal falls back to 1.2x font-size and stays finite', () => {
    const n = countLines({ ...base, height: 10 + 12, lineHeight: 'normal' })
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBe(1)
  })

  it('zero height gives 0', () => {
    expect(countLines({ ...base, height: 0, lineHeight: '12px' })).toBe(0)
  })

  it('garbage inputs never give NaN', () => {
    const n = countLines({ height: NaN, paddingTop: 'auto', paddingBottom: '', borderTop: 'x', borderBottom: 'y', lineHeight: 'normal', fontSize: 'normal' })
    expect(n).toBe(0)
  })
})
