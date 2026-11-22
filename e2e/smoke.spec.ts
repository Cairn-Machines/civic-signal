import { expect, test, type Page } from '@playwright/test'

// Console errors, page errors and same-origin 4xx/5xx responses fail the test.
const watch = (page: Page, origin: string) => {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin === origin && response.status() >= 400) problems.push(`${response.status()} ${url.pathname}`)
  })
  return problems
}

const screens = [
  { name: 'landing page', path: '/', heading: /Verified-human polling for public\s+intelligence/ },
  { name: 'active polls (primary public screen)', path: '/polls', heading: /What civic questions are open right now/ },
  { name: 'methodology', path: '/methodology', heading: /How CivicSignal stays trustworthy/ },
]

for (const screen of screens) {
  test(`@smoke ${screen.name} renders on an empty database`, async ({ page, baseURL }) => {
    const problems = watch(page, new URL(baseURL ?? '').origin)
    const response = await page.goto(screen.path)
    expect(response?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe(screen.path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(screen.heading)
    await page.waitForLoadState('networkidle')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0)

    if (screen.path === '/methodology') {
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      const clipped = await page.evaluate(() => {
        const limit = window.innerWidth + 0.5
        const root = document.querySelector('main') ?? document.body
        const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`
        return Array.from(root.querySelectorAll('*'))
          .filter((el) => el.getBoundingClientRect().right > limit)
          .map((el) => `${describe(el)} right=${Math.round(el.getBoundingClientRect().right)}`)
      })
      expect(clipped, 'elements extending past the viewport').toEqual([])
    }
    expect(problems).toEqual([])
  })
}
