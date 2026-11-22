import { expect, test, type Page } from '@playwright/test'

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

  const lines = await badges.evaluateAll((els) => els.map((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
    const style = getComputedStyle(el)
    const inner = el.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth)
    return Math.round(inner / lineHeight)
  }))
  for (const n of lines) expect(n, 'badge lines').toBeLessThanOrEqual(1)
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
