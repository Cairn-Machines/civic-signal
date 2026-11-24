import { expect, test, type Page } from '@playwright/test'
import { countLines } from './line-count'

const pages = [
  { path: '/', shot: 'landing' },
  { path: '/polls', shot: 'polls' },
  { path: '/methodology', shot: 'neighbour-methodology' },
]

test.use({ deviceScaleFactor: 1, colorScheme: 'light' })

const MIN_TAP = 44

const h1Left = async (page: Page, path: string) => {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  return page.getByRole('heading', { level: 1 }).first().evaluate((el) => el.getBoundingClientRect().left)
}

test('@ui-shots header content left edge matches on /, /polls and /methodology', async ({ page }) => {
  const xs = [await h1Left(page, '/'), await h1Left(page, '/polls'), await h1Left(page, '/methodology')]
  expect(xs[1], 'polls vs landing').toBeCloseTo(xs[0], 0)
  expect(xs[2], 'methodology vs landing').toBeCloseTo(xs[0], 0)
  const width = page.viewportSize()?.width ?? 0
  if (width <= 768) expect(xs[0]).toBeCloseTo(20, 0)
})

test('@ui-shots hero stats are not orphaned', async ({ page }) => {
  await page.goto('/')
  const stats = page.getByTestId('hero-stat')
  await expect(stats).toHaveCount(3)
  const tops = await stats.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  const distinct = new Set(tops).size
  expect([1, 3], `hero stat tops ${tops.join(',')}`).toContain(distinct)
  const sizes = await page.getByTestId('hero-stat-label').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)))
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12)
})

test('@ui-shots poll feed controls are tappable and the closed badge fits one line', async ({ page }, testInfo) => {
  await page.goto('/polls')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  const narrow = testInfo.project.name === 'chromium-390'

  const chips = page.getByTestId('filter-chip')
  expect(await chips.count(), 'at least one filter chip').toBeGreaterThanOrEqual(1)
  const badges = page.getByTestId('poll-status-badge')
  expect(await badges.count(), 'at least one closed poll card').toBeGreaterThanOrEqual(1)

  const heights = async (id: string) => page.getByTestId(id).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
  const controls = [...(await heights('filter-chip')), ...(await heights('sort-button')), ...(await heights('region-select')), ...(await heights('reset-filters'))]
  expect(await page.getByTestId('sort-button').count(), 'three sort buttons').toBe(3)
  expect(await page.getByTestId('region-select').count(), 'region select').toBe(1)
  if (narrow) for (const h of controls) expect(h).toBeGreaterThanOrEqual(MIN_TAP)

  const raw = await badges.evaluateAll((els) => els.map((el) => {
    const style = getComputedStyle(el)
    return {
      height: el.getBoundingClientRect().height,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      borderTop: style.borderTopWidth,
      borderBottom: style.borderBottomWidth,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
    }
  }))
  for (const r of raw) {
    const n = countLines(r)
    expect(Number.isFinite(n), 'badge line count is finite').toBe(true)
    expect(n, 'badge lines').toBeLessThanOrEqual(1)
  }
})

test('@ui-shots keyboard focus ring is a 2px accent outline on /polls controls', async ({ page }) => {
  await page.goto('/polls')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  const accent = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-parchment-accent')
    document.body.appendChild(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  })
  const targets = ['filter-chip', 'region-select', 'sort-button', 'reset-filters']
  const seen = new Set<string>()
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  for (let i = 0; i < 60 && seen.size < targets.length; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const style = getComputedStyle(el)
      return { id: el.getAttribute('data-testid'), matches: el.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor }
    })
    if (!info?.id || !targets.includes(info.id) || seen.has(info.id)) continue
    expect(info.matches, `${info.id} matches :focus-visible`).toBe(true)
    expect(info.style, `${info.id} outline-style`).toBe('solid')
    expect(info.width, `${info.id} outline-width`).toBe('2px')
    expect(info.color, `${info.id} outline-color`).toBe(accent)
    seen.add(info.id)
  }
  for (const id of ['filter-chip', 'region-select', 'sort-button']) expect(seen.has(id), `tabbed to ${id}`).toBe(true)
  // reset-filters only renders when a filter is active, so it is optional.
})

test('@ui-shots how-it-works cards align at both widths', async ({ page }, testInfo) => {
  await page.goto('/')
  const steps = page.getByTestId('how-step')
  await expect(steps).toHaveCount(4)
  const m = await steps.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return {
      left: r.left,
      top: r.top,
      h3Left: el.querySelector('h3')?.getBoundingClientRect().left ?? NaN,
      paddingLeft: parseFloat(style.paddingLeft),
      borderRight: parseFloat(style.borderRightWidth),
    }
  }))
  if (testInfo.project.name === 'chromium-390') {
    for (const c of m) {
      expect(c.left, 'card left').toBeCloseTo(m[0].left, 0)
      expect(c.h3Left, 'h3 left').toBeCloseTo(m[0].h3Left, 0)
    }
    for (const c of m.slice(0, 3)) expect(c.borderRight, 'no vertical rule').toBe(0)
  } else if (testInfo.project.name === 'chromium-1440') {
    expect(new Set(m.map((c) => Math.round(c.left))).size, 'four distinct columns').toBe(4)
    for (const c of m) expect(c.top, 'tops equal').toBeCloseTo(m[0].top, 0)
    expect(m[0].paddingLeft, 'card 01 flush left').toBe(0)
    for (const c of m.slice(0, 3)) expect(c.borderRight, 'vertical divider').toBe(1)
  }
})

for (const { path, shot } of pages) {
  test(`@ui-shots ${shot}`, async ({ page }, testInfo) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0)
    const body = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
    await testInfo.attach(`${shot}-${testInfo.project.name}`, { body, contentType: 'image/png' })
  })
}
