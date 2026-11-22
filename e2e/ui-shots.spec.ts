import { expect, test } from '@playwright/test'

const pages = [
  { path: '/', shot: 'landing' },
  { path: '/polls', shot: 'polls' },
  { path: '/methodology', shot: 'neighbour-methodology' },
]

test.use({ deviceScaleFactor: 1, colorScheme: 'light' })

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
